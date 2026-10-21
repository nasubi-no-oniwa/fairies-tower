// =============================================
//  Fairies' Tower  画面と流れ
//   タイトル（世界樹の絵・妖精をえらぶ）→ 陣営の最新の層から昇る
//   死ぬ：その場に屍が浮かぶ（同じ陣営で共有）。すぐ次の名前で昇りなおす
//   越える：次の層へ。はじめて越えた人は碑に名前が残る。第100層の頂で、陣営の勝ち
// =============================================
(function (G) {
  const FT = G.FT, N = FT.NET, V = FT.V, SND = FT.SND, PW = FT.PHYS.PW, PH = FT.PHYS.PH, COLS = FT.COLS;
  FT.VER = '2';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('ja-JP');
  const GAME_URL = G.FT_GAME_URL || location.href.split(/[?#]/)[0];
  const TAGS = '#FairiesTower #gamedev #ゲーム制作';
  const OFFLINE = !N.FACS.some(f => N.ready(f));
  // ---------- 名前（毎回ちがう） ----------
  const PRE = ['うたう', 'ちいさな', 'あおい', 'ねむれる', 'ほしふる', 'さいごの', 'つきなき', 'あさやけの', 'ふるえる', 'みどりの', 'はじめての', 'ゆうぐれの', 'まよえる', 'しろい', 'かけだしの', 'ひとりの', 'わすれられた', 'こごえた', 'ねぼけた', 'まっすぐな', 'おくびょうな', 'むこうみずな', 'うつろな', 'とおくの'];
  const NAME = ['ルカ', 'イオ', 'ナギ', 'ツバキ', 'ハク', 'セツ', 'マオ', 'リク', 'モモ', 'スズ', 'ヒバリ', 'フウ', 'コハ', 'ウタ', 'ソラ', 'アオ', 'シノ', 'テオ', 'ニコ', 'ミナ', '旅人', '見習い', '弓兵', '吟遊詩人', '鍛冶屋', '薬師', '巡礼者', '学者'];
  const newName = () => (PRE[Math.floor(Math.random() * PRE.length)] + NAME[Math.floor(Math.random() * NAME.length)]).slice(0, 12);
  // ---------- 自分の記録（この端末） ----------
  const ME = Object.assign({ sp: null, best: {}, dead: 0, tut: 0, ok: {}, ng: {}, lok: {}, xid: '' }, N.store('ft_me') || {});
  const saveMe = () => N.store('ft_me', ME);
  const facOf = sp => FT.SP[sp].fac, fidOf = sp => N.FACS[FT.SP[sp].fac];
  if (ME.sp !== null && ME.sp !== undefined) N.fac = fidOf(ME.sp);
  // ---------- 層 ----------
  let FLOORS = null; const LV = {};
  async function getFloors() { if (FLOORS) return FLOORS; const r = await fetch('data/floors.json?v=' + FT.VER); FLOORS = await r.json(); return FLOORS; }
  function getLevel(f) { const key = N.fac + f; if (!LV[key]) LV[key] = Object.assign({}, FLOORS[f - 1]); return LV[key]; }
  const themeSong = lv => lv.f === 100 ? 10 : (lv.th && lv.th.length ? lv.th[0] + 1 : 0);
  // =============================================
  //  全体の状態（自分の陣営）
  // =============================================
  //  「開いた」の印（ft_open）は信じない。GitHub のまとめで確かめ済みの層・管理人が確かめた層・
  //  この端末で越えた記録を計算しなおして確かめた層だけ開く
  const W = { open: {}, stat: {}, okSnap: {}, ckpt: null, tops: {}, ends: {}, latest: 1, done: false, loaded: false };
  function okFloor(f) {
    if (OFFLINE) return !!ME.lok[f];
    if (W.okSnap[f]) return true;
    const o = W.open[f]; if (!o) return false;
    if (W.ckpt !== null && f <= W.ckpt) return true;
    const v = (ME.ok[N.fac] || {})[f]; return !!(v && v.t === o.t);
  }
  function opener(f) {
    if (W.okSnap[f]) return W.okSnap[f];
    const v = (ME.ok[N.fac] || {})[f], o = W.open[f];
    if (v && !v.mine) return v;
    return o ? { n: N.cleanName(o.n) || '名無し', x: N.cleanX(o.x), t: o.t } : null;
  }
  function computeLatest() { let L = 1; while (L <= 100 && okFloor(L)) L++; W.done = L > 100; W.latest = Math.min(100, L); W.tops[N.fac] = Math.max(W.tops[N.fac] || 1, W.done ? 101 : W.latest); return W.latest; }
  const leadTop = () => Math.max(1, ...N.FACS.map(f => Math.min(100, W.tops[f] || 1)));
  const otherTops = () => N.FACS.filter(f => f !== N.fac).map(f => Math.min(100, W.tops[f] || 1));
  const ctxFor = f => ({ maxB: V.bonusFor(f, leadTop()), door: f === 100 && V.doorOpen(otherTops()) });
  // ほかの人の記録を確かめるとき：見ている高さが少し古い人もいるので、追い上げの上限に2層ぶん余裕をもたせる
  const vctxFor = f => ({ maxB: V.bonusFor(f, leadTop() + 2), door: f === 100 && V.doorOpen(otherTops()), play: ctxFor(f) });
  const ended = () => { for (const f of N.FACS) if (W.ends[f]) return W.ends[f]; return null; };
  let refAt = 0, refP = null;
  async function refresh(force) {
    if (OFFLINE) { computeLatest(); title.paint(); return; }
    if (refP) return refP;
    if (!force && W.loaded && Date.now() - refAt < 60000) { computeLatest(); title.paint(); return; }
    refAt = Date.now();
    refP = (async () => {
      try { const o = await N.overview(); W.open = Object.assign({}, o.open); W.stat = o.stat || {}; W.okSnap = o.okSnap || {}; W.ckpt = o.ckpt; W.tops = Object.assign(W.tops, o.tops); W.ends = o.ends || {}; W.loaded = true; } catch (e) { W.loaded = false; }
      computeLatest(); title.paint();
      if (W.loaded && !ended()) verifyChain().then(() => title.paint()).catch(() => { });
    })().finally(() => { refP = null; });
    return refP;
  }
  // 下から順に、まだ確かめていない「開いた」層を確かめる
  let chainP = null;
  function verifyChain() {
    if (chainP) return chainP;
    const fac = N.fac;
    chainP = (async () => {
      for (let n = 0; n < 120 && fac === N.fac; n++) {
        const f = computeLatest(); if (W.done) break;
        const o = W.open[f]; if (!o) break;
        const ng = (ME.ng[fac] || {})[f]; if (ng && ng.t === o.t && Date.now() - ng.at < 300000) break;
        const lv = getLevel(f); lv._ctx = vctxFor(f);
        let c = null;
        try { await N.loadCells(lv); c = await N.firstClear(lv); } catch (e) { break; }
        if (fac !== N.fac || W.open[f] !== o) continue;
        if (c && c.wait) { await new Promise(r => setTimeout(r, 1500)); continue; }
        if (c) { (ME.ok[fac] = ME.ok[fac] || {})[f] = { t: o.t, id: c.id, n: N.cleanName(c.n) || '名無し', x: N.cleanX(c.x) }; delete (ME.ng[fac] || {})[f]; saveMe(); computeLatest(); title.paint(); }
        else { (ME.ng[fac] = ME.ng[fac] || {})[f] = { t: o.t, at: Date.now() }; saveMe(); break; }
      }
    })().finally(() => { chainP = null; });
    return chainP;
  }
  const facDead = () => { let n = 0; for (const k in W.stat) n += (W.stat[k] && W.stat[k].d) || 0; return n; };
  // ---------- 画面 ----------
  function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
  function modal(id, on) { $(id).classList.toggle('on', !!on); }
  let toastT = 0;
  function toast(a, b, ms) { const e = $('toast'); e.innerHTML = esc(a) + (b ? `<small>${esc(b)}</small>` : ''); e.classList.add('in'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('in'), ms || 1700); }
  // =============================================
  //  タイトル
  // =============================================
  function buildPicker() {
    const box = $('facs'); box.innerHTML = '';
    FT.FAC.forEach((F, fi) => {
      const col = document.createElement('div'); col.className = 'fac'; col.style.color = F.color;
      col.innerHTML = `<h3>${esc(F.name)}</h3>`;
      FT.SP.forEach((sp, si) => {
        if (sp.fac !== fi) return;
        const b = document.createElement('button'); b.className = 'sp'; b.dataset.sp = si; b.style.color = F.color;
        b.innerHTML = `<i style="background:${sp.color}"></i><span style="color:var(--ink)">${esc(sp.name)}</span>`;
        b.onclick = () => pickSp(si);
        col.appendChild(b);
      });
      box.appendChild(col);
    });
  }
  function pickSp(si) {
    SND.unlock(); SND.se('tap');
    const before = ME.sp === null || ME.sp === undefined ? null : fidOf(ME.sp);
    ME.sp = si; saveMe(); N.fac = fidOf(si);
    title.paint();
    if (before !== N.fac) { W.open = {}; W.stat = {}; W.okSnap = {}; W.ckpt = null; W.loaded = false; refresh(true); }
  }
  const title = {
    paint() {
      const L = W.latest, lv = FLOORS && FLOORS[L - 1], has = ME.sp !== null && ME.sp !== undefined;
      const F = has ? FT.FAC[facOf(ME.sp)] : null;
      $('tLatest').innerHTML = !has ? 'まず妖精をえらぶ<small></small>' : W.done ? `頂上に到達<small>${esc(F.name)}</small>` : `第${L}層<small>${esc(lv ? lv.name : '')}</small>`;
      $('tLatest').style.color = F ? F.color : '';
      $('tDead').textContent = fmt(OFFLINE ? ME.dead : facDead());
      const subs = [];
      if (has) {
        subs.push(`${F.name}の最前線${OFFLINE ? '（この端末だけで遊んでいます）' : ''}`);
        const op = L > 1 ? opener(L - 1) : null; if (op) subs.push(`第${L - 1}層を最初に越えたのは「${op.n}」${op.x ? '（@' + op.x + '）' : ''}`);
        const b = ctxFor(L).maxB; if (b > 0) subs.push(`追い上げ中：翅が${b * 3}%長くもつ`);
        if (L === 100 && !W.done) subs.push(ctxFor(100).door ? '頂上の扉は開いている' : `頂上の扉は閉じている（ほかの陣営のどれかが第${V.DOOR_AT}層に着くと開く）`);
      }
      $('tSub').textContent = subs.join('　／　');
      for (const b of document.querySelectorAll('.sp')) b.classList.toggle('on', +b.dataset.sp === ME.sp);
      if (has) { const sp = FT.SP[ME.sp]; $('spInfo').innerHTML = `<b style="color:${sp.color}">${esc(sp.name)}</b>（${esc(F.name)}）　<b>${esc(sp.skill)}</b><br>${esc(sp.how)}`; }
      else $('spInfo').textContent = '9つの妖精から1つをえらぶ。妖精の色で、どの陣営に入るかが決まる。陣営ごとに、べつべつの世界樹を昇る。';
      const end = ended();
      $('endBanner').hidden = !end;
      if (end) { const wf = FT.FAC[N.FACS.indexOf(end.w)]; $('endBanner').innerHTML = `<b style="color:${wf ? wf.color : ''}">${esc(wf ? wf.name : '')}</b>が、世界樹の頂にたどり着いた。<br>ゲームは終わりました。いまの世界樹は、そのときのまま残っています。<br>これから昇っても、屍は増えません。`; }
      $('bGo').disabled = !has;
      $('bGo').textContent = !has ? '妖精をえらんでください' : W.done ? '頂上をながめる' : `第${L}層から昇る${end ? '（記録は残りません）' : ''}`;
      drawTree($('tree'), 1);
    },
  };
  // 世界樹の絵：3つの陣営がどこまで昇ったか
  function drawTree(cv, dprMax) {
    const dpr = Math.min(dprMax ? 2 : 1, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
    const Wd = cv._fixed ? cv.width : Math.max(10, Math.round(r.width * dpr)), Hd = cv._fixed ? cv.height : Math.max(10, Math.round(r.height * dpr));
    if (!cv._fixed) { cv.width = Wd; cv.height = Hd; }
    const g = cv.getContext('2d'), u = Math.min(Hd / 300, Wd / 360);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, Hd); bg.addColorStop(0, '#0e2c33'); bg.addColorStop(1, '#050d11'); g.fillStyle = bg; g.fillRect(0, 0, Wd, Hd);
    // 星
    for (let i = 0; i < 60; i++) { const x = (i * 97.3) % Wd, y = (i * 53.1) % (Hd * .7); g.fillStyle = `rgba(191,233,255,${.15 + (i % 5) * .08})`; g.fillRect(x, y, 1.5 * u, 1.5 * u); }
    const top = 28 * u, bot = Hd - 24 * u, cx = Wd / 2, yOf = f => bot - (bot - top) * (Math.min(100, Math.max(1, f)) - 1) / 99;
    // 幹と梢
    g.fillStyle = '#2a1d16'; g.beginPath(); g.moveTo(cx - 34 * u, bot + 20 * u); g.quadraticCurveTo(cx - 14 * u, bot - 40 * u, cx - 10 * u, top + 20 * u); g.lineTo(cx + 10 * u, top + 20 * u); g.quadraticCurveTo(cx + 14 * u, bot - 40 * u, cx + 34 * u, bot + 20 * u); g.fill();
    g.fillStyle = '#163a2a'; for (let i = 0; i < 9; i++) { const y = top + 12 * u + i * 22 * u, w = (40 + i * 9) * u; g.beginPath(); g.ellipse(cx + (i % 2 ? 16 : -16) * u, y, w, 9 * u, 0, 0, 7); g.fill(); }
    const crown = g.createRadialGradient(cx, top, 2, cx, top, 60 * u); crown.addColorStop(0, 'rgba(255,240,190,.55)'); crown.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = crown; g.fillRect(cx - 70 * u, top - 40 * u, 140 * u, 90 * u);
    // 目盛り
    g.font = `${10 * u}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'left'; g.fillStyle = 'rgba(191,233,255,.45)';
    for (const f of [1, 25, 50, 75, 100]) { const y = yOf(f); g.fillRect(10 * u, y, Wd - 20 * u, .6 * u); g.fillText(f === 100 ? '頂' : `第${f}層`, 10 * u, y - 3 * u); }
    // 3つの陣営
    N.FACS.forEach((F, i) => {
      const fc = FT.FAC[i], t = Math.min(101, W.tops[F] || 1), y = yOf(Math.min(100, t)), x = i === 0 ? cx - 26 * u : i === 1 ? cx + 4 * u : cx + 30 * u;
      g.strokeStyle = fc.color; g.lineWidth = 4 * u; g.globalAlpha = .9; g.beginPath(); g.moveTo(x, bot); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = fc.color; g.beginPath(); g.arc(x, y, 6 * u, 0, 7); g.fill();
      const lx = i === 0 ? cx - 48 * u : cx + 48 * u;
      g.textAlign = i === 0 ? 'right' : 'left'; g.font = `700 ${11 * u}px ${getComputedStyle(document.body).fontFamily}`;
      let ly = y - 8 * u; if (i === 2 && Math.abs(yOf(Math.min(100, W.tops.r || 1)) - y) < 16 * u) ly = yOf(Math.min(100, W.tops.r || 1)) - 8 * u + 15 * u;
      ly = Math.max(top + 4 * u, Math.min(bot - 2 * u, ly));
      g.fillText(`${fc.name} ${t > 100 ? '頂' : '第' + t + '層'}`, lx, ly + 4 * u);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
    });
    // あなた
    if (ME.sp !== null && ME.sp !== undefined) {
      const best = ME.best[N.fac] || 0;
      if (best) { const fi = N.FACS.indexOf(N.fac), x = fi === 0 ? cx - 26 * u : fi === 1 ? cx + 4 * u : cx + 30 * u, y = yOf(best); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 12 * u, y); g.lineTo(x - 20 * u, y - 5 * u); g.lineTo(x - 20 * u, y + 5 * u); g.fill(); g.textAlign = 'right'; g.font = `700 ${10 * u}px ${getComputedStyle(document.body).fontFamily}`; g.fillText('あなた', x - 23 * u, y + 3.5 * u); }
    }
  }
  // =============================================
  //  遊ぶ
  // =============================================
  const cv = $('cv'), g = cv.getContext('2d');
  let S_ = 30, VH = 20, dpr = 1;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); cv.width = Math.max(10, Math.round(r.width * dpr)); cv.height = Math.max(10, Math.round(r.height * dpr)); S_ = cv.width / COLS; VH = cv.height / S_; }
  addEventListener('resize', () => { resize(); if ($('title').classList.contains('on')) drawTree($('tree'), 1); });
  const S = { lv: null, cor: new Map(), run: null, rec: null, name: '', keys: { l: 0, r: 0, j: 0, k: 0 }, acc: 0, deadT: 0, cam: 0, fx: [], shake: 0, paused: false, deathsHere: 0, nextCor: null, startCor: '', opt: null, mine: new Map(), syncAt: 0 };
  FT.S = S;
  async function startFloor(f, opt) {
    opt = opt || {};
    if (!opt.watch && (ME.sp === null || ME.sp === undefined)) return;
    SND.unlock(); if (!opt.watch) N.warm();
    await getFloors();
    show('game'); resize(); $('loading').classList.add('on');
    const lv = getLevel(f); lv._ctx = vctxFor(f);
    let cor = new Map();
    if (OFFLINE) cor = localCor(f);
    else { try { cor = await N.loadCells(lv); } catch (e) { toast('みんなの屍を読みこめませんでした', 'この端末の分だけで遊べます', 2600); } }
    $('loading').classList.remove('on');
    S.lv = lv; S.cor = cor; S.nextCor = null; S.mine = new Map(); S.deathsHere = 0; S.fx = [];
    S.latest = f === W.latest && !W.done;
    S.watch = !!opt.watch; S.replay = null; S.follow = false;
    $('game').classList.toggle('watching', S.watch);
    if (S.watch) { startWatch(lv); return; }
    const F = FT.FAC[facOf(ME.sp)], sp = FT.SP[ME.sp];
    $('hFloor').innerHTML = `第${f}層<small>${esc(lv.name)}</small>`;
    $('hFac').innerHTML = `<span style="color:${F.color}">${esc(F.name)}</span>・<span style="color:${sp.color === '#3a3f4a' ? '#9aa3b4' : sp.color}">${esc(sp.name)}</span>`;
    $('skName').textContent = sp.sk === 'none' ? '（いつも）' : sp.skill;
    $('bSk').classList.toggle('off', sp.sk === 'none');
    if (!ME.best[N.fac] || ME.best[N.fac] < f) { ME.best[N.fac] = f; saveMe(); }
    updateHud();
    SND.bgm(themeSong(lv));
    spawn(true);
    if (!ME.tut) { ME.tut = 1; saveMe(); openHow(); }
    else if (lv.th && lv.th.length && lv.f > 5) { const names = lv.th.map(t => FT.SP[t].name).join('・'); toast(`第${f}層　${lv.name}`, `${names}が得意な層`, 2400); }
  }
  function spawn(first) {
    if (S.nextCor) { S.cor = S.nextCor; S.nextCor = null; }
    S.name = newName();
    const c = ctxFor(S.lv.f);
    S.opt = { sp: ME.sp, b: c.maxB, door: OFFLINE ? true : c.door };
    S.run = new FT.Run(S.lv, S.cor, S.opt);
    S.rec = new FT.Rec(); S.acc = 0; S.deadT = 0;
    S.startCor = FT.corStr(S.cor);
    S.cam = Math.max(0, S.lv.h - VH);
    $('hName').textContent = S.name;
    void first;
  }
  function updateHud() { const st = W.stat[S.lv.f] || {}; $('hDead').textContent = fmt(OFFLINE ? S.deathsHere : (st.d || 0) + N.pending()); }
  // ---------- 1こまずつ ----------
  let lastNow = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!S.lv || !$('game').classList.contains('on')) { lastNow = now; return; }
    let dt = Math.min(0.1, (now - lastNow) / 1000 || 0); lastNow = now;
    if (S.paused) dt = 0;
    if (S.watch) { watchStep(dt); draw(); return; }
    const run = S.run;
    if (run && !run.over) {
      S.acc += dt;
      while (S.acc >= FT.DT) {
        S.acc -= FT.DT;
        const b = S.auto ? S.auto(run) : (S.keys.l ? 1 : 0) | (S.keys.r ? 2 : 0) | (S.keys.j ? 4 : 0) | (S.keys.k ? 8 : 0);
        S.rec.put(run.t + 1, b);
        run.step(b);
        events(run);
        if (run.over) { if (run.clear) onClear(); else onDie(); break; }
      }
      // カメラ
      const want = Math.max(0, Math.min(S.lv.h - VH, run.p.y - VH * .55));
      S.cam += (want - S.cam) * Math.min(1, dt * 8);
    }
    draw();
  }
  function events(run) {
    for (const e of run.events) {
      switch (e.k) {
        case 'jump': SND.se('jump'); break;
        case 'bounce': SND.se('bounce'); break;
        case 'land': SND.se('land'); break;
        case 'grab': SND.se('grab'); { const c = run.cl[e.a]; if (c) c.glow = 1; } break;
        case 'splash': SND.se('splash'); break;
        case 'leap': SND.se('leap'); break;
        case 'freeze': SND.se('freeze'); S.fx.push({ ring: 1, x: run.p.x + PW / 2, y: run.p.y + PH / 2, life: .6, c: '#ffd84a' }); break;
        case 'block': SND.se('block'); break;
      }
    }
    run.events.length = 0;
  }
  // ---------- 死んだ ----------
  const KIND = { wing: '翅が尽きて、力尽きた', drown: '水の中で、息が尽きた', spear: '幹の槍に貫かれた', fire: '炎に焼かれた', burn: '燃える枝で焼かれた', moth: '蛾に触れた', bee: '蜂に刺された', thorn: '見えない棘に刺さった', fruit: '落ちてきた実に打たれた' };
  function onDie() {
    const run = S.run, pl = run.place, lv = S.lv, name = S.name, f = lv.f;
    SND.se('die'); S.shake = .5;
    const x = run.p.x + PW / 2, y = run.p.y + PH;
    for (let i = 0; i < 18; i++) S.fx.push({ x, y: y - .4, vx: (Math.random() - .5) * 5, vy: -Math.random() * 4, life: .9, c: '#bfe9ff' });
    ME.dead++; saveMe(); S.deathsHere++;
    let sub = '';
    if (pl.k >= 0) {
      const c = S.cor.get(pl.k);
      if (pl.merge && c) { c.n++; c.glow = 1; sub = `「${c.name}」の屍に合流した（${fmt(c.n)}人が眠る）`; setTimeout(() => SND.se('merge'), 200); }
      else { S.cor.set(pl.k, { n: 1, s: ME.sp, name, t: Date.now(), glow: 1, mine: 1 }); S.mine.set(pl.k, S.cor.get(pl.k)); sub = 'ここが、あとから来る仲間の足場になる'; setTimeout(() => SND.se('pile'), 200); }
    } else sub = '根もとで倒れた。屍は残らない';
    toast(`${name}は${KIND[run.dead] || '力尽きた'}`, sub, 1700);
    const m = Math.round(Math.max(0, Math.min(1, (lv.h - 1 - run.p.top) / (lv.h - 2.2))) * 1000);
    if (OFFLINE) saveLocalCor(f, S.cor);
    else if (!ended()) {
      const k = pl.k, myCor = S.cor;
      N.died({ f, k, merge: !!pl.merge, s: ME.sp, name, rec: S.rec.str(), cor: S.startCor, ticks: run.t, b: S.opt.b, m })
        .then(() => { const st = W.stat[f] = W.stat[f] || {}; st.d = (st.d || 0) + 1; updateHud(); refreshStat(); })
        .catch(() => { const c = k >= 0 && myCor.get(k); if (c && c.mine && c.n <= 1) myCor.delete(k); });   // 送れなかった屍は、この端末でも消す（あとの挑戦の確かめが通らなくなるので）
      // ほかの人の屍の読みなおしは、20秒に1回まで
      if (Date.now() - S.syncAt > 20000) { S.syncAt = Date.now(); const lvNow = lv; N.syncCells(lvNow, S.mine).then(mp => { if (mp && S.lv === lvNow) { for (const [k2, c2] of S.cor) if (c2.mine && !mp.has(k2)) mp.set(k2, c2); S.nextCor = mp; } }).catch(() => { }); }
    }
    updateHud();
    setTimeout(() => { if (S.run === run && $('game').classList.contains('on')) spawn(false); }, 1000);
  }
  let statT = 0;
  function refreshStat() { if (OFFLINE || Date.now() - statT < 120000) return; statT = Date.now(); N.floorStat(S.lv.f).then(v => { if (v) { W.stat[S.lv.f] = v; updateHud(); } }).catch(() => { }); }
  // ---------- 越えた ----------
  async function onClear() {
    const run = S.run, lv = S.lv, f = lv.f, ticks = run.t;
    SND.se('clear'); SND.bgm(null);
    for (let i = 0; i < 30; i++) S.fx.push({ x: run.p.x + PW / 2, y: run.p.y, vx: (Math.random() - .5) * 7, vy: -Math.random() * 6, life: 1.2, c: '#ffe080' });
    const deadN = Math.max((W.stat[f] && W.stat[f].d) || 0, [...S.cor.values()].reduce((a, c) => a + (c.nAll || c.n), 0));
    const wasOpen = okFloor(f), isFirst = S.latest && !wasOpen;
    const F = FT.FAC[facOf(ME.sp)];
    $('clBig').innerHTML = f === 100 ? `<b>${fmt(deadN)}</b>人の屍を越えて<br>世界樹の頂へ` : `<b>${fmt(deadN)}</b>人の屍を越えて<br>第${f}層突破！`;
    $('clSub').textContent = `${S.name}（${F.name}）　${(ticks / 120).toFixed(1)}秒`;
    $('clFirst').hidden = true; $('clX').value = ME.xid || '';
    $('clNext').hidden = f >= 100;
    $('clNext').textContent = `第${Math.min(100, f + 1)}層へ`;
    $('clMsg').textContent = '';
    if (!ME.best[N.fac] || ME.best[N.fac] < Math.min(100, f + 1)) { ME.best[N.fac] = Math.min(100, f + 1); saveMe(); }
    S.clearInfo = { f, name: S.name, ticks, deadN, isFirst };
    modal('oClear', 1);
    if (OFFLINE) { ME.lok[f] = 1; saveMe(); computeLatest(); if (f === 100) $('clMsg').textContent = '世界樹の頂にたどり着いた（この端末だけの記録です）'; return; }
    if (ended()) { $('clMsg').textContent = 'ゲームは終わっているので、記録は残りません'; return; }
    $('clMsg').textContent = '記録を送っています…';
    try {
      const r = await N.clear(lv, { name: S.name, rec: S.rec.str(), cor: S.startCor, ticks, s: ME.sp, b: S.opt.b, full: !wasOpen || f === 100 });
      const id = r && r.id; S.clearInfo.id = id; S.clearInfo.opened = !!(r && r.opened);
      if (r && r.opened) { $('clFirst').hidden = false; $('clMsg').textContent = f === 100 ? `${F.name}が、世界樹の頂にたどり着いた！` : `第${f + 1}層が、いま開いた。あなたが一番乗り`; SND.se('open'); }
      else $('clMsg').textContent = f === 100 ? '頂の碑に、あなたの名前が刻まれた' : (wasOpen ? '' : 'ひと足先に越えた仲間がいました。あなたの記録も残りました');
      if (!wasOpen && id) {
        // 自分で越えたので、この端末では確かめずに開く
        const o = await N.rest('ft_open/' + f).catch(() => null);
        if (o && typeof o.t === 'number') { W.open[f] = o; (ME.ok[N.fac] = ME.ok[N.fac] || {})[f] = r.opened ? { t: o.t, id, n: S.name, x: '' } : { t: o.t, id, n: S.name, x: '', mine: 1 }; saveMe(); computeLatest(); }
      }
      const st = W.stat[f] = W.stat[f] || {}; st.c = (st.c || 0) + 1;
    } catch (e) {
      $('clMsg').textContent = '記録を送れませんでした（混みあっているか、電波が弱いです）。';
    }
  }
  $('clXsave').onclick = async () => {
    const x = N.cleanX($('clX').value), ci = S.clearInfo;
    if (!x) { toast('IDの形がちがいます', '英数字と _ で15文字まで'); return; }
    ME.xid = x; saveMe();
    if (!ci || !ci.id) { toast('記録を送っている途中です', '少し待ってもう一度'); return; }
    try { await N.setXid(ci.f, ci.id, x, ci.opened); const v = (ME.ok[N.fac] || {})[ci.f]; if (v && v.id === ci.id) { v.x = x; saveMe(); } if (W.open[ci.f]) W.open[ci.f].x = x; $('clFirst').hidden = true; toast('碑に刻みました', '@' + x); } catch (e) { toast('書きこめませんでした', '15分をすぎると、書きこめません'); }
  };
  $('clXskip').onclick = () => { $('clFirst').hidden = true; toast('名前だけが刻まれます'); };
  $('clNext').onclick = () => { modal('oClear', 0); startFloor(Math.min(100, S.lv.f + 1)); };
  $('clTitle').onclick = () => { modal('oClear', 0); toTitle(); };
  $('clShare').onclick = () => { openShare(S.clearInfo && S.clearInfo.f === 100 ? 'summit' : 'clear'); };
  // ---------- この端末だけで遊ぶとき（つなぎ先がまだないとき）の屍 ----------
  function localCor(f) { const v = N.store('ft_local_' + f) || []; const m = new Map(); for (const [k, n, s, name] of v) m.set(k, { n, s, name }); return m; }
  function saveLocalCor(f, cor) { const a = []; for (const [k, c] of cor) a.push([k, c.n, c.s, c.name]); N.store('ft_local_' + f, a.slice(-400)); }
  // =============================================
  //  描く
  // =============================================
  const facColor = () => FT.FAC[Math.max(0, N.FACS.indexOf(N.fac))].color;
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  let dark = null;
  function draw() {
    const lv = S.lv, run = S.watch && S.replay ? S.replay.run : S.run; if (!lv || !run) return;
    const p = run.p, s = run.t * FT.DT, cam = S.cam, fcol = facColor(), sp = S.watch ? (S.replay ? run.sp : -1) : ME.sp, seeAll = S.watch;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const grd = g.createLinearGradient(0, 0, 0, cv.height); grd.addColorStop(0, '#0d2a2e'); grd.addColorStop(1, '#050c10'); g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
    let sx = 0; if (S.shake > 0) { S.shake = Math.max(0, S.shake - 1 / 60); sx = (Math.random() - .5) * S.shake * .3; }
    g.setTransform(S_, 0, 0, S_, sx * S_, -cam * S_);
    const vis = (y, m) => y > cam - (m || 1) && y < cam + VH + (m || 1);
    // 胞子
    for (let i = 0; i < 40; i++) { const x = 1.5 + ((i * 7.31) % 17), yy = cam + VH - (((i * 13.7 + s * (0.3 + (i % 5) * .08)) % (VH + 2)) - 1); g.globalAlpha = .18 + .12 * Math.sin(s * 2 + i); g.fillStyle = '#bfe9ff'; g.beginPath(); g.arc(x + Math.sin(s + i) * .3, yy, .06, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    // 水
    for (const w of lv.wa || []) { if (!vis(w[0], 6) && !vis(w[1], 6)) continue; const wg = g.createLinearGradient(0, w[0], 0, w[1]); wg.addColorStop(0, 'rgba(90,176,255,.38)'); wg.addColorStop(1, 'rgba(40,90,160,.5)'); g.fillStyle = wg; g.fillRect(1, w[0], COLS - 2, w[1] - w[0]); g.strokeStyle = 'rgba(191,233,255,.6)'; g.lineWidth = .06; g.beginPath(); for (let x = 1; x <= COLS - 1; x += .25) g.lineTo(x, w[0] + Math.sin(x * 2 + s * 3) * .06); g.stroke(); }
    // 出口（第100層は頂上の扉）
    const eg = g.createRadialGradient(10, 0, .5, 10, 0, 6); eg.addColorStop(0, 'rgba(255,240,190,.9)'); eg.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = eg; g.fillRect(3, -2, 14, 8);
    if (lv.door && vis(1.4, 3)) { const open = S.opt.door; g.fillStyle = open ? 'rgba(255,231,163,.25)' : '#3b2a12'; g.fillRect(1, .2, COLS - 2, 1.2); if (!open) { g.fillStyle = '#c9a14a'; for (let x = 1.5; x < COLS - 1; x += 1.2) g.fillRect(x, .2, .18, 1.2); g.fillRect(1, 1.25, COLS - 2, .15); } g.fillStyle = '#ffe7a3'; g.font = '700 .5px "Zen Kaku Gothic New", sans-serif'; g.textAlign = 'center'; g.fillText(open ? '頂上の扉は開いている' : `頂上の扉（ほかの陣営が第${V.DOOR_AT}層に着くと開く）`, 10, 2.2); }
    // 幹の壁
    for (const x0 of [0, COLS - 1]) { g.fillStyle = '#2a1d16'; g.fillRect(x0, cam - 1, 1, VH + 2); g.fillStyle = '#3a291f'; for (let y = Math.floor(cam) - 1; y < cam + VH + 1; y += 2) g.fillRect(x0 + .2, y + ((x0 * 3) % 2), .12, 1.3); }
    // 枝
    for (const b of lv.br) {
      if (!vis(b[0])) continue;
      if (lv.f > 1 && b[0] === lv.h - 1) { drawFoliage(b[0]); continue; }
      const burn = b[3] ? FT.burnAt(b[3], b[4], s) : null;
      g.fillStyle = burn && burn.on ? '#8a3a1c' : '#4a3324'; g.fillRect(b[1], b[0], b[2] - b[1], .45);
      g.fillStyle = '#2f6b45'; for (let x = b[1] + .3; x < b[2]; x += .9) { g.beginPath(); g.arc(x, b[0] - .05, .38 + .08 * Math.sin(x * 3), Math.PI, 0); g.fill(); }
      if (burn) { if (burn.on || burn.warn) { g.globalAlpha = burn.on ? .85 : .35 + .3 * Math.sin(s * 30); for (let x = b[1] + .2; x < b[2]; x += .5) { g.fillStyle = (Math.floor(x * 2 + s * 8) % 2) ? '#ff9a5c' : '#ffd24a'; g.beginPath(); g.moveTo(x - .2, b[0]); g.lineTo(x, b[0] - .5 - .25 * Math.sin(x * 5 + s * 12)); g.lineTo(x + .2, b[0]); g.fill(); } g.globalAlpha = 1; } else { g.fillStyle = 'rgba(255,120,60,.35)'; g.fillRect(b[1], b[0] + .3, b[2] - b[1], .12); } }
    }
    // 槍・炎
    const poke = (q, fire) => { if (!vis(q[0])) return; const o = FT.pokeOut(q[3], q[4], s), wx = q[1] < 0 ? 1 : COLS - 1;
      if (o.warn) { g.globalAlpha = .4 + .4 * Math.sin(s * 30); g.fillStyle = fire ? '#ffb347' : '#ff6a3d'; g.fillRect(q[1] < 0 ? 1 : COLS - 1.3, q[0] - .4, .3, .8); g.globalAlpha = 1; }
      if (o.out <= 0) return; const len = q[2] * o.out, x0 = q[1] < 0 ? wx : wx - len;
      if (fire) { const fg = g.createLinearGradient(wx, 0, q[1] < 0 ? wx + len : wx - len, 0); fg.addColorStop(0, 'rgba(255,220,120,.95)'); fg.addColorStop(1, 'rgba(255,90,40,.2)'); g.fillStyle = fg; g.beginPath(); g.ellipse(x0 + len / 2, q[0], len / 2, .38 + .06 * Math.sin(s * 25), 0, 0, 7); g.fill(); }
      else { const tip = q[1] < 0 ? wx + len : wx - len; g.fillStyle = '#8a6a4a'; g.fillRect(x0, q[0] - .12, len, .24); g.fillStyle = '#d8c7a8'; g.beginPath(); g.moveTo(tip + q[1] * -.0 + (q[1] < 0 ? .45 : -.45), q[0]); g.lineTo(tip, q[0] - .25); g.lineTo(tip, q[0] + .25); g.fill(); } };
    for (const q of lv.sp || []) poke(q, false);
    for (const q of lv.fj || []) poke(q, true);
    // 見えない棘：黒の妖精ははっきり。ほかの妖精は、近くに来たときと、屍のそばだけうっすら
    for (const q of lv.tn || []) {
      if (!vis(q[1])) continue;
      let a = sp === 6 || seeAll ? 1 : 0;
      if (!a) { const dx = q[0] - (p.x + PW / 2), dy = q[1] - (p.y + PH / 2); if (dx * dx + dy * dy < 5) a = .35; for (const c of run.cl) { const ex = c.x - q[0], ey = c.y - q[1]; if (ex * ex + ey * ey < 6) { a = Math.max(a, .55); break; } } }
      if (!a) continue;
      g.globalAlpha = a; g.strokeStyle = sp === 6 ? '#e04a6a' : '#c9a0b0'; g.lineWidth = .08;
      for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + s * .3; g.beginPath(); g.moveTo(q[0] + Math.cos(an) * .15, q[1] + Math.sin(an) * .15); g.lineTo(q[0] + Math.cos(an) * .62, q[1] + Math.sin(an) * .62); g.stroke(); }
      g.fillStyle = sp === 6 ? '#5a1424' : '#4a3a40'; g.beginPath(); g.arc(q[0], q[1], .22, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    // 屍（浮かぶ足場）
    for (const c of run.cl) {
      if (!vis(c.y, 2)) continue;
      const src = S.cor.get(c.k) || {}, bob = Math.sin(s * 1.6 + c.x) * .04, w = c.w;
      if (src.glow > 0) src.glow = Math.max(0, src.glow - .01);
      const col = c.s === 2 ? '#ff9ccf' : fcol;
      const halo = g.createRadialGradient(c.x, c.y + bob, .1, c.x, c.y + bob, w * .9); halo.addColorStop(0, rgba(col, .32 + .4 * (src.glow || 0) + Math.min(.2, (src.nAll || c.n) * .01))); halo.addColorStop(1, rgba(col, 0));
      g.fillStyle = halo; g.fillRect(c.x - w, c.y - w + bob, w * 2, w * 2);
      g.fillStyle = c.s === 4 ? 'rgba(220,190,150,.9)' : 'rgba(214,240,255,.85)'; g.beginPath(); g.ellipse(c.x, c.y + .12 + bob, w / 2, .16, 0, 0, 7); g.fill();
      if (c.s === 2) { g.strokeStyle = 'rgba(255,156,207,.8)'; g.lineWidth = .06; g.beginPath(); g.ellipse(c.x, c.y + .12 + bob, w / 2 + .1, .26, 0, 0, 7); g.stroke(); }
      g.fillStyle = rgba(col, .7); g.beginPath(); g.ellipse(c.x - .22, c.y - .08 + bob, .26, .12, -.5, 0, 7); g.ellipse(c.x + .22, c.y - .08 + bob, .26, .12, .5, 0, 7); g.fill();
      if (c.shield && run.t - c.shield < 30) { g.globalAlpha = 1 - (run.t - c.shield) / 30; g.fillStyle = '#ffd29a'; g.beginPath(); g.arc(c.x, c.y - .2, .5, 0, 7); g.fill(); g.globalAlpha = 1; }
      const n = src.nAll || c.n;
      g.fillStyle = '#e9f3ef'; g.font = '700 .36px "Zen Kaku Gothic New", sans-serif'; g.textAlign = 'center';
      g.fillText(n > 1 ? `${src.name || ''}　${fmt(n)}人` : (src.name || ''), c.x, c.y - .42 + bob);
    }
    // 灰の足場
    if (run.block) { const bk = run.block; g.fillStyle = '#9aa0aa'; g.fillRect(bk.x - 1.1, bk.y, 2.2, .3); g.fillStyle = '#c8ccd4'; g.fillRect(bk.x - 1.1, bk.y, 2.2, .08); }
    // 蛾・蜂
    (lv.mo || []).forEach((m, i) => {
      const fz = run.mothFrozen(i), q = fz ? { x: fz.x, y: fz.y } : FT.mothAt(m, s); if (!vis(q.y)) return;
      const bee = m[5] === 1, fl = fz ? .3 : Math.abs(Math.sin(s * (bee ? 30 : 14) + m[4] * 9)) * .45 + .15;
      g.fillStyle = fz ? '#9fd4ff' : bee ? '#ffd24a' : '#9b6fd6'; g.beginPath(); g.ellipse(q.x - .25, q.y, bee ? .25 : .35, fl * (bee ? .6 : 1), -.3, 0, 7); g.ellipse(q.x + .25, q.y, bee ? .25 : .35, fl * (bee ? .6 : 1), .3, 0, 7); g.fill();
      g.fillStyle = fz ? '#3d6a8a' : bee ? '#3a2a10' : '#3b2457'; g.beginPath(); g.ellipse(q.x, q.y, bee ? .14 : .1, bee ? .22 : .3, 0, 0, 7); g.fill();
      if (bee && !fz) { g.fillStyle = '#ffd24a'; g.fillRect(q.x - .14, q.y - .05, .28, .08); }
    });
    // 実
    for (const fr of lv.fr || []) { const f = (((s + fr[3]) % fr[2]) + fr[2]) % fr[2] / fr[2]; if (f > .1 && f < .3 && vis(fr[1] - 12)) { g.globalAlpha = .5; g.fillStyle = '#ff9a5c'; g.beginPath(); g.arc(fr[0], fr[1] - 12 + .2, .18 + .1 * Math.sin(s * 20), 0, 7); g.fill(); g.globalAlpha = 1; } }
    for (const d of run.drops) { if (d.done || !vis(d.y)) continue; g.fillStyle = '#ff7a3d'; g.beginPath(); g.arc(d.x, d.y, .32, 0, 7); g.fill(); g.fillStyle = '#ffd29a'; g.beginPath(); g.arc(d.x - .1, d.y - .1, .1, 0, 7); g.fill(); }
    // 自分
    if ((!run.over || run.clear) && (!S.watch || S.replay)) {
      const cx = p.x + PW / 2, cy = p.y + PH / 2, fl = Math.sin(s * (p.fly ? 18 : 4)) * (p.fly ? .35 : .12), spc = FT.SP[sp];
      g.fillStyle = p.gauge > .25 ? rgba(fcol, .85) : 'rgba(255,154,92,.85)';
      g.beginPath(); g.ellipse(cx - .3, cy - .1, .42, .2 + fl * .5, -.6 - fl, 0, 7); g.ellipse(cx + .3, cy - .1, .42, .2 + fl * .5, .6 + fl, 0, 7); g.fill();
      g.fillStyle = '#f3e6d2'; g.beginPath(); g.arc(cx, cy - .22, .2, 0, 7); g.fill();
      g.fillStyle = spc.color; g.beginPath(); g.ellipse(cx, cy + .15, .2, .3, 0, 0, 7); g.fill();
      if (sp === 6) { g.strokeStyle = '#c8ccd4'; g.lineWidth = .05; g.stroke(); }
      if (p.gauge < 1) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(cx - .6, p.y - .45, 1.2, .14); g.fillStyle = p.gauge > .25 ? (p.wet ? '#9fd4ff' : '#7fe3c9') : '#ff9a5c'; g.fillRect(cx - .6, p.y - .45, 1.2 * p.gauge, .14); }
    }
    // 散る光
    for (const e of S.fx) { e.life -= 1 / 60; if (e.ring) { if (e.life > 0) { g.globalAlpha = e.life; g.strokeStyle = e.c; g.lineWidth = .08; g.beginPath(); g.arc(e.x, e.y, (1 - e.life / .6) * 5, 0, 7); g.stroke(); } continue; } e.x += e.vx / 60; e.y += e.vy / 60; e.vy += .1; if (e.life > 0) { g.globalAlpha = e.life; g.fillStyle = e.c; g.fillRect(e.x, e.y, .1, .1); } }
    g.globalAlpha = 1; S.fx = S.fx.filter(e => e.life > 0);
    // 闇：紫の妖精はよく見える。ほかの妖精は、自分と屍のまわりだけ明るい
    if (lv.dk && lv.dk.length) {
      for (const d of lv.dk) {
        if (!(d[1] > cam - 1 && d[0] < cam + VH + 1)) continue;
        if (!dark) dark = document.createElement('canvas');
        if (dark.width !== cv.width || dark.height !== cv.height) { dark.width = cv.width; dark.height = cv.height; }
        const dg = dark.getContext('2d');
        dg.setTransform(1, 0, 0, 1, 0, 0); dg.clearRect(0, 0, dark.width, dark.height);
        dg.setTransform(S_, 0, 0, S_, 0, -cam * S_);
        dg.globalCompositeOperation = 'source-over'; dg.fillStyle = sp === 8 || seeAll ? 'rgba(10,4,20,.35)' : 'rgba(4,2,8,.94)'; dg.fillRect(0, d[0], COLS, d[1] - d[0]);
        if (sp !== 8 && !seeAll) {
          dg.globalCompositeOperation = 'destination-out';
          const hole = (x, y, r) => { const hg = dg.createRadialGradient(x, y, r * .2, x, y, r); hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = hg; dg.fillRect(x - r, y - r, r * 2, r * 2); };
          hole(p.x + PW / 2, p.y + PH / 2, 3.2);
          for (const c of run.cl) if (c.y > d[0] - 2 && c.y < d[1] + 2) hole(c.x, c.y, 1.6);
        }
        g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(dark, 0, 0); g.setTransform(S_, 0, 0, S_, sx * S_, -cam * S_);
      }
    }
    // 高さの目盛り（右）
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bx = cv.width - 6 * dpr, top = 90 * dpr, bot = cv.height - 20 * dpr, prog = Math.max(0, Math.min(1, 1 - (p.y - 1.2) / (lv.h - 2.2)));
    g.fillStyle = 'rgba(191,233,255,.15)'; g.fillRect(bx, top, 3 * dpr, bot - top);
    g.fillStyle = fcol; g.fillRect(bx, bot - (bot - top) * prog, 3 * dpr, (bot - top) * prog);
  }
  function drawFoliage(y) {
    const hx = 10, hw = 1.6;
    g.fillStyle = '#16301f'; g.fillRect(1, y + .15, COLS - 2, 1.2);
    for (let x = 1.2; x < COLS - 1; x += .55) { if (Math.abs(x - hx) < hw) continue; const r = .42 + .12 * Math.sin(x * 5.3); g.fillStyle = (Math.floor(x * 3) % 3) ? '#2f6b45' : '#3c7d52'; g.beginPath(); g.arc(x, y + .1 + .08 * Math.sin(x * 2.1), r, 0, 7); g.fill(); }
    const hg = g.createRadialGradient(hx, y + .4, .1, hx, y + .4, hw + .8); hg.addColorStop(0, 'rgba(255,236,180,.75)'); hg.addColorStop(1, 'rgba(255,236,180,0)'); g.fillStyle = hg; g.fillRect(hx - hw - 1, y - 1, (hw + 1) * 2, 2.6);
    g.fillStyle = 'rgba(8,20,26,.9)'; g.beginPath(); g.ellipse(hx, y + .45, hw * .8, .35, 0, 0, 7); g.fill();
  }
  // ---------- 操作 ----------
  const KM = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'j', KeyW: 'j', Space: 'j', KeyZ: 'j', KeyX: 'k', KeyK: 'k', ShiftLeft: 'k', ShiftRight: 'k' };
  addEventListener('keydown', e => { if (!$('game').classList.contains('on') || document.querySelector('.over.on')) return; const k = KM[e.code]; if (k) { S.keys[k] = 1; e.preventDefault(); SND.unlock(); } if (e.code === 'Escape') toTitle(); });
  addEventListener('keyup', e => { const k = KM[e.code]; if (k) S.keys[k] = 0; });
  addEventListener('blur', () => { S.keys.l = S.keys.r = S.keys.j = S.keys.k = 0; });
  for (const [id, k] of [['bl', 'l'], ['br', 'r'], ['bj', 'j'], ['bSk', 'k']]) {
    const b = $(id);
    const on = e => { e.preventDefault(); S.keys[k] = 1; b.classList.add('on'); SND.unlock(); }, off = e => { e.preventDefault(); S.keys[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  }
  addEventListener('contextmenu', e => { if ($('game').classList.contains('on')) e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) N.flush().catch(() => { }); });
  // =============================================
  //  投稿
  // =============================================
  let shareMode = 'title';
  function shareInfo() {
    const F = ME.sp === null || ME.sp === undefined ? null : FT.FAC[facOf(ME.sp)];
    const ci = S.clearInfo;
    if (shareMode === 'summit') return { F, head: '世界樹の頂にたどり着いた！', line: `Fairies' Tower 世界樹の頂にたどり着いた！（${F.name}）`, f: 100 };
    if (shareMode === 'clear' && ci) return { F, head: `第${ci.f}層突破！`, line: `Fairies' Tower ${fmt(ci.deadN)}人の屍を越えて、第${ci.f}層突破！（${F.name}）`, f: ci.f };
    if (shareMode === 'game' && S.lv) { const pct = Math.min(99, Math.floor(Math.max(0, 1 - (S.run.p.top - 1.2) / (S.lv.h - 2.2)) * 100)); return { F, head: `第${S.lv.f}層まで到達！`, line: `Fairies' Tower 第${S.lv.f}層まで到達！（${F.name}）`, f: S.lv.f, pct }; }
    const f = F ? Math.max(ME.best[N.fac] || 1, 1) : W.latest;
    return { F, head: `第${f}層まで到達！`, line: F ? `Fairies' Tower 第${f}層まで到達！（${F.name}）` : `Fairies' Tower`, f };
  }
  const shareText = () => `${shareInfo().line}\n${GAME_URL}\n${TAGS}`;
  function drawShare(c) {
    c._fixed = true; c.width = 1200; c.height = 630;
    const x = c.getContext('2d'), info = shareInfo();
    // 背景に世界樹の絵（左）
    const t = document.createElement('canvas'); t.width = 600; t.height = 630; t._fixed = true; drawTree(t, 0);
    const bg = x.createLinearGradient(0, 0, 0, 630); bg.addColorStop(0, '#0e2c33'); bg.addColorStop(1, '#050d11'); x.fillStyle = bg; x.fillRect(0, 0, 1200, 630);
    x.drawImage(t, 0, 0);
    const font = getComputedStyle(document.body).fontFamily;
    x.textAlign = 'left'; x.fillStyle = '#e9f3ef'; x.font = `700 64px "Kaisei Decol", serif`; x.fillText("Fairies' Tower", 620, 150);
    x.fillStyle = info.F ? info.F.color : '#7fe3c9'; x.font = `700 58px "Kaisei Decol", serif`; x.fillText(info.head, 620, 290);
    if (info.F) { x.font = `700 36px ${font}`; x.fillText(info.F.name, 620, 360); }
    x.fillStyle = '#93aaa3'; x.font = `28px ${font}`; x.fillText('3つの陣営で、', 620, 440); x.fillText('世界樹のてっぺんを目指す', 620, 480); x.fillText('#FairiesTower', 620, 540);
  }
  function openShare(mode) { shareMode = mode || 'title'; drawShare($('shImg')); $('shText').value = shareText(); modal('oShare', 1); }
  $('shPost').onclick = () => { open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()), '_blank', 'noopener'); };
  $('shSave').onclick = () => { const a = document.createElement('a'); a.download = 'fairies-tower.png'; a.href = $('shImg').toDataURL('image/png'); a.click(); };
  $('shClose').onclick = () => { modal('oShare', 0); if (shareMode === 'game') S.paused = false; };
  $('bShare').onclick = () => openShare('title');
  $('gShare').onclick = () => { if (!S.lv) return; S.paused = true; openShare('game'); };
  // =============================================
  //  碑
  // =============================================
  async function openStone(tab) {
    modal('oStone', 1);
    for (const b of document.querySelectorAll('#oStone .tabs button')) b.classList.toggle('on', b.dataset.t === tab);
    const body = $('stBody'); body.innerHTML = '<p class="note">読みこみ中…</p>';
    const F = ME.sp === null || ME.sp === undefined ? FT.FAC[0] : FT.FAC[facOf(ME.sp)];
    try {
      if (tab === 'first') {
        await getFloors();
        const rows = []; for (let f = 1; f <= 100; f++) { if (!okFloor(f)) break; const o = opener(f); rows.push(`<li><b>第${f}層</b> ${esc(FLOORS[f - 1].name)}<br>${esc(o ? o.n : '名無し')}${o && o.x ? '　@' + esc(o.x) : ''}</li>`); }
        body.innerHTML = `<p class="note">${esc(F.name)}で、各層をはじめて越えた妖精。XのIDは本人の申告で、本当にその人かは確かめていません。</p><ol class="names">${rows.length ? rows.join('') : '<li>まだだれもいない</li>'}</ol>`;
      } else {
        if (OFFLINE) { body.innerHTML = '<p class="note">つなぎ先が入るまでは、頂の碑は見られません。</p>'; return; }
        const out = [];
        for (let i = 0; i < 3; i++) { const fid = N.FACS[i]; if (!N.ready(fid)) continue; const v = await N.rest('ft_clear/100', { orderBy: 't', limitToFirst: 300 }, fid).catch(() => null); const list = Object.values(v || {}).filter(c => c && c.n).sort((a, b) => a.t - b.t); out.push(`<h3 style="margin:6px 0;color:${FT.FAC[i].color};font-size:15px">${esc(FT.FAC[i].name)}</h3><ol class="names">${list.length ? list.map(c => `<li>${esc(N.cleanName(c.n) || '名無し')}${N.cleanX(c.x) ? '　@' + esc(N.cleanX(c.x)) : ''}<small>${new Date(c.t).toLocaleString('ja-JP')}</small></li>`).join('') : '<li>まだだれもいない</li>'}</ol>`); }
        body.innerHTML = `<p class="note">世界樹の頂にたどり着いた妖精。</p>${out.join('')}`;
      }
    } catch (e) { body.innerHTML = '<p class="note">読みこめませんでした</p>'; }
  }
  for (const b of document.querySelectorAll('#oStone .tabs button')) b.onclick = () => openStone(b.dataset.t);
  $('bStone').onclick = () => openStone('first');
  $('stClose').onclick = () => modal('oStone', 0);
  // =============================================
  //  層をえらぶ
  // =============================================
  $('bFloors').onclick = async () => {
    if (ME.sp === null || ME.sp === undefined) { toast('まず妖精をえらんでください'); return; }
    await getFloors();
    const box = $('flList'); box.innerHTML = '';
    for (let f = 1; f <= W.latest; f++) { const b = document.createElement('button'); b.textContent = f; if (f === W.latest) b.className = 'now'; b.setAttribute('aria-label', `第${f}層 ${FLOORS[f - 1].name}`); b.onclick = () => { modal('oFloors', 0); startFloor(f, { watch: flMode === 'watch' }); }; box.appendChild(b); }
    modal('oFloors', 1);
  };
  $('flClose').onclick = () => modal('oFloors', 0);
  let flMode = 'play';
  for (const b of document.querySelectorAll('#oFloors .tabs button')) b.onclick = () => { flMode = b.dataset.m; for (const x of document.querySelectorAll('#oFloors .tabs button')) x.classList.toggle('on', x === b); $('flNote').textContent = flMode === 'watch' ? '自分は昇らずに、その層の屍と仕掛けを見られます。一番乗りの昇り方も再生できます。' : '開いた層なら、どこからでも昇れます。いちばん新しい層が、陣営の最前線です。'; };
  // =============================================
  //  見る（スペクターモード）
  // =============================================
  //  自分は昇らない。屍と仕掛けはふつうに動く。指でなぞるか、↑↓で上下に動かす
  //  「一番乗りの昇り方」：その層をはじめて越えた人の操作を、そのときの屍で再生する
  function startWatch(lv) {
    const F = FT.FAC[Math.max(0, N.FACS.indexOf(N.fac))];
    S.run = new FT.Run(lv, S.cor, { sp: 0, door: true });
    S.run.hazard = function (s) { FT.Run.prototype.hazard.call(this, s); return null; };   // 仕掛けは動かすが、だれも死なない
    S.run.p.x = -50; S.run.p.y = lv.h + 200;
    S.acc = 0; S.cam = Math.max(0, lv.h - VH);
    $('hFloor').innerHTML = `第${lv.f}層<small>${esc(lv.name)}</small>`;
    $('hFac').innerHTML = `<span style="color:${F.color}">${esc(F.name)}</span>・見る`;
    $('hName').textContent = '見る：指でなぞるか ↑↓ で動かす';
    updateHud();
    SND.bgm(themeSong(lv));
  }
  function watchStep(dt) {
    const lv = S.lv, R = S.replay;
    S.acc += dt;
    while (S.acc >= FT.DT) {
      S.acc -= FT.DT;
      if (S.run) { S.run.step(0); S.run.events.length = 0; if (S.run.p.y > lv.h + 400) S.run.p.y = lv.h + 200; }
      if (R && !R.run.over) { R.run.step(R.inp(R.run.t + 1)); R.run.events.length = 0; if (R.run.over) toast(R.run.clear ? `「${R.name}」 越えた！` : '記録はここまで', '', 2000); }
    }
    if (R && S.follow && !R.run.over) S.cam += (Math.max(0, Math.min(lv.h - VH, R.run.p.y - VH * .55)) - S.cam) * Math.min(1, dt * 8);
    else { const sp = 18 * dt; if (S.keys.j || S.keys.up) S.cam -= sp; if (S.keys.dn) S.cam += sp; }
    S.cam = Math.max(0, Math.min(lv.h - VH, S.cam));
  }
  async function watchReplay() {
    const f = S.lv.f, o = W.okSnap[f] || (ME.ok[N.fac] || {})[f] || W.open[f];
    if (!o || !o.id || OFFLINE) { toast('まだだれも、この層を越えていません'); return; }
    try {
      const c = await N.rest('ft_clear/' + f + '/' + o.id);
      if (!c || typeof c.r !== 'string') throw 0;
      S.replay = { run: new FT.Run(S.lv, FT.corParse(c.c), { sp: c.s | 0, b: c.b | 0, door: true }), inp: FT.Rec.parse(c.r), name: N.cleanName(c.n) || '名無し' };
      S.follow = true;
      toast(`はじめて越えた「${S.replay.name}」の昇り方`, '屍は、そのときの屍です', 2400);
    } catch (e) { toast('記録を読みこめませんでした'); }
  }
  $('wReplay').onclick = () => { SND.unlock(); watchReplay(); };
  $('wFree').onclick = () => { S.follow = false; S.replay = null; };
  $('wPlay').onclick = () => { if (ME.sp === null || ME.sp === undefined) { toTitle(); toast('まず妖精をえらんでください'); return; } const f = S.lv.f; if (f > W.latest) { toast('まだ開いていない層です'); return; } startFloor(f); };
  // 見るときは、画面をなぞって上下に動かす
  let drag = null;
  cv.addEventListener('pointerdown', ev => { if (!S.watch) return; drag = { y: ev.clientY, c: S.cam }; S.follow = false; });
  addEventListener('pointermove', ev => { if (!drag || !S.watch) return; const r = cv.getBoundingClientRect(); S.cam = drag.c - (ev.clientY - drag.y) * (cv.height / r.height) / S_; });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('keydown', e => { if (!S.watch || !$('game').classList.contains('on')) return; if (e.code === 'ArrowDown' || e.code === 'KeyS') { S.keys.dn = 1; e.preventDefault(); } if (e.code === 'ArrowUp' || e.code === 'KeyW') { S.keys.up = 1; e.preventDefault(); } });
  addEventListener('keyup', e => { if (e.code === 'ArrowDown' || e.code === 'KeyS') S.keys.dn = 0; if (e.code === 'ArrowUp' || e.code === 'KeyW') S.keys.up = 0; });
  // =============================================
  //  引き継ぎ
  // =============================================
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  function myCode() { return 'FT1' + b64e(JSON.stringify({ s: ME.sp, b: ME.best, d: ME.dead, x: ME.xid || '' })); }
  $('bCode').onclick = () => { $('cdMine').value = myCode(); $('cdIn').value = ''; modal('oCode', 1); };
  $('cdCopy').onclick = async () => { try { await navigator.clipboard.writeText($('cdMine').value); toast('コードをうつしました'); } catch (e) { $('cdMine').select(); toast('コードをえらびました', '長押ししてコピーしてください'); } };
  $('cdLoad').onclick = () => {
    const v = $('cdIn').value.trim();
    try {
      if (!/^FT1/.test(v)) throw 0; const o = JSON.parse(b64d(v.slice(3)));
      if (o.s !== null && o.s !== undefined && FT.SP[o.s]) ME.sp = o.s;
      for (const k of N.FACS) if (o.b && +o.b[k] >= 1 && +o.b[k] <= 100) ME.best[k] = Math.max(ME.best[k] || 0, +o.b[k]);
      ME.dead = Math.max(ME.dead || 0, +o.d || 0); if (o.x) ME.xid = N.cleanX(o.x);
      saveMe(); if (ME.sp !== null && ME.sp !== undefined) N.fac = fidOf(ME.sp);
      modal('oCode', 0); toast('読みこみました'); refresh(true);
    } catch (e) { toast('コードの形がちがいます'); }
  };
  $('cdClose').onclick = () => modal('oCode', 0);
  // =============================================
  //  あそびかた・音
  // =============================================
  $('howSp').innerHTML = FT.SP.map(sp => `<tr><td style="color:${sp.color === '#3a3f4a' ? '#9aa3b4' : sp.color}">${esc(sp.name)}</td><td>${esc(FT.FAC[sp.fac].name)}<br>${esc(sp.how)}</td></tr>`).join('');
  function openHow() { modal('oHow', 1); S.paused = true; }
  $('howClose').onclick = () => { modal('oHow', 0); S.paused = false; };
  $('bHow').onclick = openHow; $('gHow').onclick = openHow;
  function paintSnd() { $('bSnd').textContent = SND.on ? '♪ 音あり' : '♪ 音なし'; }
  $('bSnd').onclick = () => { SND.unlock(); SND.setOn(!SND.on); paintSnd(); };
  // =============================================
  //  タイトルへ
  // =============================================
  function toTitle() { N.flush().catch(() => { }); S.run = null; S.lv = null; S.watch = false; S.replay = null; $('game').classList.remove('watching'); SND.bgm(null); show('title'); refresh(); }
  $('gBack').onclick = toTitle;
  $('bGo').onclick = async () => { SND.unlock(); await getFloors(); startFloor(W.done ? 100 : W.latest); };
  // はじめる
  paintSnd(); buildPicker();
  getFloors().then(() => {
    computeLatest(); title.paint();
    // 管理画面から：?watch=層&fac=陣営 で、その層を見る（開いていない層も見られる）
    const q = new URLSearchParams(location.search), wf = +(q.get('watch') || 0), wfac = q.get('fac');
    if (wf >= 1 && wf <= 100) { if (N.FACS.includes(wfac)) N.fac = wfac; ME.tut = 1; refresh(true).then(() => startFloor(wf, { watch: true })); }
  }).catch(() => { });
  refresh(true);
  requestAnimationFrame(loop);
  // 3分ごとに全体を読みなおす（タイトルにいるときだけ）
  setInterval(() => { if ($('title').classList.contains('on') && !document.hidden) refresh(); }, 180000);
  FT.UI = { show, toast, startFloor, toTitle, W, ME, refresh, okFloor };
})(window);
