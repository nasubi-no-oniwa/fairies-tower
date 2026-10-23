// =============================================
//  画面の流れと見た目（はじまり・タイトルの景色・妖精えらび・一時停止・設定・層の帯・死と突破の演出）
//  ゲームの中身（engine.js）にはさわらない。main.js が FT.UI に出したものだけを使う
// =============================================
(function (G) {
  const FT = G.FT, UI = FT.UI, ART = FT.ART, SND = FT.SND, S = UI.S, T = FT.T;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  const hasSp = () => UI.ME.sp !== null && UI.ME.sp !== undefined;
  const spCol = sp => FT.SP[sp].color === '#3a3f4a' ? '#9aa3b4' : FT.SP[sp].color;

  // ---------- ボタンの音 ----------
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.classList.contains('sp') || b.closest('#pad')) return;
    SND.unlock();
    if (/Close$|^psResume$|^moClose$|^setClose$|^howClose$/.test(b.id)) SND.se('close');
    else if (b.id === 'bGo' || b.id === 'clNext') SND.se('start');
    else SND.se(b.classList.contains('mb') || b.classList.contains('li') || b.id === 'meCard' ? 'ui' : 'tap');
  }, true);

  // =============================================
  //  タイトルの景色（夜の森と、遠くの世界樹と、ほたる）
  // =============================================
  const tbg = $('tbg'), tg = tbg.getContext('2d');
  const PX = 2;   // 1ドット＝画面の2点
  const flies = [];
  for (let i = 0; i < 34; i++) flies.push({ x: Math.random(), y: .35 + Math.random() * .65, p: Math.random() * 7, s: .4 + Math.random() * .8, c: Math.random() < .7 ? [255, 236, 150] : [150, 255, 210] });
  const stars = [];
  for (let i = 0; i < 90; i++) stars.push([Math.random(), Math.random() * .5, Math.random() * 7, Math.random() < .12 ? 2 : 1]);
  let tW = 0, tH = 0;
  function tSize() {
    const r = tbg.getBoundingClientRect(), w = Math.max(40, Math.ceil(r.width / PX)), h = Math.max(40, Math.ceil(r.height / PX));
    if (w !== tW || h !== tH) { tW = tbg.width = w; tH = tbg.height = h; }
  }
  function worldTree(c, cx, base, top, t) {
    // 遠くの世界樹（影）。幹と根、上に光る梢
    const tw = Math.max(18, Math.round(tW * .16));
    c.fillStyle = '#0d1830';
    for (let y = top + 30; y < base; y++) {
      const k = (y - top) / (base - top), w = tw * (.55 + .45 * k * k) + (k > .85 ? (k - .85) * tw * 6 : 0), sway = Math.sin(y * .05) * 2;
      c.fillRect(Math.round(cx - w / 2 + sway), y, Math.round(w), 1);
    }
    // 幹の筋（かすかに光る）
    c.fillStyle = 'rgba(120,170,255,.10)';
    for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * tw * .22; for (let y = top + 40; y < base; y += 2) c.fillRect(Math.round(cx + ox + Math.sin(y * .04 + i) * 2), y, 1, 1); }
    // 枝
    c.fillStyle = '#0d1830';
    for (let i = 0; i < 7; i++) {
      const y = top + 40 + i * (base - top - 60) / 7, d = i % 2 ? 1 : -1, L = tw * (1.4 - i * .1);
      for (let k = 0; k < L; k++) c.fillRect(Math.round(cx + d * (tw * .3 + k)), Math.round(y - k * .35), 1, 2);
    }
    // 梢
    const cr = tW * .42;
    const gl = c.createRadialGradient(cx, top + 10, 2, cx, top + 10, cr * 1.3);
    gl.addColorStop(0, 'rgba(255,236,170,.55)'); gl.addColorStop(.35, 'rgba(255,214,140,.16)'); gl.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = gl; c.fillRect(cx - cr * 1.4, top - cr, cr * 2.8, cr * 2.6);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, r = cr * (.45 + .4 * ART.hash(i * 3.1)), x = cx + Math.cos(a) * r, y = top + 18 + Math.sin(a) * r * .45;
      c.fillStyle = '#0c1a2c'; c.beginPath(); c.ellipse(Math.round(x), Math.round(y), 9 + ART.hash(i) * 9, 6 + ART.hash(i + 9) * 5, 0, 0, 7); c.fill();
    }
    c.fillStyle = '#0c1a2c'; c.beginPath(); c.ellipse(cx, top + 18, cr * .7, cr * .32, 0, 0, 7); c.fill();
    // 梢の実（光る）
    for (let i = 0; i < 16; i++) {
      const x = cx + (ART.hash(i * 7.7) - .5) * cr * 1.6, y = top + 8 + ART.hash(i * 5.3) * cr * .5, a = .5 + .5 * Math.sin(t * 1.4 + i);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .35 * a; c.drawImage(ART.glow('#ffe9a8'), x - 5, y - 5, 10, 10); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(255,240,190,${.5 + .5 * a})`; c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  function drawTitleBG(now) {
    tSize();
    const t = now / 1000, c = tg, scroll = ($('title').scrollTop || 0) / PX;
    c.imageSmoothingEnabled = false; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const sky = c.createLinearGradient(0, 0, 0, tH);
    sky.addColorStop(0, '#050a1a'); sky.addColorStop(.35, '#0c1a38'); sky.addColorStop(.7, '#16284a'); sky.addColorStop(1, '#0a1222');
    c.fillStyle = sky; c.fillRect(0, 0, tW, tH);
    for (const s of stars) { const a = .35 + .65 * Math.abs(Math.sin(t * .8 + s[2])); c.fillStyle = `rgba(220,235,255,${a * .8})`; c.fillRect(Math.round(s[0] * tW), Math.round(s[1] * tH - scroll * .05), s[3], s[3]); }
    // 月
    const mx = Math.round(tW * .8), my = Math.round(tH * .09 - scroll * .08);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.drawImage(ART.glow('#bcd6ff'), mx - 40, my - 40, 80, 80); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#e8f0ff'; c.beginPath(); c.arc(mx, my, 7, 0, 7); c.fill(); c.fillStyle = '#0a1530'; c.beginPath(); c.arc(mx + 3, my - 2, 6, 0, 7); c.fill();
    // 世界樹
    const fb = ART.title.front, bk = ART.title.back;
    const frontH = Math.min(308, Math.round(tH * .5)), frontTop = tH - frontH;
    worldTree(c, Math.round(tW / 2), Math.round(tH * .78), Math.round(tH * .12 - scroll * .12), t);
    // 霧
    const fog = c.createLinearGradient(0, tH * .35, 0, tH * .7); fog.addColorStop(0, 'rgba(60,90,140,0)'); fog.addColorStop(1, 'rgba(60,90,140,.28)'); c.fillStyle = fog; c.fillRect(0, tH * .35, tW, tH * .4);
    // 奥の森
    if (bk && bk.complete && bk.naturalWidth) {
      const sy = 120, sh = 230, dy = Math.round(frontTop - sh * .55 + scroll * .06), off = Math.floor(t * 2) % 928;
      c.globalAlpha = .85;
      for (let x = -off; x < tW; x += 928) c.drawImage(bk, 0, sy, 928, sh, x, dy, 928, sh);
      c.globalAlpha = 1;
      const fg = c.createLinearGradient(0, dy, 0, dy + 60); fg.addColorStop(0, 'rgba(10,18,34,1)'); fg.addColorStop(1, 'rgba(10,18,34,0)'); c.fillStyle = fg; c.fillRect(0, dy - 2, tW, 62);
    }
    // 手前の森
    if (fb && fb.complete && fb.naturalWidth) {
      const sy = 598 - frontH, off = Math.floor(t * 5 + 300) % 928, dy = Math.round(frontTop + scroll * .12);
      for (let x = -off; x < tW; x += 928) c.drawImage(fb, 0, sy, 928, frontH, x, dy, 928, frontH);
      const fg = c.createLinearGradient(0, dy, 0, dy + 70); fg.addColorStop(0, 'rgba(10,16,30,1)'); fg.addColorStop(1, 'rgba(10,16,30,0)'); c.fillStyle = fg; c.fillRect(0, dy - 2, tW, 72);
    }
    // ほたる
    c.globalCompositeOperation = 'lighter';
    for (const f of flies) {
      const x = ((f.x * tW + t * 4 * f.s + Math.sin(t * .7 * f.s + f.p) * 10) % (tW + 20) + tW + 20) % (tW + 20) - 10;
      const y = f.y * tH + Math.sin(t * .9 * f.s + f.p * 2) * 8, a = .5 + .5 * Math.sin(t * 2.2 * f.s + f.p);
      c.globalAlpha = .55 * a; c.drawImage(ART.glow(f.c), x - 6, y - 6, 12, 12);
      c.globalAlpha = a; c.fillStyle = `rgb(${f.c})`; c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  // =============================================
  //  あなたの妖精（タイトルのカード）と、妖精えらびのカード
  // =============================================
  function drawSp(cv, sp, t, big) {
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = false;
    const fl = (Math.sin(t * 9 + sp) + 1) / 2, bob = Math.round(Math.sin(t * 2.4 + sp) * (big ? 1 : .6));
    ART.fairy(c, sp, cv.width / 2, cv.height - 1 + bob, 1, 'fly', fl);
  }
  UI.onPaint = function () {
    const me = $('meCard'), has = hasSp();
    { const room = $('room'), tt = $('title'), dr = $('bBoard');
      if (has) { const F = FT.FAC[FT.SP[UI.ME.sp].fac]; room.hidden = false; $('roomName').textContent = T('{0}の部屋', F.name); tt.dataset.fac = F.id; tt.style.setProperty('--rc', F.color); $('bBoardT').textContent = T('{0}の掲示板', F.name); dr.hidden = !!UI.OFFLINE; }
      else { room.hidden = true; delete tt.dataset.fac; dr.hidden = true; }
      $('bFacMove').textContent = facLeft() > 0 ? T('陣営を移る（あと{0}時間）', Math.ceil(facLeft() / 3600000)) : T('陣営を移る');
      if (UI.boardBadge) UI.boardBadge(true); }
    me.classList.toggle('empty', !has);
    if (has) {
      const sp = FT.SP[UI.ME.sp], F = FT.FAC[sp.fac];
      me.style.setProperty('--c', spCol(UI.ME.sp));
      $('meFac').innerHTML = T('{0}の妖精', `<span style="color:${F.color}">${esc(F.name)}</span>`);
      $('meName').textContent = sp.name; $('meSk').textContent = T('技：{0}', sp.skill);
      me.querySelector('.meGo').textContent = T('かえる ›');
    } else {
      me.style.removeProperty('--c');
      $('meFac').textContent = T('はじめに'); $('meName').textContent = T('妖精をえらぶ'); $('meSk').textContent = T('9つの妖精から1つ。色で陣営が決まる');
      me.querySelector('.meGo').textContent = T('えらぶ ›');
    }
  };
  let pickFirst = false, pickFac = 0;
  const H12 = 12 * 3600 * 1000;
  const facLeft = () => Math.max(0, (UI.ME.facAt || 0) + H12 - Date.now());
  function openPick(first, fi) {
    pickFirst = !!first;
    if (fi === undefined) fi = hasSp() ? FT.SP[UI.ME.sp].fac : 0;
    $('facs').classList.add('one'); for (const f of document.querySelectorAll('#facs .fac')) f.hidden = +f.dataset.fac !== fi;
    pickFac = fi;
    $('pkLead').textContent = first ? T('ようこそ。まず、あなたの妖精をえらぶ。妖精の色で入る陣営が決まり、陣営ごとにべつべつの世界樹を昇る。あとから変えられる。') : T('妖精の色で、入る陣営が決まる。陣営ごとに、べつべつの世界樹を昇る。いつでも変えられる。');
    $('pkClose').hidden = first && !hasSp();
    { const F = FT.FAC[fi]; $('pkLead').textContent = T('{0}の妖精から、1人をえらぶ。', F.name) + ' ' + T('同じ陣営の中なら、いつでも変えられる。'); }
    paintPick();
    // 旗が順に出る演出をやりなおす
    for (const f of document.querySelectorAll('#facs .fac')) { f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; }
    UI.modal('oPick', 1);
  }
  function paintPick() { $('pkDone').disabled = !hasSp() || FT.SP[UI.ME.sp].fac !== pickFac; $('pkDone').textContent = hasSp() && FT.SP[UI.ME.sp].fac === pickFac ? T('{0}で決める', FT.SP[UI.ME.sp].name) : T('妖精をえらんでください'); }
  $('meCard').onclick = () => { if (!hasSp()) openFac(true); else openPick(false); };
  // ---------- 陣営えらび ----------
  const MOTTO = [T('翅と芽吹き。長く飛び、魔物を鈍らせ、はねる屍で跳ぶ'), T('炎と大地。炎に強く、広い屍を作り、足場を生む'), T('水と闇。罠を見抜き、水を泳ぎ、闇を見通す')];
  let facFirst = false;
  function openFac(first) {
    facFirst = !!first;
    const box = $('fcards'); box.innerHTML = '';
    const cur = hasSp() ? FT.SP[UI.ME.sp].fac : -1, left = facLeft();
    $('fcClose').hidden = first && !hasSp();
    FT.FAC.forEach((F, fi) => {
      const b = document.createElement('button'); b.className = 'fcard' + (fi === cur ? ' cur' : '') + (cur >= 0 && fi !== cur && left > 0 ? ' lock' : '');
      b.style.setProperty('--fc', F.color); b.style.setProperty('--d', fi * .1 + 's');
      const top = Math.min(101, (UI.W.tops && UI.W.tops[N_FACS[fi]]) || 1);
      b.innerHTML = `<span class="fx"></span><span><b>${esc(F.name)}</b><small>${esc(MOTTO[fi])}</small></span><span class="top">${top > 100 ? esc(T('頂')) : esc(T('第{0}層', top))}<span class="pct">${top > 100 ? '100%' : '…'}</span><span class="bar"><i style="width:${top > 100 ? 100 : 0}%"></i></span></span>${fi === cur ? `<span class="tag">${esc(T('あなたの陣営'))}</span>` : ''}`;
      const fx = b.querySelector('.fx'); FT.SP.forEach((sp, si) => { if (sp.fac !== fi) return; const c = document.createElement('canvas'); c.width = c.height = 16; c.dataset.sp = si; c.className = 'spc'; fx.appendChild(c); });
      b.onclick = () => {
        if (cur >= 0 && fi !== cur) {
          const l = facLeft(); if (l > 0) { UI.toast(T('陣営を移れるのは、あと{0}時間{1}分後', Math.floor(l / 3600000), Math.ceil((l % 3600000) / 60000))); return; }
          if (!confirm(T('{0}に移りますか？　移ると12時間は戻れません。', F.name))) return;
        }
        SND.se('flip'); UI.modal('oFac', 0); openPick(facFirst || fi !== cur, fi);
      };
      box.appendChild(b);
      // その陣営の最前線の層で、どこまで昇ったか（％）
      if (top <= 100 && !UI.OFFLINE && FT.NET.ready(N_FACS[fi])) FT.NET.rest('ft_stat/' + top + '/m', null, N_FACS[fi]).then(m => {
        const pct = Math.max(0, Math.min(99, Math.floor((+m || 0) / 10)));
        b.querySelector('.pct').textContent = pct + '%'; b.querySelector('.bar i').style.width = pct + '%';
      }).catch(() => { b.querySelector('.pct').textContent = ''; });
      else if (top <= 100) b.querySelector('.pct').textContent = '';
    });
    UI.modal('oFac', 1);
  }
  const N_FACS = FT.NET.FACS;
  UI.openFac = openFac;
  $('fcClose').onclick = () => UI.modal('oFac', 0);
  $('bFacMove').onclick = () => openFac(false);
  $('pkClose').onclick = () => UI.modal('oPick', 0);
  $('pkDone').onclick = () => { UI.modal('oPick', 0); if (pickFirst) UI.toast(T('準備ができた'), T('「昇りはじめる」で世界樹へ'), 2200); };
  // カードを押したら裏返す（main.js の pickSp のあとで）
  $('facs').addEventListener('click', e => { const b = e.target.closest('.sp'); if (!b) return; setTimeout(() => { SND.se('flip'); paintPick(); }, 0); });

  // =============================================
  //  その他・設定
  // =============================================
  $('bMore').onclick = () => UI.modal('oMore', 1);
  $('moClose').onclick = () => UI.modal('oMore', 0);
  $('oMore').addEventListener('click', e => { if (e.target.id === 'oMore') UI.modal('oMore', 0); });
  for (const id of ['bShare', 'bCode', 'bHow']) $(id).addEventListener('click', () => UI.modal('oMore', 0));
  $('bPlaza').onclick = () => UI.openBoard && UI.openBoard('all');
  $('bBoard').onclick = () => UI.openBoard && UI.openBoard('fac');
  $('psBoard').onclick = () => { UI.modal('oPause', 0); S.paused = true; UI.openBoard && UI.openBoard('fac'); };
  $('bSet').onclick = () => { UI.modal('oMore', 0); paintSet(); UI.modal('oSet', 1); };
  $('setClose').onclick = () => UI.modal('oSet', 0);
  S.lowQ = !!store('ft_lowq');
  function paintSet() {
    $('bSnd').classList.toggle('off', !SND.on);
    $('bQ').textContent = S.lowQ ? T('かるい') : T('きれい'); $('bQ').classList.toggle('off', S.lowQ);
  }
  $('bSnd').addEventListener('click', () => setTimeout(paintSet, 0));
  { const sel = $('bLang'); for (const [v, n] of FT.LANGS || []) { const o = document.createElement('option'); o.value = v; o.textContent = n; if (v === FT.LANG) o.selected = true; sel.appendChild(o); } sel.onchange = () => FT.setLang(sel.value); }
  $('bQ').onclick = () => { S.lowQ = !S.lowQ; store('ft_lowq', S.lowQ ? 1 : 0); paintSet(); };

  // =============================================
  //  一時停止
  // =============================================
  UI.pause = function () {
    if (!S.lv || document.querySelector('.over.on')) return;
    S.paused = true; S.keys.l = S.keys.r = S.keys.j = S.keys.k = 0;
    SND.se('pause');
    $('psInfo').textContent = `${T('第{0}層', S.lv.f)}　${S.lv.name}`;
    $('psSndT').textContent = SND.on ? T('音あり') : T('音なし');
    UI.modal('oPause', 1);
  };
  const resume = () => { UI.modal('oPause', 0); S.paused = false; S.enterAt = 0; };
  $('psResume').onclick = resume;
  $('oPause').addEventListener('click', e => { if (e.target.id === 'oPause') resume(); });
  $('psHow').onclick = () => { UI.modal('oPause', 0); UI.openHow(); };
  $('psSnd').onclick = () => { SND.unlock(); SND.setOn(!SND.on); UI.paintSnd(); $('psSndT').textContent = SND.on ? T('音あり') : T('音なし'); };
  $('psTitle').onclick = () => { UI.modal('oPause', 0); S.paused = false; UI.toTitle(); };
  addEventListener('keydown', e => { if (e.code === 'Escape' && $('oPause').classList.contains('on')) { e.preventDefault(); resume(); } });
  // 別のアプリへ移ったら止める
  document.addEventListener('visibilitychange', () => { if (document.hidden && $('game').classList.contains('on') && S.run && !S.run.over && !S.watch) UI.pause(); });

  // =============================================
  //  はじめての案内（第1層で、その場で短く教える）
  //   1 飛ぶを押し続ける → 2 枝に降りると翅が戻る → 3 上の出口へ／翅が尽きると力尽きる → 4 死んだら：屍は足場になる → 5 屍につかまれる
  // =============================================
  const touch = !matchMedia('(hover: hover) and (pointer: fine)').matches;
  let co = null;
  function say(t, s) {
    const el = $('coach'); el.hidden = false;
    el.querySelector('.cT').textContent = t; el.querySelector('.cS').textContent = s || '';
    const inn = el.querySelector('.cIn'); inn.style.animation = 'none'; void inn.offsetWidth; inn.style.animation = '';
    SND.se('ui');
  }
  function coachEnd() { co = null; $('coach').hidden = true; $('bj').classList.remove('coachHi'); }
  UI.coach = function () {
    co = { st: 0, t0: performance.now(), fly: 0, dieSeen: S.dieAt || 0, lv: S.lv };
    setTimeout(() => { if (!co) return; co.st = 1; say(touch ? T('「飛ぶ」を押し続けると、翅で飛べる') : T('スペースを押し続けると、翅で飛べる'), T('上へ昇ろう')); $('bj').classList.add('coachHi'); }, 1600);
  };
  setInterval(() => {
    if (!co) return;
    if (!S.lv || S.lv !== co.lv || !$('game').classList.contains('on')) { coachEnd(); return; }
    const r = S.run, now = performance.now(); if (!r) return;
    const p = r.p;
    if (co.st === 1 && p.fly) { co.fly++; if (co.fly > 4) { co.st = 2; $('bj').classList.remove('coachHi'); say(T('翅は少しの間しかもたない'), T('枝に降りると、翅が元にもどる')); co.at = now; } }
    else if (co.st === 2 && p.on && p.y < S.lv.h - 2 && now - co.at > 1200) { co.st = 3; say(T('いいぞ。いちばん上の出口をめざそう'), T('空中で翅が尽きると、その場で力尽きる')); co.at = now; }
    else if (co.st === 3 && now - co.at > 6000) { $('coach').hidden = true; }
    if (co.st >= 1 && co.st < 4 && S.dieAt && S.dieAt !== co.dieSeen) { co.dieSeen = S.dieAt; co.st = 4; co.at = now; setTimeout(() => { if (co && co.st === 4) say(T('倒れた妖精は、その場に屍として残る'), T('屍は、あとから来る仲間の足場になる')); }, 900); }
    else if (co.st === 4 && now - co.at > 5200) { co.st = 5; co.at = now; say(T('屍には、飛ぶのをやめて近づけばつかまれる'), T('みんなの屍を足場に、上をめざそう')); }
    else if (co.st === 5 && now - co.at > 5500) coachEnd();
  }, 100);

  // =============================================
  //  死にざまを動画にする（死んだあと少しのあいだ、ボタンを出す）
  // =============================================
  let clipT = 0, clipBlob = null, clipUrl = '';
  UI.clipOffer = function () {
    if (!UI.canClip || !UI.canClip() || co) return;
    const b = $('clipBtn'); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(clipT); clipT = setTimeout(() => { b.hidden = true; }, 4500);
  };
  $('clipBtn').onclick = async () => {
    $('clipBtn').hidden = true; clearTimeout(clipT);
    $('clipNow').hidden = false;
    let blob = null; try { blob = await UI.deathClip(); } catch (e) { blob = null; }
    $('clipNow').hidden = true;
    if (!blob || !blob.size) { UI.toast(T('動画を作れませんでした')); return; }
    clipBlob = blob; if (clipUrl) URL.revokeObjectURL(clipUrl); clipUrl = URL.createObjectURL(blob);
    $('clipVid').src = clipUrl;
    const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
    const file = new File([blob], 'fairies-tower.' + ext, { type: blob.type });
    $('clipShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $('clipShare').onclick = () => { navigator.share({ files: [file], text: T('この死にざまを見てくれ') + ' #FairiesTower ' + (FT_GAME() || '') }).catch(() => { }); };
    $('clipSave').onclick = () => { const a = document.createElement('a'); a.href = clipUrl; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); };
    $('clipX').onclick = () => { open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(T('この死にざまを見てくれ') + '\n' + (FT_GAME() || '') + '\n#FairiesTower'), '_blank', 'noopener'); };
    S.paused = true; UI.modal('oClip', 1);
  };
  const FT_GAME = () => G.FT_GAME_URL || location.href.split(/[?#]/)[0];
  $('clipClose').onclick = () => { UI.modal('oClip', 0); S.paused = false; $('clipVid').pause(); };

  // =============================================
  //  層の帯（入ったとき）
  // =============================================
  let bnT = 0;
  UI.banner = function (f, name, sub) {
    const el = $('fBanner');
    el.querySelector('.fbK').textContent = f === 100 ? T('頂') : T('第 {0} 層', f);
    el.querySelector('.fbN').textContent = name || '';
    el.querySelector('.fbS').textContent = sub || '';
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    SND.se('banner');
    clearTimeout(bnT); bnT = setTimeout(() => el.classList.remove('on'), 3300);
  };

  // =============================================
  //  ゲーム画面の上にかぶせる演出（入る・死ぬ・越える）
  // =============================================
  UI.overlay = function (g, W, H, dpr, S, S_, cam) {
    const now = performance.now();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // 入ったとき：暗いところから
    if (S.enterAt) { const k = (now - S.enterAt) / 700; if (k < 1) { g.fillStyle = `rgba(0,0,0,${(1 - k) * (1 - k)})`; g.fillRect(0, 0, W, H); } }
    // 死んだとき：色が抜けて、まわりが暗くなる
    if (S.dieAt) {
      const k = (now - S.dieAt) / 1000;
      if (k < 1) {
        const a = k < .12 ? k / .12 : 1 - (k - .12) / .88;
        g.globalCompositeOperation = 'saturation'; g.fillStyle = `rgba(128,128,128,${.85 * a})`; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .7);
        vg.addColorStop(0, 'rgba(20,0,10,0)'); vg.addColorStop(1, `rgba(40,0,16,${.6 * a})`);
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
        // 「力尽きた」の帯
        const by = H * .5, bh = 54 * dpr;
        const band = g.createLinearGradient(0, 0, W, 0); band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(.2, `rgba(0,0,0,${.55 * a})`); band.addColorStop(.8, `rgba(0,0,0,${.55 * a})`); band.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = band; g.fillRect(0, by - bh / 2, W, bh);
        g.font = `700 ${26 * dpr}px "Kaisei Decol", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = `rgba(214,92,104,${a})`; g.shadowColor = 'rgba(255,60,80,.6)'; g.shadowBlur = 16 * dpr;
        const sp = 1 + k * .25; g.save(); g.translate(W / 2, by); g.scale(sp, sp); g.fillText(T('力尽きた'), 0, 0); g.restore();
        g.shadowBlur = 0; g.textBaseline = 'alphabetic';
      }
    }
    // 越えたとき：光があふれる
    if (S.clearAt) {
      const k = (now - S.clearAt) / 1100;
      if (k >= 0 && k < 1.4) {
        const px = S.clearPos ? S.clearPos[0] * S_ : W / 2, py = S.clearPos ? (S.clearPos[1] - cam) * S_ : H * .3;
        g.globalCompositeOperation = 'lighter';
        const a = Math.max(0, 1 - k);
        const r = Math.max(W, H) * (.2 + k * .9);
        const gl = g.createRadialGradient(px, py, 0, px, py, r); gl.addColorStop(0, `rgba(255,240,190,${.9 * a})`); gl.addColorStop(.4, `rgba(255,220,140,${.35 * a})`); gl.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = gl; g.fillRect(0, 0, W, H);
        // 光の筋
        g.save(); g.translate(px, py); g.rotate(k * .6);
        for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = `rgba(255,236,170,${.22 * a})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H), -14 * dpr); g.lineTo(Math.max(W, H), 14 * dpr); g.fill(); }
        g.restore();
        for (let i = 0; i < 3; i++) { const kk = k * 1.3 - i * .15; if (kk <= 0 || kk > 1) continue; g.strokeStyle = `rgba(255,236,170,${(1 - kk) * .8})`; g.lineWidth = 3 * dpr * (1 - kk); g.beginPath(); g.arc(px, py, kk * Math.max(W, H) * .6, 0, 7); g.stroke(); }
        g.globalCompositeOperation = 'source-over';
        if (k > .55) { g.fillStyle = `rgba(4,10,13,${Math.min(.5, (k - .55) * 1.2)})`; g.fillRect(0, 0, W, H); }
      }
    }
    // 動画を撮っている間：上に層の名前、下にゲームの名前
    if (S.clip) {
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const band = (y, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, y === 0 ? 'rgba(0,0,0,.7)' : 'rgba(0,0,0,0)'); gr.addColorStop(1, y === 0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.75)'); g.fillStyle = gr; g.fillRect(0, y, W, h); };
      band(0, 72 * dpr); band(H - 64 * dpr, 64 * dpr);
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#ffe9a8';
      g.font = `700 ${13 * dpr}px "Zen Kaku Gothic New", sans-serif`; g.fillText(T('第{0}層', S.clip.f) + '　' + (S.lv ? S.lv.name : ''), W / 2, 30 * dpr);
      g.fillStyle = '#e9f3ef'; g.font = `700 ${15 * dpr}px "Zen Kaku Gothic New", sans-serif`; g.fillText(S.clip.died ? S.clip.sub : S.clip.name, W / 2, 54 * dpr);
      g.font = `700 ${20 * dpr}px "Kaisei Decol", serif`; g.fillStyle = 'rgba(255,251,230,.92)'; g.shadowColor = 'rgba(255,233,168,.6)'; g.shadowBlur = 10 * dpr; g.fillText("Fairies' Tower", W / 2, H - 28 * dpr); g.shadowBlur = 0;
      g.font = `700 ${10 * dpr}px "Zen Kaku Gothic New", sans-serif`; g.fillStyle = 'rgba(185,205,198,.9)'; g.fillText(T('世界樹を、屍で昇れ') + '  #FairiesTower', W / 2, H - 12 * dpr);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  };

  // =============================================
  //  はじまり（タップで音を出せるようにする）
  // =============================================
  const splash = $('splash');
  const q = new URLSearchParams(location.search);
  let splashOn = !q.get('watch') && !q.get('nosplash');
  if (!splashOn) splash.remove();
  else {
    if (store('ft_seen')) splash.classList.add('skip');
    const go = () => {
      if (!splashOn) return; splashOn = false;
      SND.unlock(); SND.se('start'); store('ft_seen', 1);
      splash.classList.add('out'); setTimeout(() => splash.remove(), 800);
      if (!hasSp()) setTimeout(() => openFac(true), 500);
    };
    splash.addEventListener('pointerup', go);
    addEventListener('keydown', e => { if (splashOn && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); go(); } });
  }

  // =============================================
  //  毎こま
  // =============================================
  let lastT = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const titleOn = $('title').classList.contains('on');
    if (!titleOn || now - lastT < 33) return;
    lastT = now;
    drawTitleBG(now);
    const t = now / 1000;
    if (hasSp()) drawSp($('meSp'), UI.ME.sp, t, true); else { const c = $('meSp').getContext('2d'); c.clearRect(0, 0, 16, 16); ART.fairy(c, Math.floor(t / 1.2) % 9, 8, 15, 1, 'fly', (Math.sin(t * 9) + 1) / 2, .5); }
    if ($('oFac').classList.contains('on')) for (const cv of document.querySelectorAll('#fcards .spc')) drawSp(cv, +cv.dataset.sp, t + +cv.dataset.sp * .3);
    if ($('oPick').classList.contains('on')) for (const cv of document.querySelectorAll('#facs .spc')) drawSp(cv, +cv.dataset.sp, t + +cv.dataset.sp * .3);
  }
  addEventListener('resize', () => { tW = 0; });
  UI.onPaint();
  requestAnimationFrame(tick);
})(window);
