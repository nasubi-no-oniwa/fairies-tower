// =============================================
//  Fairies' Tower  画面と流れ
//   タイトル（世界樹の絵・妖精をえらぶ）→ 陣営の最新の層から昇る
//   死ぬ：その場に屍が浮かぶ（同じ陣営で共有）。すぐ次の名前で昇りなおす
//   越える：次の層へ。はじめて越えた人は碑に名前が残る。第100層の頂で、陣営の勝ち
// =============================================
(function (G) {
  const FT = G.FT, N = FT.NET, V = FT.V, SND = FT.SND, PW = FT.PHYS.PW, PH = FT.PHYS.PH, COLS = FT.COLS;
  FT.VER = '7';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = FT.T, fmt = n => Number(n || 0).toLocaleString(FT.LOCALE || 'ja-JP');
  const GAME_URL = G.FT_GAME_URL || location.href.split(/[?#]/)[0];
  const TAGS = T('#FairiesTower #gamedev #ゲーム制作');
  const OFFLINE = !N.FACS.some(f => N.ready(f));
  // ---------- 名前（毎回ちがう） ----------
  const PRE = ['うたう', 'ちいさな', 'あおい', 'ねむれる', 'ほしふる', 'さいごの', 'つきなき', 'あさやけの', 'ふるえる', 'みどりの', 'はじめての', 'ゆうぐれの', 'まよえる', 'しろい', 'かけだしの', 'ひとりの', 'わすれられた', 'こごえた', 'ねぼけた', 'まっすぐな', 'おくびょうな', 'むこうみずな', 'うつろな', 'とおくの'];
  const NAME = ['ルカ', 'イオ', 'ナギ', 'ツバキ', 'ハク', 'セツ', 'マオ', 'リク', 'モモ', 'スズ', 'ヒバリ', 'フウ', 'コハ', 'ウタ', 'ソラ', 'アオ', 'シノ', 'テオ', 'ニコ', 'ミナ', '旅人', '見習い', '弓兵', '吟遊詩人', '鍛冶屋', '薬師', '巡礼者', '学者'];
  const newName = () => { const L = FT.NAMES; if (L) { for (let i = 0; i < 30; i++) { const s = L.pre[Math.floor(Math.random() * L.pre.length)] + L.sep + L.name[Math.floor(Math.random() * L.name.length)]; if (s.length <= 12) return s; } return L.name[0]; } return (PRE[Math.floor(Math.random() * PRE.length)] + NAME[Math.floor(Math.random() * NAME.length)]).slice(0, 12); };
  // ---------- 自分の記録（この端末） ----------
  const ME = Object.assign({ sp: null, best: {}, dead: 0, tut: 0, ok: {}, ng: {}, lok: {}, xid: '', mine: [], helpSeen: 0 }, N.store('ft_me') || {});
  const saveMe = () => N.store('ft_me', ME);
  const facOf = sp => FT.SP[sp].fac, fidOf = sp => N.FACS[FT.SP[sp].fac];
  if (ME.sp !== null && ME.sp !== undefined) N.fac = fidOf(ME.sp);
  // ---------- 層 ----------
  let FLOORS = null; const LV = {};
  async function getFloors() { if (FLOORS) return FLOORS; const r = await fetch('data/floors.json?v=' + FT.VER); FLOORS = await r.json(); for (const F of FLOORS) F.name = FT.TF(F.f, F.name); return FLOORS; }
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
    if (!force && W.loaded && Date.now() - refAt < 60000) { computeLatest(); title.paint(); loadHelp().then(paintHelp); return; }
    refAt = Date.now();
    refP = (async () => {
      try { const o = await N.overview(); W.open = Object.assign({}, o.open); W.stat = o.stat || {}; W.okSnap = o.okSnap || {}; W.ckpt = o.ckpt; W.tops = Object.assign(W.tops, o.tops); W.ends = o.ends || {}; W.loaded = true; } catch (e) { W.loaded = false; }
      computeLatest(); title.paint(); loadHelp().then(paintHelp);
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
      col.dataset.fac = fi; col.style.setProperty('--d', fi * .12 + 's'); col.style.setProperty('--fc', F.color);
      col.innerHTML = `<h3><span class="emb"></span>${esc(F.name)}</h3>`;
      FT.SP.forEach((sp, si) => {
        if (sp.fac !== fi) return;
        const b = document.createElement('button'); b.className = 'sp'; b.dataset.sp = si; b.style.color = F.color;
        b.style.setProperty('--c', sp.color === '#3a3f4a' ? '#9aa3b4' : sp.color);
        b.innerHTML = `<span class="in"><span class="fr"><canvas class="spc" width="16" height="16" data-sp="${si}"></canvas><span class="nm">${esc(sp.name)}</span></span><span class="bk"><canvas class="spc" width="16" height="16" data-sp="${si}"></canvas><span class="nm">${esc(sp.skill)}</span></span></span>`;
        b.onclick = () => pickSp(si);
        col.appendChild(b);
      });
      box.appendChild(col);
    });
  }
  function pickSp(si) {
    SND.unlock(); SND.se('tap');
    const before = ME.sp === null || ME.sp === undefined ? null : fidOf(ME.sp);
    ME.sp = si; if (before !== null && before !== fidOf(si)) ME.facAt = Date.now(); saveMe(); N.fac = fidOf(si);
    title.paint();
    if (before !== N.fac) { W.open = {}; W.stat = {}; W.okSnap = {}; W.ckpt = null; W.loaded = false; refresh(true); }
  }
  const title = {
    paint() {
      const L = W.latest, lv = FLOORS && FLOORS[L - 1], has = ME.sp !== null && ME.sp !== undefined;
      const F = has ? FT.FAC[facOf(ME.sp)] : null;
      $('tLatest').innerHTML = !has ? T('まず妖精をえらぶ') + '<small></small>' : W.done ? `${T('頂上に到達')}<small>${esc(F.name)}</small>` : `${T('第{0}層', L)}<small>${esc(lv ? lv.name : '')}</small>`;
      $('tLatest').style.color = F ? F.color : '';
      $('tDead').textContent = fmt(OFFLINE ? ME.dead : facDead());
      const subs = [];
      if (has) {
        subs.push(T('{0}の最前線', F.name) + (OFFLINE ? T('（この端末だけで遊んでいます）') : ''));
        const op = L > 1 ? opener(L - 1) : null; if (op) subs.push(T('第{0}層を最初に越えたのは「{1}」', L - 1, op.n) + (op.x ? '（@' + op.x + '）' : ''));
        const b = ctxFor(L).maxB; if (b > 0) subs.push(T('追い上げ中：翅が{0}%長くもつ', b * 3));
        if (L === 100 && !W.done) subs.push(ctxFor(100).door ? T('頂上の扉は開いている') : T('頂上の扉は閉じている（ほかの陣営のどれかが第{0}層に着くと開く）', V.DOOR_AT));
      }
      $('tSub').textContent = subs.join(T('　／　'));
      for (const b of document.querySelectorAll('.sp')) b.classList.toggle('on', +b.dataset.sp === ME.sp);
      if (has) { const sp = FT.SP[ME.sp]; $('spInfo').innerHTML = `<b style="color:${sp.color}">${esc(sp.name)}</b> (${esc(F.name)})　<b>${esc(sp.skill)}</b><br>${esc(sp.how)}`; }
      else $('spInfo').textContent = T('9つの妖精から1つをえらぶ。妖精の色で、どの陣営に入るかが決まる。陣営ごとに、べつべつの世界樹を昇る。');
      const end = ended();
      $('endBanner').hidden = !end;
      if (end) { const wf = FT.FAC[N.FACS.indexOf(end.w)]; $('endBanner').innerHTML = T('{0}が、世界樹の頂にたどり着いた。', `<b style="color:${wf ? wf.color : ''}">${esc(wf ? wf.name : '')}</b>`) + '<br>' + T('ゲームは終わりました。いまの世界樹は、そのときのまま残っています。') + '<br>' + T('これから昇っても、屍は増えません。'); }
      $('bGo').disabled = !has;
      $('bGo').textContent = !has ? T('妖精をえらんでください') : W.done ? T('頂上をながめる') : T('第{0}層から昇る', L) + (end ? T('（記録は残りません）') : '');
      drawTree($('tree'), 1);
      paintHelp();
      if (FT.UI && FT.UI.onPaint) FT.UI.onPaint();
    },
  };
  // 世界樹の絵：3つの陣営がどこまで昇ったか
  function drawTree(cv, dprMax) {
    const dpr = Math.min(dprMax ? 2 : 1, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
    const Wd = cv._fixed ? cv.width : Math.max(10, Math.round(r.width * dpr)), Hd = cv._fixed ? cv.height : Math.max(10, Math.round(r.height * dpr));
    if (!cv._fixed) { cv.width = Wd; cv.height = Hd; }
    const g = cv.getContext('2d'), u = Math.min(Hd / 300, Wd / 360);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, Wd, Hd); if (cv.id !== 'tree') { const bg = g.createLinearGradient(0, 0, 0, Hd); bg.addColorStop(0, '#0e2c33'); bg.addColorStop(1, '#050d11'); g.fillStyle = bg; g.fillRect(0, 0, Wd, Hd); }
    // 星
    if (cv.id !== 'tree') for (let i = 0; i < 60; i++) { const x = (i * 97.3) % Wd, y = (i * 53.1) % (Hd * .7); g.fillStyle = `rgba(191,233,255,${.15 + (i % 5) * .08})`; g.fillRect(x, y, 1.5 * u, 1.5 * u); }
    const top = 28 * u, bot = Hd - 24 * u, cx = Wd / 2, yOf = f => bot - (bot - top) * (Math.min(100, Math.max(1, f)) - 1) / 99;
    // 幹と梢
    const tk = g.createLinearGradient(cx - 34 * u, 0, cx + 34 * u, 0); tk.addColorStop(0, '#120d10'); tk.addColorStop(.45, '#3a2a22'); tk.addColorStop(.6, '#4a3628'); tk.addColorStop(1, '#120d10');
    g.fillStyle = tk; g.beginPath(); g.moveTo(cx - 34 * u, bot + 20 * u); g.quadraticCurveTo(cx - 14 * u, bot - 40 * u, cx - 10 * u, top + 20 * u); g.lineTo(cx + 10 * u, top + 20 * u); g.quadraticCurveTo(cx + 14 * u, bot - 40 * u, cx + 34 * u, bot + 20 * u); g.fill();
    for (let i = 0; i < 9; i++) { const y = top + 12 * u + i * 22 * u, w = (40 + i * 9) * u, x = cx + (i % 2 ? 16 : -16) * u; const lg = g.createLinearGradient(0, y - 9 * u, 0, y + 9 * u); lg.addColorStop(0, 'rgba(70,140,110,.55)'); lg.addColorStop(1, 'rgba(14,40,34,.5)'); g.fillStyle = lg; g.beginPath(); g.ellipse(x, y, w, 9 * u, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,236,160,.5)'; for (let k = 0; k < 4; k++) { const fx = x + (((i * 37 + k * 53) % 100) / 50 - 1) * w * .8; g.fillRect(fx, y - 3 * u + (k % 3) * 2 * u, 1.6 * u, 1.6 * u); } }
    const crown = g.createRadialGradient(cx, top, 2, cx, top, 60 * u); crown.addColorStop(0, 'rgba(255,240,190,.55)'); crown.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = crown; g.fillRect(cx - 70 * u, top - 40 * u, 140 * u, 90 * u);
    // 目盛り
    g.font = `${10 * u}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'left'; g.fillStyle = 'rgba(191,233,255,.45)';
    for (const f of [1, 25, 50, 75, 100]) { const y = yOf(f); g.fillRect(10 * u, y, Wd - 20 * u, .6 * u); g.fillText(f === 100 ? T('頂') : T('第{0}層', f), 10 * u, y - 3 * u); }
    // 3つの陣営
    N.FACS.forEach((F, i) => {
      const fc = FT.FAC[i], t = Math.min(101, W.tops[F] || 1), y = yOf(Math.min(100, t)), x = i === 0 ? cx - 26 * u : i === 1 ? cx + 4 * u : cx + 30 * u;
      g.strokeStyle = fc.color; g.lineWidth = 4 * u; g.globalAlpha = .9; g.beginPath(); g.moveTo(x, bot); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = fc.color; g.beginPath(); g.arc(x, y, 6 * u, 0, 7); g.fill();
      const lx = i === 0 ? cx - 48 * u : cx + 48 * u;
      g.textAlign = i === 0 ? 'right' : 'left'; g.font = `700 ${11 * u}px ${getComputedStyle(document.body).fontFamily}`;
      let ly = y - 8 * u; if (i === 2 && Math.abs(yOf(Math.min(100, W.tops.r || 1)) - y) < 16 * u) ly = yOf(Math.min(100, W.tops.r || 1)) - 8 * u + 15 * u;
      ly = Math.max(top + 4 * u, Math.min(bot - 2 * u, ly));
      g.fillText(`${fc.name} ${t > 100 ? T('頂') : T('第{0}層', t)}`, lx, ly + 4 * u);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
    });
    // あなた
    if (ME.sp !== null && ME.sp !== undefined) {
      const best = ME.best[N.fac] || 0;
      if (best) { const fi = N.FACS.indexOf(N.fac), x = fi === 0 ? cx - 26 * u : fi === 1 ? cx + 4 * u : cx + 30 * u, y = yOf(best); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 12 * u, y); g.lineTo(x - 20 * u, y - 5 * u); g.lineTo(x - 20 * u, y + 5 * u); g.fill(); g.textAlign = 'right'; g.font = `700 ${10 * u}px ${getComputedStyle(document.body).fontFamily}`; g.fillText(T('あなた'), x - 23 * u, y + 3.5 * u); }
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
    else { try { cor = await N.loadCells(lv); } catch (e) { toast(T('みんなの屍を読みこめませんでした'), T('この端末の分だけで遊べます'), 2600); } }
    $('loading').classList.remove('on');
    S.lv = lv; S.cor = cor; S.nextCor = null; S.mine = new Map(); S.deathsHere = 0; S.fx = [];
    if (!opt.watch) loadHelpFloor(f);
    S.latest = f === W.latest && !W.done;
    S.watch = !!opt.watch; S.replay = null; S.follow = false;
    $('game').classList.toggle('watching', S.watch);
    if (S.watch) { startWatch(lv); return; }
    const F = FT.FAC[facOf(ME.sp)], sp = FT.SP[ME.sp];
    $('hFloor').innerHTML = `${T('第{0}層', f)}<small>${esc(lv.name)}</small>`;
    $('hFac').innerHTML = `<span style="color:${F.color}">${esc(F.name)}</span>${T('・')}<span style="color:${sp.color === '#3a3f4a' ? '#9aa3b4' : sp.color}">${esc(sp.name)}</span>`;
    $('skName').textContent = sp.sk === 'none' ? T('（いつも）') : sp.skill;
    $('bSk').classList.toggle('off', sp.sk === 'none'); $('bSk').hidden = sp.sk === 'none';
    if (!ME.best[N.fac] || ME.best[N.fac] < f) { ME.best[N.fac] = f; saveMe(); }
    updateHud();
    SND.bgm(themeSong(lv));
    spawn(true);
    S.enterAt = performance.now();
    const thTxt = lv.th && lv.th.length && lv.f > 5 ? T('{0}が得意な層', lv.th.map(t => FT.SP[t].name).join(T('・'))) : '';
    if (FT.UI.banner) FT.UI.banner(f, lv.name, thTxt); else if (thTxt) toast(`${T('第{0}層', f)}　${lv.name}`, thTxt, 2400);
    if (!ME.tut) { ME.tut = 1; saveMe(); if (FT.UI.coach) FT.UI.coach(); else openHow(); }
  }
  function spawn(first) {
    S.used = new Set();
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
      const want = Math.max(0, Math.min(S.lv.h - VH, run.p.y - VH * .62));
      S.cam += (want - S.cam) * Math.min(1, dt * 8);
    }
    draw();
  }
  function events(run) {
    for (const e of run.events) {
      switch (e.k) {
        case 'jump': SND.se('jump'); break;
        case 'bounce': SND.se('bounce'); break;
        case 'land': SND.se('land'); if (run.p.onC >= 0 && run.cl[run.p.onC]) useCor(run.cl[run.p.onC].k); break;
        case 'grab': SND.se('grab'); { const c = run.cl[e.a]; if (c) { c.glow = 1; useCor(c.k); } } break;
        case 'splash': SND.se('splash'); break;
        case 'leap': SND.se('leap'); break;
        case 'freeze': SND.se('freeze'); S.fx.push({ ring: 1, x: run.p.x + PW / 2, y: run.p.y + PH / 2, life: .6, c: '#ffd84a' }); break;
        case 'block': SND.se('block'); break;
      }
    }
    run.events.length = 0;
  }
  // ---------- 死んだ ----------
  // ---------- 屍が足場になった数 ----------
  //  遊んでいる間に乗った（着地した・つかまった）屍を覚えておき、挑戦が終わったら「足場になった数＋1」を送る（自分の屍は数えない）
  const mineKey = (a, f, k) => a + ':' + f + ':' + k;
  const isMine = k => S.mine.has(k) || ME.mine.some(o => o.a === N.fac && o.f === S.lv.f && o.k === k);
  function useCor(k) { if (S.watch || !S.used || S.used.size >= 20 || isMine(k)) return; S.used.add(k); }
  function rememberMine(f, k, n) {
    ME.mine = (ME.mine || []).filter(o => !(o.a === N.fac && o.f === f && o.k === k));
    ME.mine.push({ a: N.fac, f, k, n: N.cleanName(n) || '名無し', t: Date.now() });
    if (ME.mine.length > 50) ME.mine = ME.mine.slice(-50);
    saveMe();
  }
  const HELP = new Map(); let helpAt = 0, helpP = null;
  function loadHelp(force) {
    if (OFFLINE || !ME.mine || !ME.mine.length) return Promise.resolve();
    if (helpP) return helpP; if (!force && Date.now() - helpAt < 60000) return Promise.resolve();
    helpAt = Date.now();
    helpP = N.helpOf(ME.mine).then(m => { for (const [k, v] of m) HELP.set(k, v); }).catch(() => { }).finally(() => { helpP = null; });
    return helpP;
  }
  // 遊んでいる層の自分の屍だけ読む
  function loadHelpFloor(f) { if (OFFLINE) return; const list = (ME.mine || []).filter(o => o.a === N.fac && o.f === f); if (list.length) N.helpOf(list).then(m => { for (const [k, v] of m) HELP.set(k, v); }).catch(() => { }); }
  function paintHelp() {
    const el = $('tHelp'); if (!el) return;
    const list = (ME.mine || []).map(o => Object.assign({ h: HELP.get(mineKey(o.a, o.f, o.k)) || 0 }, o));
    const sum = list.reduce((a, o) => a + o.h, 0);
    if (!list.length || !HELP.size) { el.hidden = true; return; }
    el.hidden = false;
    const best = list.slice().sort((a, b) => b.h - a.h)[0], diff = sum - (ME.helpSeen || 0);
    const fn = a => { const F = FT.FAC[N.FACS.indexOf(a)]; return F ? T('{0}の', `<span style="color:${F.color}">${esc(F.name)}</span>`) : ''; };
    el.innerHTML = `<div class="hl1">${T('あなたの屍は、のべ {0}人の足場になった', `<b>${fmt(sum)}</b>`)}${diff > 0 ? `<em>＋${fmt(diff)}</em>` : ''}</div>` +
      (best && best.h > 0 ? `<div class="hl2">${T('いちばん役に立った屍：{0}第{1}層「{2}」（{3}人）', fn(best.a), best.f, esc(best.n), fmt(best.h))}</div>` : `<div class="hl2">${T('まだだれも乗っていない。あとから来る仲間を待とう')}</div>`);
    if (diff !== 0) { clearTimeout(paintHelp.t); paintHelp.t = setTimeout(() => { ME.helpSeen = sum; saveMe(); }, 4000); }
  }
  const KIND = { wing: T('{0}は翅が尽きて、力尽きた'), drown: T('{0}は水の中で、息が尽きた'), spear: T('{0}は幹の槍に貫かれた'), fire: T('{0}は炎に焼かれた'), burn: T('{0}は燃える枝で焼かれた'), moth: T('{0}は蛾に触れた'), bee: T('{0}は蜂に刺された'), thorn: T('{0}は見えない棘に刺さった'), fruit: T('{0}は落ちてきた実に打たれた') };
  function onDie() {
    const run = S.run, pl = run.place, lv = S.lv, name = S.name, f = lv.f;
    SND.se('die'); S.shake = .5; S.dieAt = performance.now();
    const x = run.p.x + PW / 2, y = run.p.y + PH;
    for (let i = 0; i < 18; i++) S.fx.push({ x, y: y - .4, vx: (Math.random() - .5) * 5, vy: -Math.random() * 4, life: .9, c: '#bfe9ff' });
    ME.dead++; saveMe(); S.deathsHere++;
    let sub = '';
    if (pl.k >= 0) {
      const c = S.cor.get(pl.k);
      if (pl.merge && c) { c.n++; c.glow = 1; sub = T('「{0}」の屍に合流した（{1}人が眠る）', c.name, fmt(c.n)); setTimeout(() => SND.se('merge'), 200); if (!OFFLINE && !ended()) rememberMine(f, pl.k, c.name || name); }
      else { S.cor.set(pl.k, { n: 1, s: ME.sp, name, t: Date.now(), glow: 1, mine: 1 }); S.mine.set(pl.k, S.cor.get(pl.k)); sub = T('ここが、あとから来る仲間の足場になる'); setTimeout(() => SND.se('pile'), 200); if (!OFFLINE && !ended()) rememberMine(f, pl.k, name); }
    } else sub = T('根もとで倒れた。屍は残らない');
    toast((KIND[run.dead] || T('{0}は力尽きた')).replace('{0}', name), sub, 1700);
    const m = Math.round(Math.max(0, Math.min(1, (lv.h - 1 - run.p.top) / (lv.h - 2.2))) * 1000);
    if (OFFLINE) saveLocalCor(f, S.cor);
    else if (!ended()) {
      const k = pl.k, myCor = S.cor;
      N.died({ f, k, merge: !!pl.merge, s: ME.sp, name, rec: S.rec.str(), cor: S.startCor, ticks: run.t, b: S.opt.b, m, help: [...S.used].filter(x => x !== k) })
        .then(() => { const st = W.stat[f] = W.stat[f] || {}; st.d = (st.d || 0) + 1; updateHud(); refreshStat(); })
        .catch(() => { const c = k >= 0 && myCor.get(k); if (c && c.mine && c.n <= 1) myCor.delete(k); });   // 送れなかった屍は、この端末でも消す（あとの挑戦の確かめが通らなくなるので）
      // ほかの人の屍の読みなおしは、20秒に1回まで
      if (Date.now() - S.syncAt > 20000) { S.syncAt = Date.now(); const lvNow = lv; N.syncCells(lvNow, S.mine).then(mp => { if (mp && S.lv === lvNow) { for (const [k2, c2] of S.cor) if (c2.mine && !mp.has(k2)) mp.set(k2, c2); S.nextCor = mp; } }).catch(() => { }); }
    }
    updateHud();
    S.lastDeath = { lv, cor: S.startCor, rec: S.rec.str(), opt: Object.assign({}, S.opt), t: run.t, name, sub: (KIND[run.dead] || T('{0}は力尽きた')).replace('{0}', name), at: Date.now() };
    if (FT.UI.clipOffer) FT.UI.clipOffer();
    setTimeout(() => { if (S.run === run && $('game').classList.contains('on') && !S.clip) spawn(false); }, 600);
  }
  let statT = 0;
  function refreshStat() { if (OFFLINE || Date.now() - statT < 120000) return; statT = Date.now(); N.floorStat(S.lv.f).then(v => { if (v) { W.stat[S.lv.f] = v; updateHud(); } }).catch(() => { }); }
  // ---------- 越えた ----------
  async function onClear() {
    const run = S.run, lv = S.lv, f = lv.f, ticks = run.t;
    SND.se('clear'); SND.bgm(null); S.clearAt = performance.now(); S.clearPos = [run.p.x + PW / 2, run.p.y];
    for (let i = 0; i < 30; i++) S.fx.push({ x: run.p.x + PW / 2, y: run.p.y, vx: (Math.random() - .5) * 7, vy: -Math.random() * 6, life: 1.2, c: '#ffe080' });
    const deadN = Math.max((W.stat[f] && W.stat[f].d) || 0, [...S.cor.values()].reduce((a, c) => a + (c.nAll || c.n), 0));
    const wasOpen = okFloor(f), isFirst = S.latest && !wasOpen;
    const F = FT.FAC[facOf(ME.sp)];
    $('clBig').innerHTML = T('{0}人の屍を越えて', `<b>${fmt(deadN)}</b>`) + '<br>' + (f === 100 ? T('世界樹の頂へ') : T('第{0}層突破！', f));
    $('clSub').textContent = `${S.name} (${F.name})　${T('{0}秒', (ticks / 120).toFixed(1))}`;
    $('clFirst').hidden = true; $('clX').value = ME.xid || '';
    $('clNext').hidden = f >= 100;
    $('clNext').textContent = T('第{0}層へ', Math.min(100, f + 1));
    $('clMsg').textContent = '';
    if (!ME.best[N.fac] || ME.best[N.fac] < Math.min(100, f + 1)) { ME.best[N.fac] = Math.min(100, f + 1); saveMe(); }
    S.clearInfo = { f, name: S.name, ticks, deadN, isFirst };
    setTimeout(() => { if (S.lv === lv) modal('oClear', 1); }, 1100);
    if (OFFLINE) { ME.lok[f] = 1; saveMe(); computeLatest(); if (f === 100) $('clMsg').textContent = T('世界樹の頂にたどり着いた（この端末だけの記録です）'); return; }
    if (ended()) { $('clMsg').textContent = T('ゲームは終わっているので、記録は残りません'); return; }
    $('clMsg').textContent = T('記録を送っています…');
    try {
      const r = await N.clear(lv, { name: S.name, rec: S.rec.str(), cor: S.startCor, ticks, s: ME.sp, b: S.opt.b, full: !wasOpen || f === 100, help: [...(S.used || [])] });
      const id = r && r.id; S.clearInfo.id = id; S.clearInfo.opened = !!(r && r.opened);
      if (r && r.opened) { $('clFirst').hidden = false; $('clMsg').textContent = f === 100 ? T('{0}が、世界樹の頂にたどり着いた！', F.name) : T('第{0}層が、いま開いた。あなたが一番乗り', f + 1); SND.se('open'); }
      else $('clMsg').textContent = f === 100 ? T('頂の碑に、あなたの名前が刻まれた') : (wasOpen ? '' : T('ひと足先に越えた仲間がいました。あなたの記録も残りました'));
      if (!wasOpen && id) {
        // 自分で越えたので、この端末では確かめずに開く
        const o = await N.rest('ft_open/' + f).catch(() => null);
        if (o && typeof o.t === 'number') { W.open[f] = o; (ME.ok[N.fac] = ME.ok[N.fac] || {})[f] = r.opened ? { t: o.t, id, n: S.name, x: '' } : { t: o.t, id, n: S.name, x: '', mine: 1 }; saveMe(); computeLatest(); }
      }
      const st = W.stat[f] = W.stat[f] || {}; st.c = (st.c || 0) + 1;
    } catch (e) {
      $('clMsg').textContent = T('記録を送れませんでした（混みあっているか、電波が弱いです）。');
    }
  }
  $('clXsave').onclick = async () => {
    const x = N.cleanX($('clX').value), ci = S.clearInfo;
    if (!x) { toast(T('IDの形がちがいます'), T('英数字と _ で15文字まで')); return; }
    ME.xid = x; saveMe();
    if (!ci || !ci.id) { toast(T('記録を送っている途中です'), T('少し待ってもう一度')); return; }
    try { await N.setXid(ci.f, ci.id, x, ci.opened); const v = (ME.ok[N.fac] || {})[ci.f]; if (v && v.id === ci.id) { v.x = x; saveMe(); } if (W.open[ci.f]) W.open[ci.f].x = x; $('clFirst').hidden = true; toast(T('碑に刻みました'), '@' + x); } catch (e) { toast(T('書きこめませんでした'), T('15分をすぎると、書きこめません')); }
  };
  $('clXskip').onclick = () => { $('clFirst').hidden = true; toast(T('名前だけが刻まれます')); };
  $('clNext').onclick = () => { modal('oClear', 0); startFloor(Math.min(100, S.lv.f + 1)); };
  $('clTitle').onclick = () => { modal('oClear', 0); toTitle(); };
  $('clShare').onclick = () => { openShare(S.clearInfo && S.clearInfo.f === 100 ? 'summit' : 'clear'); };
  // ---------- この端末だけで遊ぶとき（つなぎ先がまだないとき）の屍 ----------
  function localCor(f) { const v = N.store('ft_local_' + f) || []; const m = new Map(); for (const [k, n, s, name] of v) m.set(k, { n, s, name }); return m; }
  function saveLocalCor(f, cor) { const a = []; for (const [k, c] of cor) a.push([k, c.n, c.s, c.name]); N.store('ft_local_' + f, a.slice(-400)); }
  // =============================================
  //  描く（ドット絵の世界＋光）  見た目の部品は art.js
  // =============================================
  const facColor = () => FT.FAC[Math.max(0, N.FACS.indexOf(N.fac))].color;
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  const ART = FT.ART;
  let dark = null, BUF = null, lowQ = false, ftAvg = 16, ftLast = 0;
  const lights = [], labels = [];
  function draw() {
    const lv = S.lv, run = S.watch && S.replay ? S.replay.run : S.run; if (!lv || !run) return;
    const now = performance.now(); if (ftLast) { ftAvg = ftAvg * .95 + Math.min(80, now - ftLast) * .05; lowQ = ftAvg > 26 || !!S.lowQ; } ftLast = now;
    const p = run.p, s = run.t * FT.DT, ta = now / 1000, fcol = facColor(), fA = ART.hex(fcol), sp = S.watch ? (S.replay ? run.sp : -1) : ME.sp, seeAll = S.watch;
    const PXs = ART.PX, Wb = COLS * PXs, Hb = Math.ceil(VH * PXs) + 2;
    if (!BUF) BUF = document.createElement('canvas');
    if (BUF.width !== Wb || BUF.height !== Hb) { BUF.width = Wb; BUF.height = Hb; }
    const b = BUF.getContext('2d'); b.imageSmoothingEnabled = false;
    const camPx = Math.round(S.cam * PXs), cam = camPx / PXs;
    const alt = (lv.f - 1) + Math.max(0, Math.min(1, 1 - (cam + VH / 2) / lv.h)), z = ART.zone(alt);
    const X = x => Math.round(x * PXs), Y = y => Math.round(y * PXs) - camPx;
    const vis = (y, m) => y > cam - (m || 1) && y < cam + VH + (m || 1);
    lights.length = 0; labels.length = 0;
    // ---- 背景・壁 ----
    ART.background(b, z, cam, VH, alt, ta, Hb);
    // 水（奥）
    for (const w of lv.wa || []) {
      if (!vis(w[0], 6) && !vis(w[1], 6)) continue;
      const y0 = Y(w[0]), y1 = Y(w[1]);
      b.fillStyle = 'rgba(40,110,200,.28)'; b.fillRect(PXs, y0, Wb - PXs * 2, y1 - y0);
    }
    ART.exitTop(b, cam, z, ta, lights, !!lv.door);
    ART.walls(b, z, cam, Hb, ta, lights);
    // ---- 枝 ----
    lv.br.forEach((br, i) => {
      if (!vis(br[0], 2)) return;
      if (br[0] === lv.h - 1) { ART.floorFoliage(b, br[0], cam, z, ta, lights, lv.f === 1); return; }
      ART.branch(b, br, i, cam, z, ta, br[3] ? FT.burnAt(br[3], br[4], s) : null, lights);
    });
    // ---- 第1層の根もと：むかし別の塔で眠った、箱の屍がひとつ（遊びには関わらない） ----
    if (lv.f === 1 && vis(lv.h - 1, 2)) {
      const bx = X(17.15), by = Y(lv.h - 1) - 11, w = 11;
      b.fillStyle = 'hsl(18,28%,36%)'; b.fillRect(bx, by, w, w);
      b.fillStyle = 'hsl(18,30%,46%)'; b.fillRect(bx, by, w, 2);
      b.fillStyle = 'rgba(0,0,0,.3)'; b.fillRect(bx, by + w - 2, w, 2); b.fillRect(bx + w - 1, by, 1, w);
      b.fillStyle = '#1a1520';
      for (const ex of [bx + 2, bx + 6]) { b.fillRect(ex, by + 4, 1, 1); b.fillRect(ex + 2, by + 4, 1, 1); b.fillRect(ex + 1, by + 5, 1, 1); b.fillRect(ex, by + 6, 1, 1); b.fillRect(ex + 2, by + 6, 1, 1); }
      b.fillStyle = '#4f8a3c'; b.fillRect(bx + 1, by - 1, 3, 1); b.fillRect(bx + 7, by - 1, 2, 1); b.fillRect(bx, by, 1, 3);
      b.fillStyle = '#7fd06a'; b.fillRect(bx + 8, by - 3, 1, 2); b.fillRect(bx + 7, by - 4, 1, 1); b.fillRect(bx + 9, by - 4, 1, 1);
      lights.push([17.15 + w / PXs / 2, lv.h - 1.4, 1.1, [255, 210, 140], .22 + .06 * Math.sin(ta * 1.3)]);
    }
    // ---- 槍・炎 ----
    const poke = (q, fire) => {
      if (!vis(q[0])) return; const o = FT.pokeOut(q[3], q[4], s), left = q[1] < 0, wx = left ? 1 : COLS - 1, yy = Y(q[0]);
      if (o.warn) { b.globalAlpha = .45 + .45 * Math.sin(s * 30); b.fillStyle = fire ? '#ffb347' : '#ff6a3d'; b.fillRect(left ? X(1) : X(COLS - 1) - 4, yy - 5, 4, 10); b.globalAlpha = 1; if (fire) lights.push([wx, q[0], 1.2, [255, 170, 80], .5]); }
      if (o.out <= 0) return; const len = q[2] * o.out, x0 = left ? wx : wx - len, px0 = X(x0), px1 = X(x0 + len);
      if (fire) {
        const fr = Math.floor(s * 20);
        for (let x = px0; x < px1; x++) {
          const d = left ? (x - px0) / Math.max(1, px1 - px0) : (px1 - x) / Math.max(1, px1 - px0);
          const n1 = ART.h2(x, fr), n2 = ART.h2(x + 7, fr + 3), hgt = Math.max(1, Math.round((6 - d * 4.5) * (.7 + .5 * n1)));
          const up = Math.round(n2 * 2 * d);
          b.fillStyle = '#c8321a'; b.fillRect(x, yy - hgt - 1 - up, 1, hgt * 2 + 2);
          b.fillStyle = '#ff7a2a'; b.fillRect(x, yy - hgt - up, 1, hgt * 2);
          b.fillStyle = d < .7 ? '#ffd24a' : '#ffa040'; b.fillRect(x, yy - Math.ceil(hgt * .6) - up, 1, Math.ceil(hgt * 1.2));
          if (d < .45) { b.fillStyle = '#fff4c8'; b.fillRect(x, yy - Math.ceil(hgt * .25) - up, 1, Math.max(1, Math.ceil(hgt * .5))); }
          if (n1 > .93) { b.fillStyle = '#ffd24a'; b.fillRect(x, yy - hgt - 3 - Math.round(n2 * 3), 1, 1); }
        }
        lights.push([x0 + len / 2, q[0], Math.max(2, len * .6), [255, 150, 60], 1]);
      } else {
        b.fillStyle = '#6a4e36'; b.fillRect(Math.min(px0, px1), yy - 1, Math.abs(px1 - px0), 3); b.fillStyle = '#a07a52'; b.fillRect(Math.min(px0, px1), yy - 1, Math.abs(px1 - px0), 1);
        const tip = left ? px1 : px0, dir = left ? 1 : -1;
        b.fillStyle = '#e8dcc0'; for (let k = 0; k < 7; k++) b.fillRect(tip + dir * k, yy - (3 - Math.floor(k / 2.4)), 1, 1 + 2 * (3 - Math.floor(k / 2.4)));
        b.fillStyle = '#ffffff'; b.fillRect(tip + dir * 5, yy, 1, 1);
      }
    };
    for (const q of lv.sp || []) poke(q, false);
    for (const q of lv.fj || []) poke(q, true);
    // ---- 見えない棘：黒の妖精ははっきり。ほかの妖精は、近くに来たときと、屍のそばだけうっすら ----
    for (const q of lv.tn || []) {
      if (!vis(q[1])) continue;
      let a = sp === 6 || seeAll ? 1 : 0;
      if (!a) { const dx = q[0] - (p.x + PW / 2), dy = q[1] - (p.y + PH / 2); if (dx * dx + dy * dy < 5) a = .35; for (const c of run.cl) { const ex = c.x - q[0], ey = c.y - q[1]; if (ex * ex + ey * ey < 6) { a = Math.max(a, .55); break; } } }
      if (!a) continue;
      const cx = X(q[0]), cy = Y(q[1]), col = sp === 6 ? '#e04a6a' : '#c9a0b0';
      b.globalAlpha = a; b.fillStyle = col;
      for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + Math.floor(ta * 2) * .1; for (let r = 3; r < 10; r++) b.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 1, 1); }
      ART.dotEllipse(b, cx, cy, 3.5, 3.5, 0, sp === 6 ? '#5a1424' : '#4a3a40', sp === 6 ? '#8a2a40' : '#6a5a60');
      b.globalAlpha = 1;
      if (sp === 6) lights.push([q[0], q[1], 1.2, [224, 74, 106], .5 * a]);
    }
    // ---- 屍（浮かぶ足場） ----
    //  妖精から遠い屍・通り過ぎた下の屍は、うすく暗くする（いま昇っている所の足場だけが目立つように）
    const rx = S.watch ? 10 : p.x + PW / 2, ry = S.watch ? cam + VH * .5 : p.y + PH / 2;
    for (const c of run.cl) {
      if (!vis(c.y, 2)) continue;
      const dx = c.x - rx, dy = c.y - ry, d = Math.hypot(dx, dy * .8);
      let fade = d < 4 ? 1 : d > 10 ? .42 : 1 - (d - 4) / 6 * .58;
      if (!S.watch && dy > 6) fade = Math.min(fade, .3);
      const src0 = S.cor.get(c.k); if (src0 && src0.glow > 0) fade = Math.max(fade, .6 + .4 * src0.glow);
      b.globalAlpha = fade;
      const src = S.cor.get(c.k) || {}, bob = Math.round(Math.sin(ta * 1.6 + c.x) * 1);
      if (src.glow > 0) src.glow = Math.max(0, src.glow - .01);
      const col = c.s === 2 ? '#ff9ccf' : fcol, wpx = Math.round(c.w * PXs), pad = ART.padCanvas(wpx, col, c.s === 4 ? 4 : c.s === 2 ? 2 : 0);
      const cx = X(c.x), cy = Y(c.y) + bob, n = src.nAll || c.n, face = (c.k % 2) ? 1 : -1;
      b.drawImage(pad, cx - (wpx + 4) / 2, cy - 2);
      if (n >= 3) ART.sleeper(b, c.s, cx - 4 * face, cy - 14, -face, .55 * fade);
      if (n >= 2) ART.sleeper(b, c.s, cx + 4 * face, cy - 13, face, .7 * fade);
      ART.sleeper(b, c.s, cx, cy - 12, face);
      b.globalAlpha = 1;
      if (c.shield && run.t - c.shield < 30) { b.globalAlpha = 1 - (run.t - c.shield) / 30; ART.dotEllipse(b, cx, cy - 4, 9, 9, 0, 'rgba(255,210,154,.6)', '#ffd29a'); b.globalAlpha = 1; }
      lights.push([c.x, c.y - .4, 1.8 + Math.min(1.4, n * .12), ART.hex(col), (.75 + .5 * (src.glow || 0) + Math.min(.25, n * .02)) * (.35 + .65 * fade)]);
      // 名前は、見るモードのときだけ出す（遊んでいる間は出さない）
      if (S.watch) labels.push([c.x, c.y - 1.3 + bob / PXs, n > 1 ? `${src.name || ''}　${T('{0}人', fmt(n))}` : (src.name || '')]);
    }
    // ---- 灰の足場 ----
    if (run.block) { const bk = run.block; ART.spr(b, 'stone', X(bk.x - 1.1), Y(bk.y) - 3, false, Math.round(2.2 * PXs), 12); }
    // ---- 蛾・蜂 ----
    (lv.mo || []).forEach((m, i) => {
      const fz = run.mothFrozen(i), q = fz ? { x: fz.x, y: fz.y } : FT.mothAt(m, s); if (!vis(q.y)) return;
      if (m[5] === 1) { const q2 = FT.mothAt(m, s + .02); ART.bee(b, X(q.x), Y(q.y), s, !!fz, m[4], q2.x >= q.x ? -1 : 1); }
      else { ART.moth(b, X(q.x), Y(q.y), s, !!fz, m[4]); lights.push([q.x, q.y, 1, [170, 120, 230], .35]); }
    });
    // ---- 実 ----
    const fruit = (x, y, a) => { b.globalAlpha = a; ART.dotEllipse(b, x, y, 4.5, 4.5, 0, '#ff7a3d', '#c8452a'); b.fillStyle = '#ffd29a'; b.fillRect(x - 2, y - 2, 2, 1); b.fillStyle = '#4a3324'; b.fillRect(x, y - 6, 1, 2); b.fillStyle = '#5aa04a'; b.fillRect(x + 1, y - 6, 2, 1); b.globalAlpha = 1; };
    for (const fr of lv.fr || []) { const f = (((s + fr[3]) % fr[2]) + fr[2]) % fr[2] / fr[2]; if (f > .1 && f < .3 && vis(fr[1] - 12)) fruit(X(fr[0]), Y(fr[1] - 12 + .2), .45 + .3 * Math.sin(s * 20)); }
    for (const d of run.drops) { if (d.done || !vis(d.y)) continue; fruit(X(d.x), Y(d.y), 1); }
    // ---- 自分 ----
    let me = null;
    if ((!run.over || run.clear) && (!S.watch || S.replay) && sp >= 0) {
      const pal = ART.spPal(FT.SP[sp]), pose = p.fly ? 'fly' : (!p.on && p.vy > 3 ? 'fall' : 'stand');
      const fl = p.fly ? .5 + .5 * Math.sin(ta * 34) : .25 + .2 * Math.sin(ta * 3);
      const fx = X(p.x + PW / 2), fy = Y(p.y + PH) + 1;
      const low = !p.on && !run.over && p.gauge > 0 && p.gauge < .25 && !(p.wet && sp === 7);
      ART.fairy(b, sp, fx, fy, p.face || 1, pose, fl, low && Math.floor(ta * 12) % 2 ? .45 : 1);
      if (low) { lights.push([p.x + PW / 2, p.y + PH / 2, 1.6, [255, 110, 70], .6]); if (!S.watch && ta - (S.warnT || 0) > .22) { S.warnT = ta; SND.se('warn'); } }
      if (p.gauge < 1) { b.fillStyle = 'rgba(0,0,0,.6)'; b.fillRect(fx - 8, fy - 21, 16, 3); b.fillStyle = p.gauge > .25 ? (p.wet ? '#9fd4ff' : '#7fe3c9') : '#ff9a5c'; b.fillRect(fx - 7, fy - 20, Math.max(0, Math.round(14 * p.gauge)), 1); }
      lights.push([p.x + PW / 2, p.y + PH / 2, 3.6, pal.glow, 1]);
      if (p.fly && !S.paused && Math.random() < .5) S.fx.push({ x: p.x + PW / 2 - (p.face || 1) * .25, y: p.y + PH * .55, vx: (Math.random() - .5) * .8, vy: .6 + Math.random() * .6, life: .55, c: pal.glow, spark: 1 });
      me = { x: p.x + PW / 2, y: p.y + PH / 2 };
    }
    // ---- 散る光（小さな絵の上） ----
    for (const e of S.fx) {
      e.life -= 1 / 60; if (e.ring || e.life <= 0) continue;
      e.x += e.vx / 60; e.y += e.vy / 60; e.vy += e.spark ? -.01 : .1;
      b.globalAlpha = Math.min(1, e.life * 1.5); b.fillStyle = Array.isArray(e.c) ? ART.css(e.c) : e.c; b.fillRect(X(e.x), Y(e.y), 1, 1);
      if (e.spark && e.life > .3) lights.push([e.x, e.y, .5, Array.isArray(e.c) ? e.c : ART.hex(e.c), .5]);
    }
    b.globalAlpha = 1;
    // 水の面
    for (const w of lv.wa || []) {
      if (!vis(w[0], 2)) continue; const y0 = Y(w[0]);
      for (let x = PXs; x < Wb - PXs; x++) { const off = Math.round(Math.sin(x * .2 + ta * 3) * 1); b.fillStyle = 'rgba(191,233,255,.75)'; b.fillRect(x, y0 + off, 1, 1); }
      for (let k = 0; k < 8; k++) { const bx = PXs + Math.floor(ART.hash(k * 9 + w[0]) * (Wb - PXs * 2)), by = Y(w[1]) - ((ta * 18 + k * 37) % Math.max(4, Y(w[1]) - y0)); b.fillStyle = 'rgba(191,233,255,.5)'; b.fillRect(bx, Math.round(by), 1, 1); }
      lights.push([10, w[0], 6, [90, 170, 255], .35]);
    }
    // ---- 画面へ（のばす）----
    let sx = 0; if (S.shake > 0) { S.shake = Math.max(0, S.shake - 1 / 60); sx = (Math.random() - .5) * S.shake * .3; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false; g.drawImage(BUF, 0, 0, Wb, Hb, Math.round(sx * S_), 0, Math.round(Wb * S_ / PXs), Math.round(Hb * S_ / PXs));
    // ---- 光 ----
    ART.lighting(g, cv.width, cv.height, S_, cam, sx, z, lights, { t: ta, low: lowQ });
    // 輪（黄の技）
    g.setTransform(S_, 0, 0, S_, sx * S_, -cam * S_);
    for (const e of S.fx) { if (!e.ring || e.life <= 0) continue; g.globalAlpha = e.life; g.strokeStyle = e.c; g.lineWidth = .08; g.beginPath(); g.arc(e.x, e.y, (1 - e.life / .6) * 5, 0, 7); g.stroke(); }
    g.globalAlpha = 1; S.fx = S.fx.filter(e => e.life > 0);
    // 頂上の扉
    if (lv.door && vis(1.4, 3)) { const open = S.opt.door; g.fillStyle = open ? 'rgba(255,231,163,.25)' : '#3b2a12'; g.fillRect(1, .2, COLS - 2, 1.2); if (!open) { g.fillStyle = '#c9a14a'; for (let x = 1.5; x < COLS - 1; x += 1.2) g.fillRect(x, .2, .18, 1.2); g.fillRect(1, 1.25, COLS - 2, .15); } g.fillStyle = '#ffe7a3'; g.font = '700 .5px "Zen Kaku Gothic New", sans-serif'; g.textAlign = 'center'; g.fillText(open ? T('頂上の扉は開いている') : T('頂上の扉（ほかの陣営が第{0}層に着くと開く）', V.DOOR_AT), 10, 2.2); }
    // 屍の名前
    g.font = '700 .34px "Zen Kaku Gothic New", sans-serif'; g.textAlign = 'center';
    for (const L of labels) { if (!L[2]) continue; const near = me ? Math.hypot(L[0] - me.x, L[1] - me.y) : 9; g.globalAlpha = near < 4 ? 1 : .55; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(L[2], L[0] + .03, L[1] + .03); g.fillStyle = '#e9f3ef'; g.fillText(L[2], L[0], L[1]); }
    g.globalAlpha = 1;
    // ---- 闇：紫の妖精はよく見える。ほかの妖精は、自分と屍のまわりだけ明るい ----
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
    if (FT.UI.overlay) FT.UI.overlay(g, cv.width, cv.height, dpr, S, S_, cam);
  }
  // ---------- 操作 ----------
  const KM = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'j', KeyW: 'j', Space: 'j', KeyZ: 'j', KeyX: 'k', KeyK: 'k', ShiftLeft: 'k', ShiftRight: 'k' };
  addEventListener('keydown', e => { if (!$('game').classList.contains('on') || document.querySelector('.over.on')) return; const k = KM[e.code]; if (k) { S.keys[k] = 1; e.preventDefault(); SND.unlock(); } if (e.code === 'Escape') { if (FT.UI.pause && !S.watch) FT.UI.pause(); else toTitle(); } });
  addEventListener('keyup', e => { const k = KM[e.code]; if (k) S.keys[k] = 0; });
  addEventListener('blur', () => { S.keys.l = S.keys.r = S.keys.j = S.keys.k = 0; padRelease(); });

  // ---------- スマホのボタン（指を追いかける） ----------
  //  ・ボタンのまわりの「ゾーン」で指を受ける。すき間を押しても、いちばん近いボタンが効く
  //  ・押したまま指をすべらせると、すべらせた先のボタンに切りかわる（◀から▶へ、など）
  //  ・指1本ずつを別々に追いかける（左手で動きながら右手で跳んでも、両方効く）
  //  ・指がゾーンの外に出ても、離すまでは押したまま
  function bindPad(zones, keys, onPress) {
    const ptr = new Map(), cnt = {}, els = {};
    for (const z of zones) for (const b of z.btns) els[b.k] = b.el;
    const set = (k, d) => { cnt[k] = Math.max(0, (cnt[k] || 0) + d); keys[k] = cnt[k] > 0 ? 1 : 0; if (els[k]) els[k].classList.toggle('on', keys[k] === 1); };
    const pick = (z, x, y) => { let best = z.btns[0], bd = Infinity; for (const b of z.btns) { const r = b.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = (x - cx) * (x - cx) + (y - cy) * (y - cy) * 0.25; if (d < bd) { bd = d; best = b; } } return best.k; };
    for (const z of zones) {
      z.el.addEventListener('pointerdown', e => { e.preventDefault(); try { z.el.setPointerCapture(e.pointerId); } catch (er) { } if (ptr.has(e.pointerId)) return; const k = pick(z, e.clientX, e.clientY); ptr.set(e.pointerId, { z, k }); set(k, 1); if (onPress) onPress(); });
      z.el.addEventListener('pointermove', e => { const p = ptr.get(e.pointerId); if (!p) return; const k = pick(p.z, e.clientX, e.clientY); if (k !== p.k) { set(p.k, -1); p.k = k; set(k, 1); } });
      const up = e => { const p = ptr.get(e.pointerId); if (!p) return; ptr.delete(e.pointerId); set(p.k, -1); };
      z.el.addEventListener('pointerup', up); z.el.addEventListener('pointercancel', up); z.el.addEventListener('lostpointercapture', up);
      z.el.addEventListener('contextmenu', e => e.preventDefault());
    }
    const release = () => { for (const p of ptr.values()) set(p.k, -1); ptr.clear(); for (const k in cnt) if (cnt[k]) { cnt[k] = 0; keys[k] = 0; if (els[k]) els[k].classList.remove('on'); } };
    // 守り：画面からすべての指が離れたら、どのボタンも必ず離したことにする（「離した」が届かなかったときの押しっぱなしを防ぐ）
    const allUp = e => { if (!e.touches || e.touches.length === 0) release(); };
    document.addEventListener('touchend', allUp, true); document.addEventListener('touchcancel', allUp, true);
    return release;
  }
  const padRelease = bindPad([{ el: $('zL'), btns: [{ el: $('bl'), k: 'l' }, { el: $('br'), k: 'r' }] }, { el: $('zR'), btns: [{ el: $('bSk'), k: 'k' }, { el: $('bj'), k: 'j' }] }], S.keys, () => SND.unlock());
  addEventListener('contextmenu', e => { if ($('game').classList.contains('on')) e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { N.flush().catch(() => { }); padRelease(); } });
  // =============================================
  //  投稿
  // =============================================
  let shareMode = 'title';
  function shareInfo() {
    const F = ME.sp === null || ME.sp === undefined ? null : FT.FAC[facOf(ME.sp)];
    const ci = S.clearInfo;
    if (shareMode === 'summit') return { F, head: T('世界樹の頂にたどり着いた！'), line: `Fairies' Tower ${T('世界樹の頂にたどり着いた！')} (${F.name})`, f: 100 };
    if (shareMode === 'clear' && ci) return { F, head: T('第{0}層突破！', ci.f), line: `Fairies' Tower ${T('{0}人の屍を越えて、第{1}層突破！', fmt(ci.deadN), ci.f)} (${F.name})`, f: ci.f };
    if (shareMode === 'game' && S.lv) { const pct = Math.min(99, Math.floor(Math.max(0, 1 - (S.run.p.top - 1.2) / (S.lv.h - 2.2)) * 100)); return { F, head: T('第{0}層まで到達！', S.lv.f), line: `Fairies' Tower ${T('第{0}層まで到達！', S.lv.f)} (${F.name})`, f: S.lv.f, pct }; }
    const f = F ? Math.max(ME.best[N.fac] || 1, 1) : W.latest;
    return { F, head: T('第{0}層まで到達！', f), line: F ? `Fairies' Tower ${T('第{0}層まで到達！', f)} (${F.name})` : `Fairies' Tower`, f };
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
    x.fillStyle = '#93aaa3'; x.font = `28px ${font}`; x.fillText(T('3つの陣営で、'), 620, 440); x.fillText(T('世界樹のてっぺんを目指す'), 620, 480); x.fillText('#FairiesTower', 620, 540);
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
    const body = $('stBody'); body.innerHTML = `<p class="note">${T('読みこみ中…')}</p>`;
    const F = ME.sp === null || ME.sp === undefined ? FT.FAC[0] : FT.FAC[facOf(ME.sp)];
    try {
      if (tab === 'first') {
        await getFloors();
        const rows = []; for (let f = 1; f <= 100; f++) { if (!okFloor(f)) break; const o = opener(f); rows.push(`<li><b>${T('第{0}層', f)}</b> ${esc(FLOORS[f - 1].name)}<br>${esc(o ? o.n : T('名無し'))}${o && o.x ? '　@' + esc(o.x) : ''}</li>`); }
        body.innerHTML = `<p class="note">${T('{0}で、各層をはじめて越えた妖精。XのIDは本人の申告で、本当にその人かは確かめていません。', esc(F.name))}</p><ol class="names">${rows.length ? rows.join('') : `<li>${T('まだだれもいない')}</li>`}</ol>`;
      } else {
        if (OFFLINE) { body.innerHTML = `<p class="note">${T('つなぎ先が入るまでは、頂の碑は見られません。')}</p>`; return; }
        const out = [];
        for (let i = 0; i < 3; i++) { const fid = N.FACS[i]; if (!N.ready(fid)) continue; const v = await N.rest('ft_clear/100', { orderBy: 't', limitToFirst: 300 }, fid).catch(() => null); const list = Object.values(v || {}).filter(c => c && c.n).sort((a, b) => a.t - b.t); out.push(`<h3 style="margin:6px 0;color:${FT.FAC[i].color};font-size:15px">${esc(FT.FAC[i].name)}</h3><ol class="names">${list.length ? list.map(c => `<li>${esc(N.cleanName(c.n) || '名無し')}${N.cleanX(c.x) ? '　@' + esc(N.cleanX(c.x)) : ''}<small>${new Date(c.t).toLocaleString(FT.LOCALE || 'ja-JP')}</small></li>`).join('') : `<li>${T('まだだれもいない')}</li>`}</ol>`); }
        body.innerHTML = `<p class="note">${T('世界樹の頂にたどり着いた妖精。')}</p>${out.join('')}`;
      }
    } catch (e) { body.innerHTML = `<p class="note">${T('読みこめませんでした')}</p>`; }
  }
  for (const b of document.querySelectorAll('#oStone .tabs button')) b.onclick = () => openStone(b.dataset.t);
  $('bStone').onclick = () => openStone('first');
  $('stClose').onclick = () => modal('oStone', 0);
  // =============================================
  //  層をえらぶ
  // =============================================
  $('bFloors').onclick = async () => {
    if (ME.sp === null || ME.sp === undefined) { toast(T('まず妖精をえらんでください')); return; }
    await getFloors();
    const box = $('flList'); box.innerHTML = '';
    for (let f = 1; f <= W.latest; f++) { const b = document.createElement('button'); b.textContent = f; if (f === W.latest) b.className = 'now'; b.setAttribute('aria-label', `${T('第{0}層', f)} ${FLOORS[f - 1].name}`); b.onclick = () => { modal('oFloors', 0); startFloor(f, { watch: flMode === 'watch' }); }; box.appendChild(b); }
    modal('oFloors', 1);
  };
  $('flClose').onclick = () => modal('oFloors', 0);
  let flMode = 'play';
  for (const b of document.querySelectorAll('#oFloors .tabs button')) b.onclick = () => { flMode = b.dataset.m; for (const x of document.querySelectorAll('#oFloors .tabs button')) x.classList.toggle('on', x === b); $('flNote').textContent = flMode === 'watch' ? T('自分は昇らずに、その層の屍と仕掛けを見られます。一番乗りの昇り方も再生できます。') : T('開いた層なら、どこからでも昇れます。いちばん新しい層が、陣営の最前線です。'); };
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
    $('hFloor').innerHTML = `${T('第{0}層', lv.f)}<small>${esc(lv.name)}</small>`;
    $('hFac').innerHTML = `<span style="color:${F.color}">${esc(F.name)}</span>${T('・')}${T('見る')}`;
    $('hName').textContent = T('見る：指でなぞるか ↑↓ で動かす');
    updateHud();
    SND.bgm(themeSong(lv));
  }
  function watchStep(dt) {
    const lv = S.lv, R = S.replay;
    S.acc += dt;
    while (S.acc >= FT.DT) {
      S.acc -= FT.DT;
      if (S.run) { S.run.step(0); S.run.events.length = 0; if (S.run.p.y > lv.h + 400) S.run.p.y = lv.h + 200; }
      if (R && !R.run.over) { R.run.step(R.inp(R.run.t + 1)); R.run.events.length = 0; if (R.run.over && !S.clip) toast(R.run.clear ? T('「{0}」 越えた！', R.name) : T('記録はここまで'), '', 2000); }
    }
    if (R && S.follow && !R.run.over) S.cam += (Math.max(0, Math.min(lv.h - VH, R.run.p.y - VH * .55)) - S.cam) * Math.min(1, dt * 8);
    else { const sp = 18 * dt; if (S.keys.j || S.keys.up) S.cam -= sp; if (S.keys.dn) S.cam += sp; }
    S.cam = Math.max(0, Math.min(lv.h - VH, S.cam));
  }
  // ---------- 死にざまを動画にする ----------
  //  さっきの挑戦の最後の5秒を、同じ計算で再生しながら、画面をそのまま録画する（ほかの人には送らない）
  function pickMime() { const M = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null; if (!M || !cv.captureStream) return null; for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) if (M.isTypeSupported(t)) return t; return null; }
  (FT.UI = FT.UI || {}).canClip = () => !!pickMime();
  async function deathClip() {
    const d = S.lastDeath; if (!d || S.clip || S.watch || d.lv !== S.lv) return null;
    const mime = pickMime(); if (!mime) { toast(T('この端末では動画を作れません')); return null; }
    const keep = { run: S.run, acc: S.acc, cam: S.cam, fx: S.fx };
    const r = new FT.Run(d.lv, FT.corParse(d.cor), d.opt), inp = FT.Rec.parse(d.rec), start = Math.max(0, d.t - 600);
    while (r.t < start && !r.over) { r.step(inp(r.t + 1)); r.events.length = 0; }
    S.clip = { name: d.name, sub: d.sub, f: d.lv.f, endT: d.t, died: 0 };
    S.run = null; S.replay = { run: r, inp, name: d.name }; S.follow = true; S.watch = true; S.acc = 0; S.fx = []; S.dieAt = 0; S.clearAt = 0; S.enterAt = performance.now();
    S.cam = Math.max(0, Math.min(d.lv.h - VH, r.p.y - VH * .55));
    $('game').classList.add('clipping');
    const stream = cv.captureStream(30), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 }), chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = res; });
    rec.start(250);
    await new Promise(res => { const t0 = performance.now(); const chk = () => { const R = S.replay; if (R && R.run.over && !S.clip.died) { S.clip.died = performance.now(); S.dieAt = S.clip.died; S.shake = .5; SND.se('die'); } if ((S.clip.died && performance.now() - S.clip.died > 1700) || performance.now() - t0 > 9000) res(); else setTimeout(chk, 50); }; chk(); });
    rec.stop(); await done; stream.getTracks().forEach(t => t.stop());
    // もとにもどす
    S.watch = false; S.replay = null; S.follow = false; S.clip = null; S.dieAt = 0; S.fx = keep.fx; S.cam = keep.cam; S.acc = 0;
    $('game').classList.remove('clipping');
    S.run = keep.run; if (!S.run || S.run.over) spawn(false);
    return new Blob(chunks, { type: mime.split(';')[0] });
  }
  (FT.UI = FT.UI || {}).deathClip = deathClip;
  async function watchReplay() {
    const f = S.lv.f, o = W.okSnap[f] || (ME.ok[N.fac] || {})[f] || W.open[f];
    if (!o || !o.id || OFFLINE) { toast(T('まだだれも、この層を越えていません')); return; }
    try {
      const c = await N.rest('ft_clear/' + f + '/' + o.id);
      if (!c || typeof c.r !== 'string') throw 0;
      S.replay = { run: new FT.Run(S.lv, FT.corParse(c.c), { sp: c.s | 0, b: c.b | 0, door: true }), inp: FT.Rec.parse(c.r), name: N.cleanName(c.n) || '名無し' };
      S.follow = true;
      toast(T('はじめて越えた「{0}」の昇り方', S.replay.name), T('屍は、そのときの屍です'), 2400);
    } catch (e) { toast(T('記録を読みこめませんでした')); }
  }
  $('wReplay').onclick = () => { SND.unlock(); watchReplay(); };
  $('wFree').onclick = () => { S.follow = false; S.replay = null; };
  $('wPlay').onclick = () => { if (ME.sp === null || ME.sp === undefined) { toTitle(); toast(T('まず妖精をえらんでください')); return; } const f = S.lv.f; if (f > W.latest) { toast(T('まだ開いていない層です')); return; } startFloor(f); };
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
  function myCode() { return 'FT1' + b64e(JSON.stringify({ s: ME.sp, b: ME.best, d: ME.dead, x: ME.xid || '', m: (ME.mine || []).map(o => [o.a, o.f, o.k, o.n]) })); }
  $('bCode').onclick = () => { $('cdMine').value = myCode(); $('cdIn').value = ''; modal('oCode', 1); };
  $('cdCopy').onclick = async () => { try { await navigator.clipboard.writeText($('cdMine').value); toast(T('コードをうつしました')); } catch (e) { $('cdMine').select(); toast(T('コードをえらびました'), T('長押ししてコピーしてください')); } };
  $('cdLoad').onclick = () => {
    const v = $('cdIn').value.trim();
    try {
      if (!/^FT1/.test(v)) throw 0; const o = JSON.parse(b64d(v.slice(3)));
      if (o.s !== null && o.s !== undefined && FT.SP[o.s]) ME.sp = o.s;
      for (const k of N.FACS) if (o.b && +o.b[k] >= 1 && +o.b[k] <= 100) ME.best[k] = Math.max(ME.best[k] || 0, +o.b[k]);
      ME.dead = Math.max(ME.dead || 0, +o.d || 0); if (o.x) ME.xid = N.cleanX(o.x);
      if (Array.isArray(o.m)) { const had = new Set((ME.mine || []).map(q => mineKey(q.a, q.f, q.k))); for (const q of o.m) { if (!Array.isArray(q) || !N.FACS.includes(q[0]) || !(+q[1] >= 1 && +q[1] <= 100) || !(+q[2] >= 0)) continue; if (!had.has(mineKey(q[0], +q[1], +q[2]))) ME.mine.push({ a: q[0], f: +q[1], k: +q[2], n: N.cleanName(q[3]) || '名無し', t: 0 }); } ME.mine = ME.mine.slice(-50); helpAt = 0; }
      saveMe(); if (ME.sp !== null && ME.sp !== undefined) N.fac = fidOf(ME.sp);
      modal('oCode', 0); toast(T('読みこみました')); refresh(true);
    } catch (e) { toast(T('コードの形がちがいます')); }
  };
  $('cdClose').onclick = () => modal('oCode', 0);
  // =============================================
  //  あそびかた・音
  // =============================================
  $('howSp').innerHTML = FT.SP.map(sp => `<tr><td style="color:${sp.color === '#3a3f4a' ? '#9aa3b4' : sp.color}">${esc(sp.name)}</td><td>${esc(FT.FAC[sp.fac].name)}<br>${esc(sp.how)}</td></tr>`).join('');
  function openHow() { modal('oHow', 1); S.paused = true; }
  $('howClose').onclick = () => { modal('oHow', 0); S.paused = false; };
  $('bHow').onclick = openHow; $('gHow').onclick = openHow;
  function paintSnd() { $('bSnd').textContent = SND.on ? T('♪ 音あり') : T('♪ 音なし'); }
  $('bSnd').onclick = () => { SND.unlock(); SND.setOn(!SND.on); paintSnd(); };
  // =============================================
  //  タイトルへ
  // =============================================
  function toTitle() { N.flush().catch(() => { }); S.run = null; S.lv = null; S.watch = false; S.replay = null; $('game').classList.remove('watching'); SND.bgm(null); show('title'); helpAt = 0; refresh(); }
  $('gBack').onclick = () => { if (FT.UI.pause && !S.watch) FT.UI.pause(); else toTitle(); };
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
  FT.UI = Object.assign(FT.UI || {}, { show, toast, startFloor, toTitle, W, ME, refresh, okFloor, S, modal, openHow, paint: () => title.paint(), paintSnd, getFloors, OFFLINE, newName, pickSp });
})(window);
