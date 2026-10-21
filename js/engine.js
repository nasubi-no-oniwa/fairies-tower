// =============================================
//  Fairies' Tower  動きの計算（決まった答え）
//  ・1/120秒ずつ進める。同じ層・同じ屍・同じ操作なら、どの端末でも必ず同じ結果
//    （Math.sin などは使わず、表をひいて計算する。乱数も使わない）
//  ・翅で飛べるのは少しの間だけ。空中で翅が尽きると力尽きて、その場に屍が浮かぶ
//  ・屍は上から降りると乗れる。飛ぶのをやめて近づくとつかまれる。近くで死ぬと合流する
// =============================================
(function (G) {
  const FT = G.FT = G.FT || {};
  const DT = FT.DT = 1 / 120;
  // ---------- 決まった答えの sin（表）。p：1で1周 ----------
  const SIN = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) { let x = i / 1024 * 6.283185307179586; if (x > 3.141592653589793) x -= 6.283185307179586; const x2 = x * x; SIN[i] = x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156)))))); }
  const dsin = p => SIN[((Math.floor(p * 1024) % 1024) + 1024) % 1024];
  FT.dsin = dsin;
  const tri = v => { const f = v - Math.floor(v); return f < .5 ? f * 2 : 2 - f * 2; };
  FT.tri = tri;
  // ---------- 決まった数（マス・秒） ----------
  const COLS = FT.COLS = 20;
  const GRAV = 30, MOVE = 6, JUMP = 10, FALLMAX = 14;
  const FLY_PUSH = 75, RISE_MAX = 7, FLY_TIME = 1.3, REFILL = 2.2;
  const PW = 0.7, PH = 0.9;
  const MERGE = 2.2;
  FT.PHYS = { PW, PH, MERGE, FLY_TIME };
  // ---------- 陣営と種族 ----------
  FT.FAC = [
    { id: 'g', name: '緑の同盟', color: '#6fdc8c', mark: '葉' },
    { id: 'r', name: '赤の軍勢', color: '#ff6b5a', mark: '炎' },
    { id: 'b', name: '青の連合', color: '#5ab0ff', mark: 'しずく' },
  ];
  // sk：技の種類（none は、いつも効いている）
  FT.SP = [
    { name: '緑の妖精', fac: 0, color: '#7ddc8a', skill: '長く飛べる', sk: 'none', how: '翅のもちが、ほかの妖精の1.3倍' },
    { name: '黄の妖精', fac: 0, color: '#ffd84a', skill: '魔物を止める', sk: 'freeze', how: '技を押すと、まわりの魔物が2.5秒止まる（止まった魔物には触れても平気）。6秒に1回' },
    { name: '桃色の妖精', fac: 0, color: '#ff9ccf', skill: 'はねる屍', sk: 'none', how: '桃色の妖精が作った屍は、はねる床になる。そこから跳ぶと高く上がる' },
    { name: '赤の妖精', fac: 1, color: '#ff6b5a', skill: '炎で死なない', sk: 'none', how: '壁から吹く炎、燃える枝に触れても平気' },
    { name: '茶の妖精', fac: 1, color: '#c08a52', skill: '広い屍', sk: 'none', how: '茶の妖精が作った屍は、足場が広い' },
    { name: '灰の妖精', fac: 1, color: '#b8bcc4', skill: '足場を作る', sk: 'block', how: '技を押すと、その場に小さな足場を1つ作れる（1回の命で1つ）' },
    { name: '黒の妖精', fac: 2, color: '#3a3f4a', skill: '罠が見える', sk: 'none', how: '見えない棘が、はっきり見える' },
    { name: '青の妖精', fac: 2, color: '#5ab0ff', skill: '水を泳ぐ', sk: 'none', how: '水の中を自由に泳げる。息も切れない' },
    { name: '紫の妖精', fac: 2, color: '#a77bff', skill: '闇が見える', sk: 'none', how: '暗い層でも、まわりがよく見える' },
  ];
  // 屍の足場の幅：茶の妖精の屍は広い。合流した人数で少しずつ広がる（4人まで）
  const corW = (n, s) => (s === 4 ? 2.8 : 1.4) + 0.35 * (Math.min(n, 4) - 1);
  FT.corW = corW;
  // 屍の場所：0.25マスきざみの番号
  const ck = (qx, qy) => qy * 128 + qx;
  FT.ckey = ck;
  FT.kx = k => (k % 128) / 4; FT.ky = k => Math.floor(k / 128) / 4;
  // ---------- 仕掛けの位置（時刻だけで決まる） ----------
  // 槍・炎：壁から突き出る。warn：知らせ
  const pokeOut = (per, off, s) => { const f = (((s + off) % per) + per) % per / per; if (f < .55) return { out: 0, warn: f > .35 }; if (f < .62) return { out: (f - .55) / .07, warn: false }; if (f < .8) return { out: 1, warn: false }; if (f < .9) return { out: 1 - (f - .8) / .1, warn: false }; return { out: 0, warn: false }; };
  FT.pokeOut = pokeOut;
  // 燃える枝：0.5〜0.85 の間燃える。0.4〜0.5 は知らせ
  const burnAt = (per, off, s) => { const f = (((s + off) % per) + per) % per / per; return { on: f >= .5 && f < .85, warn: f >= .4 && f < .5 }; };
  FT.burnAt = burnAt;
  const mothAt = (m, s) => ({ x: m[1] + (m[2] - m[1]) * tri(s / m[3] + m[4]), y: m[0] + dsin((s + m[4]) * 0.4934) * (m[5] === 1 ? .35 : .7) });
  FT.mothAt = mothAt;
  // ---------- 1回の挑戦 ----------
  //  lv：層（floors.json の1つ）、cor：Map(key → {n, s, name})、opt：{ sp：種族, b：追い上げ（0〜10）, door：頂上の扉が開いているか }
  class Run {
    constructor(lv, cor, opt) {
      opt = opt || {};
      this.lv = lv; this.cor = cor; this.sp = opt.sp | 0; this.b = Math.max(0, Math.min(10, opt.b | 0)); this.door = !!opt.door;
      this.ft = FLY_TIME * (this.sp === 0 ? 1.3 : 1) * (1 + 0.03 * this.b);
      this.t = 0; this.over = false; this.clear = false; this.dead = null; this.place = null;
      this.p = { x: 10 - PW / 2, y: lv.h - 1 - PH, vx: 0, vy: 0, on: true, gauge: 1, face: 1, fly: false, jh: false, kh: false, lp: 0, top: lv.h - 1, onC: -1, wet: false };
      this.drops = []; this.dropLast = new Map();
      this.block = null; this.cool = 0; this.frz = new Map();   // 灰の足場・黄の技
      this.events = [];
      // 屍を並べておく（ぶつかりの計算を軽くする）
      this.cl = []; for (const [k, c] of cor) this.cl.push({ k, x: FT.kx(k), y: FT.ky(k), w: corW(c.n || 1, c.s | 0), s: c.s | 0, n: c.n || 1 });
    }
    ev(k, a) { this.events.push({ k, t: this.t, a }); }
    inWater(y) { for (const w of this.lv.wa || []) if (y >= w[0] && y <= w[1]) return true; return false; }
    mothFrozen(i) { const z = this.frz.get(i); return z && this.t < z.until ? z : null; }
    // ---------- 1つ進める。inp：1左 2右 4飛ぶ 8技 ----------
    step(inp) {
      if (this.over) return;
      this.t++;
      const p = this.p, lv = this.lv, s = this.t * DT;
      const L = inp & 1, R = (inp >> 1) & 1, J = (inp >> 2) & 1, K = (inp >> 3) & 1;
      const dir = R - L; if (dir) p.face = dir;
      const wet = this.inWater(p.y + PH / 2), blue = this.sp === 7, swim = wet && blue;
      if (wet && !p.wet) this.ev('splash');
      // 水から上へ飛び出す：勢いよく跳ねる（そのあと翅で飛べる）
      if (!wet && p.wet && p.vy < 0 && !blue) { p.vy = -9; p.lp = 1; this.ev('leap'); }
      p.wet = wet;
      const spd = wet && !blue ? MOVE * .6 : MOVE;
      p.vx += Math.sign(dir * spd - p.vx) * Math.min(Math.abs(dir * spd - p.vx), (p.on ? 60 : 40) * DT);
      // 技
      if (K && !p.kh) this.skill();
      p.kh = !!K;
      if (this.cool > 0) this.cool--;
      // 跳ぶ（立っている所から）。桃色の妖精の屍からは高く跳ぶ
      if (J && !p.jh && p.on) { const bounce = p.onC >= 0 && this.cl[p.onC] && this.cl[p.onC].s === 2; p.vy = -JUMP * (bounce ? 1.6 : 1); if (bounce) p.lp = 2; p.on = false; this.ev(bounce ? 'bounce' : 'jump'); }
      if (wet && !blue) {
        // 水の中：翅は使えない。押しているあいだ、ゆっくり泳いで上がる。息（ゲージ）が減る
        p.fly = false;
        if (p.vy < -2.6) p.vy += 9 * DT;
        else if (J && !p.on) p.vy = Math.max(-2.6, p.vy - 20 * DT);
        else p.vy = Math.min(2.2, p.vy + 9 * DT);
        if (!p.on) p.gauge = Math.max(0, p.gauge - DT / 3);
      } else if (swim) {
        // 青の妖精：水の中を自由に泳ぐ（息も切れない）
        p.fly = false;
        if (J) p.vy = Math.max(-5, p.vy - 30 * DT); else p.vy = Math.min(2, p.vy + 8 * DT);
      } else {
        if (p.lp && p.vy < -RISE_MAX) { p.vy += GRAV * DT; p.fly = false; }   // 水から跳ねた勢いのあいだは、翅を使わない
        else if ((p.lp = 0, p.fly = !p.on && J && p.gauge > 0)) { p.vy += (GRAV - FLY_PUSH) * DT; if (p.vy < -RISE_MAX) p.vy = -RISE_MAX; p.gauge = Math.max(0, p.gauge - DT / this.ft); }
        else p.vy = Math.min(FALLMAX, p.vy + GRAV * DT);
      }
      p.jh = !!J;
      // 動かす：横は幹の壁で止まる
      p.x = Math.max(1, Math.min(COLS - 1 - PW, p.x + p.vx * DT));
      const feet0 = p.y + PH; p.y += p.vy * DT; const feet1 = p.y + PH;
      // 頂上の扉：閉じていると、上に抜けられない
      if (lv.door && !this.door && p.y < 1.4) { p.y = 1.4; if (p.vy < 0) p.vy = 0; }
      // 足場：上から降りたときだけ乗れる（枝・屍・灰の足場）
      const wasOn = p.on; p.on = false; p.onC = -1;
      if (p.vy >= 0) {
        for (const b of lv.br) if (feet0 <= b[0] + .001 && feet1 >= b[0] && p.x + PW > b[1] && p.x < b[2]) { p.y = b[0] - PH; p.vy = 0; p.on = true; break; }
        if (!p.on) for (let i = 0; i < this.cl.length; i++) { const c = this.cl[i]; if (feet0 <= c.y + .001 && feet1 >= c.y && p.x + PW > c.x - c.w / 2 && p.x < c.x + c.w / 2) { p.y = c.y - PH; p.vy = 0; p.on = true; p.onC = i; break; } }
        const bk = this.block; if (!p.on && bk && feet0 <= bk.y + .001 && feet1 >= bk.y && p.x + PW > bk.x - 1.1 && p.x < bk.x + 1.1) { p.y = bk.y - PH; p.vy = 0; p.on = true; }
      }
      // つかまる：飛ぶのをやめて屍に近づくと、つかまって乗れる
      if (!p.on && !p.fly && (p.vy > -2 || wet || p.lp === 1)) {
        const f1 = p.y + PH;
        for (let i = 0; i < this.cl.length; i++) { const c = this.cl[i]; if (p.x + PW > c.x - c.w / 2 && p.x < c.x + c.w / 2 && f1 > c.y - .7 && f1 < c.y + .5) { p.y = c.y - PH; p.vy = 0; p.on = true; p.onC = i; this.ev('grab', i); break; } }
        const bk = this.block; if (!p.on && bk && p.x + PW > bk.x - 1.1 && p.x < bk.x + 1.1 && f1 > bk.y - .7 && f1 < bk.y + .5) { p.y = bk.y - PH; p.vy = 0; p.on = true; }
      }
      if (p.on && !wasOn) this.ev('land');
      if (p.on) { p.gauge = Math.min(1, p.gauge + DT * REFILL); if (!this.lastOn || p.y + PH < this.lastOn.y - .01) this.lastOn = { x: p.x, y: p.y + PH }; }
      if (p.y + PH < p.top) p.top = p.y + PH;
      // 出口
      if (p.y < 1.2) { this.clear = true; this.over = true; this.ev('clear'); return; }
      // ---------- 死ぬもの ----------
      const k = this.hazard(s); if (k) return this.die(k);
      if (!p.on && p.gauge <= 0 && !swim) return this.die(wet ? 'drown' : 'wing');
    }
    skill() {
      const p = this.p, sk = FT.SP[this.sp].sk;
      if (sk === 'freeze') {
        if (this.cool > 0) return;
        this.cool = 720; const s = this.t * DT, cx = p.x + PW / 2, cy = p.y + PH / 2;
        (this.lv.mo || []).forEach((m, i) => { const q = mothAt(m, s), dx = q.x - cx, dy = q.y - cy; if (dx * dx + dy * dy < 25) this.frz.set(i, { until: this.t + 300, x: q.x, y: q.y }); });
        this.ev('freeze');
      } else if (sk === 'block') {
        if (this.block) return;
        this.block = { x: Math.max(2.1, Math.min(COLS - 2.1, p.x + PW / 2)), y: p.y + PH + .02 };
        this.ev('block');
      }
    }
    hit(x, y, w, h) { const p = this.p, m = .08; return p.x + PW - m > x && p.x + m < x + w && p.y + PH - m > y && p.y + m < y + h; }
    // 当たると死ぬもの。赤の妖精は炎で死なない
    hazard(s) {
      const p = this.p, lv = this.lv, red = this.sp === 3;
      for (const q of lv.sp || []) { const o = pokeOut(q[3], q[4], s); if (o.out > 0) { const len = q[2] * o.out, x = q[1] < 0 ? 1 : COLS - 1 - len; if (this.hit(x, q[0] - .25, len, .5)) return 'spear'; } }
      if (!red) {
        for (const q of lv.fj || []) { const o = pokeOut(q[3], q[4], s); if (o.out > 0) { const len = q[2] * o.out, x = q[1] < 0 ? 1 : COLS - 1 - len; if (this.hit(x, q[0] - .4, len, .8)) return 'fire'; } }
        if (p.on && p.onC < 0) for (const b of lv.br) if (b[3] && Math.abs(p.y + PH - b[0]) < .01 && p.x + PW > b[1] && p.x < b[2] && burnAt(b[3], b[4], s).on) return 'burn';
      }
      const mo = lv.mo || [];
      for (let i = 0; i < mo.length; i++) { if (this.mothFrozen(i)) continue; const q = mothAt(mo[i], s); if (this.hit(q.x - .42, q.y - .36, .84, .72)) return mo[i][5] === 1 ? 'bee' : 'moth'; }
      for (const q of lv.tn || []) { const dx = p.x + PW / 2 - q[0], dy = p.y + PH / 2 - q[1]; if (dx * dx + dy * dy < .5) return 'thorn'; }
      // 実：一定の間隔で落ちる。枝や屍に当たると割れる
      const frs = lv.fr || [];
      for (let i = 0; i < frs.length; i++) {
        const fr = frs[i], f = (((s + fr[3]) % fr[2]) + fr[2]) % fr[2] / fr[2], k = Math.floor((s + fr[3]) / fr[2]);
        if (f > .3 && this.dropLast.get(i) !== k) { this.dropLast.set(i, k); this.drops.push({ x: fr[0], y: fr[1] - 12, vy: 0 }); }
      }
      let hitD = false;
      for (const d of this.drops) {
        if (d.done) continue; const y0 = d.y; d.vy = Math.min(16, d.vy + 24 * DT); d.y += d.vy * DT;
        for (const b of lv.br) if (y0 <= b[0] && d.y >= b[0] && d.x + .4 > b[1] && d.x - .4 < b[2]) d.done = 1;
        if (!d.done) for (const c of this.cl) if (y0 <= c.y && d.y >= c.y && Math.abs(d.x - c.x) < c.w / 2 + .3) { d.done = 1; c.shield = this.t; break; }
        if (!d.done && this.hit(d.x - .35, d.y - .35, .7, .7)) hitD = true;
      }
      if (this.drops.length > 40) this.drops = this.drops.filter(d => !d.done && d.y < lv.h + 2);
      if (hitD) return 'fruit';
      return null;
    }
    // ---------- 死ぬ：屍の置き場所を決める（合流するか、新しく浮かぶか） ----------
    die(kind) {
      this.over = true; this.dead = kind;
      const p = this.p, lv = this.lv, x = p.x + PW / 2, y = p.y + PH;
      let best = -1, bd = 1e9;
      for (let i = 0; i < this.cl.length; i++) { const c = this.cl[i], dx = c.x - x, dy = c.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      if (best >= 0 && bd < MERGE * MERGE) this.place = { k: this.cl[best].k, merge: true };
      else if (y < lv.h - 1.5) { const qx = Math.round(Math.max(1.8, Math.min(COLS - 1.8, x)) * 4), qy = Math.round(y * 4); this.place = { k: ck(qx, qy), merge: false }; }
      else this.place = { k: -1, ground: true };
      this.ev('die', kind);
      return this.place;
    }
  }
  FT.Run = Run;
  // ---------- 入力の記録（変わった所だけ） ----------
  FT.Rec = class {
    constructor() { this.a = []; this.last = -1; }
    put(t, b) { if (b !== this.last) { this.a.push(t, b); this.last = b; } }
    str() { return this.a.map(v => v.toString(36)).join('.'); }
    static parse(s) { const a = String(s || '').split('.').filter(Boolean).map(v => parseInt(v, 36)); let i = 0, cur = 0; return t => { while (i < a.length && a[i] <= t) { cur = a[i + 1]; i += 2; } return cur; }; }
  };
  // ---------- 屍の一覧を文字にする（その挑戦の始まりの屍） ----------
  //  1つの屍：(場所×9＋種族)×5＋(人数−1、5人まで) を36進数で
  FT.corStr = cor => { const a = []; for (const [k, c] of cor) a.push(((k * 9 + (c.s | 0)) * 5 + (Math.min(5, c.n || 1) - 1))); return a.sort((x, y) => x - y).map(v => v.toString(36)).join('.'); };
  FT.corParse = s => { const m = new Map(); for (const v of String(s || '').split('.')) { if (!v) continue; const n = parseInt(v, 36); if (!(n >= 0)) continue; const k = Math.floor(n / 45), sp = Math.floor(n / 5) % 9, c = n % 5 + 1; m.set(k, { n: c, s: sp, name: '' }); } return m; };
  // 記録を再生して、ゴールできるか
  FT.replay = function (lv, cor, recStr, opt, lim) {
    const r = new Run(lv, cor, opt), inp = FT.Rec.parse(recStr);
    while (!r.over && r.t < lim) r.step(inp(r.t + 1));
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
