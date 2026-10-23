// =============================================
//  Fairies' Tower  見た目（ドット絵と光）
//   ・世界はいったん小さな絵（1マス16ピクセル）に描いてから、画面の大きさにのばす（ドット絵らしく）
//   ・光は、のばしたあとに滑らかに重ねる（妖精・屍・きのこ・炎が光る）
//   ・世界樹の中の景色は、高さで変わる（根 → 幹 → 枝 → 梢 → 頂）
//   ・見た目だけ。動きの計算（engine.js）には関わらない
//   素材：Legacy Fantasy（Anokolisa・CC0）、タイトルの森は Free Pixel Art Forest（edermunizz）
// =============================================
(function (G) {
  const FT = G.FT, ART = FT.ART = {};
  const PX = ART.PX = 16;
  // ---------- 素材（1枚の絵にまとめたもの） ----------
  const AT = { bush5: [0, 0, 124, 75], bush1: [125, 0, 124, 43], bush2: [0, 76, 124, 43], bush3: [125, 76, 124, 43], bush4: [0, 120, 124, 43], lotus: [125, 120, 28, 42], bee0: [154, 120, 38, 41], bee1: [193, 120, 38, 41], bee2: [0, 164, 38, 41], bee3: [39, 164, 38, 41], hive: [78, 164, 32, 39], lily: [111, 164, 28, 37], mushBig: [140, 164, 30, 30], leaf: [171, 164, 32, 25], grass: [0, 206, 78, 22], mushB: [79, 206, 14, 21], tmC: [94, 206, 11, 20], stone: [106, 206, 45, 17], log: [152, 206, 75, 16], mushA: [228, 206, 11, 14], tmA: [240, 206, 11, 14], fungiL: [0, 229, 18, 10], fungiR: [19, 229, 18, 10], tmB: [38, 229, 8, 10] };
  const atlas = new Image();
  ART.ready = new Promise(r => { atlas.onload = r; atlas.onerror = r; });
  atlas.src = 'img/atlas.png?v=' + (G.FT_ART_VER || '1');
  const ok = () => atlas.complete && atlas.naturalWidth > 0;
  // 素材を1つ描く（x, y は小さな絵の上のピクセル。左上）
  function spr(c, n, x, y, flip, w, h) {
    const a = AT[n]; if (!a || !ok()) return;
    const W = w || a[2], H = h || a[3];
    if (flip) { c.save(); c.translate(Math.round(x) + W, Math.round(y)); c.scale(-1, 1); c.drawImage(atlas, a[0], a[1], a[2], a[3], 0, 0, W, H); c.restore(); }
    else c.drawImage(atlas, a[0], a[1], a[2], a[3], Math.round(x), Math.round(y), W, H);
  }
  ART.spr = spr; ART.AT = AT;
  // ---------- 小さな道具 ----------
  const hash = n => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
  ART.hash = hash; ART.h2 = h2;
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const css = (c, a) => a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lit = (c, k) => k >= 0 ? mix(c, [255, 255, 255], k) : mix(c, [0, 0, 0], -k);
  ART.hex = hex; ART.css = css; ART.mix = mix; ART.lit = lit;
  // ---------- 高さで変わる景色 ----------
  //  a：根もとからの高さ（層の数。0〜100）
  const Z = [
    { a: 0, bg0: '#0b2026', bg1: '#06110f', rib: '#123038', wall: '#2a2219', wall2: '#3b2f22', moss: '#2e5c46', acc: '#6fd8ff', amb: '#38505a', shaft: '#7fd8ff', sa: .10, vine: '#1d4234', sky: 0 },
    { a: 18, bg0: '#0e2a22', bg1: '#071510', rib: '#173a2c', wall: '#2c2418', wall2: '#433322', moss: '#3d7a3e', acc: '#a6f07a', amb: '#425a48', shaft: '#bff59a', sa: .12, vine: '#285a30', sky: 0 },
    { a: 40, bg0: '#2a2412', bg1: '#120f07', rib: '#3a3018', wall: '#33271a', wall2: '#55402a', moss: '#6b7a2c', acc: '#ffc35a', amb: '#5a5038', shaft: '#ffd98a', sa: .16, vine: '#4f5a20', sky: 0 },
    { a: 62, bg0: '#3a2c14', bg1: '#1a1208', rib: '#4d3a1a', wall: '#3a2a1a', wall2: '#5e4528', moss: '#8a8a30', acc: '#ffe7a3', amb: '#6e6048', shaft: '#ffe9b0', sa: .22, vine: '#6a6a24', sky: .15 },
    { a: 82, bg0: '#1b2440', bg1: '#0b0f1e', rib: '#26305a', wall: '#2a2430', wall2: '#423650', moss: '#4a6a7a', acc: '#b9c8ff', amb: '#4a5276', shaft: '#c8d4ff', sa: .16, vine: '#2e4a5a', sky: .7 },
    { a: 100, bg0: '#101836', bg1: '#05060f', rib: '#1a2350', wall: '#241f30', wall2: '#3a3050', moss: '#3a5a7a', acc: '#e0e8ff', amb: '#3e4672', shaft: '#e8eeff', sa: .14, vine: '#2a3a5a', sky: 1 },
  ];
  for (const z of Z) for (const k in z) if (typeof z[k] === 'string') z[k] = hex(z[k]);
  function zone(a) {
    a = Math.max(0, Math.min(100, a));
    let i = 0; while (i < Z.length - 2 && a > Z[i + 1].a) i++;
    const A = Z[i], B = Z[i + 1], t = Math.max(0, Math.min(1, (a - A.a) / (B.a - A.a))), s = t * t * (3 - 2 * t), o = {};
    for (const k in A) o[k] = Array.isArray(A[k]) ? mix(A[k], B[k], s) : A[k] + (B[k] - A[k]) * s;
    o.a = a; return o;
  }
  ART.zone = zone;
  // ---------- 光（ぼかした丸。色ごとに作っておく） ----------
  const glowC = new Map();
  function glow(col) {
    const key = Array.isArray(col) ? col.map(v => v | 0).join(',') : col;
    let c = glowC.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const rgb = Array.isArray(col) ? col : hex(col);
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, css(rgb, 1)); gr.addColorStop(.25, css(rgb, .55)); gr.addColorStop(.6, css(rgb, .16)); gr.addColorStop(1, css(rgb, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glowC.set(key, c); return c;
  }
  ART.glow = glow;
  // ---------- ドットで丸・楕円を塗る（小さな絵の上） ----------
  function dotEllipse(c, cx, cy, rx, ry, rot, fill, edge) {
    const cs = Math.cos(rot), sn = Math.sin(rot), R = Math.ceil(Math.max(rx, ry)) + 1;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const u = (x * cs + y * sn) / rx, v = (-x * sn + y * cs) / ry, d = u * u + v * v;
      if (d <= 1) { c.fillStyle = edge && d > .55 ? edge : fill; c.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1); }
    }
  }
  ART.dotEllipse = dotEllipse;
  // =============================================
  //  妖精（16×16のドット絵。色は種族ごと）
  // =============================================
  //  h 髪 H 髪の影 s 肌 S 肌の影 e 目 c 閉じた目 d 服 D 服の影 t 服のふち w 翅のつけね
  const BODY = {
    stand: [
      '................',
      '................',
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhssss....',
      '....hhhsesse....',
      '....Hhhsssss....',
      '.....HhSssS.....',
      '......tddt......',
      '.....sdddds.....',
      '......dddd......',
      '.....dddddd.....',
      '.....DdDDdD.....',
      '.......s.s......',
      '.......s.s......',
    ],
    fly: [
      '................',
      '................',
      '......hhhh......',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhssss....',
      '....hhhsesse....',
      '....Hhhsssss....',
      '.....HhSssS.....',
      '......tddt..s...',
      '.....ddddddd....',
      '.....ddddd......',
      '.....dddddd.....',
      '......DdDdD.....',
      '.......ss.......',
      '................',
    ],
    fall: [
      '................',
      '..........s.....',
      '......hhhhs.....',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '....hhhhssss....',
      '....hhhsesse....',
      '....Hhhsssss....',
      '.....HhSssS.....',
      '......tddt......',
      '......dddd......',
      '.....dddddd.....',
      '.....dddddd.....',
      '.....DdDDdD.....',
      '......s...s.....',
      '.....s.....s....',
    ],
    sleep: null,
  };
  BODY.sleep = BODY.stand.map(r => r.replace(/e/g, 'c'));
  const SKIN = hex('#f6dcc4'), SKIN2 = hex('#d9a98e'), EYE = hex('#2a1d2e');
  function spPal(spc) {
    let base = hex(spc.color);
    const dark = spc.color === '#3a3f4a';
    return {
      h: css(dark ? hex('#2f3442') : lit(base, .28)), H: css(dark ? hex('#171a22') : lit(base, -.35)),
      s: css(SKIN), S: css(SKIN2), e: css(EYE), c: css(lit(SKIN2, -.35)),
      d: css(dark ? hex('#454b5a') : base), D: css(dark ? hex('#23262e') : lit(base, -.38)), t: css(dark ? hex('#d8dce6') : lit(base, .55)),
      wing: dark ? [210, 214, 230] : lit(base, .55), glow: dark ? [170, 180, 220] : lit(base, .2),
    };
  }
  // 種族ごとの飾り（頭の上）：[x, y, 色]
  const ACC = [
    [[7, 1, '#3f8a46'], [6, 0, '#9ff0a6'], [8, 0, '#6fcf78'], [9, 0, '#9ff0a6']],                       // 緑：芽
    [[9, 1, '#fff6c0'], [10, 1, '#ffb52e'], [11, 1, '#fff6c0'], [10, 0, '#fff6c0'], [10, 2, '#fff6c0']], // 黄：花
    [[3, 3, '#ff6fb0'], [4, 2, '#ffd0e8'], [3, 2, '#ff9ccf'], [4, 4, '#ff6fb0']],                      // 桃：花びらのリボン
    [[7, 1, '#ff9a3a'], [8, 1, '#ffd24a'], [8, 0, '#ff6b2a'], [9, 1, '#ff6b2a']],                      // 赤：炎の房
    [[6, 1, '#6b4422'], [7, 1, '#8a5a2e'], [8, 1, '#8a5a2e'], [9, 1, '#6b4422'], [7, 0, '#4a2e16'], [5, 2, '#6b4422'], [10, 2, '#6b4422']], // 茶：どんぐり帽
    [[10, 1, '#ffffff'], [11, 1, '#e4e8ee'], [11, 0, '#ffffff'], [12, 0, '#c8ccd4']],                    // 灰：羽根
    [[5, 1, '#c8ccd8'], [5, 2, '#8a90a0'], [10, 1, '#c8ccd8'], [10, 2, '#8a90a0'], [4, 0, '#ffffff'], [11, 0, '#ffffff']], // 黒：角
    [[9, 1, '#2f6fb8'], [9, 0, '#8fd0ff'], [10, 0, '#cfeaff']],                                         // 青：しずく
    [[8, 1, '#7a5ac8'], [8, 0, '#fff0a0'], [7, 0, '#d8c0ff'], [9, 0, '#d8c0ff']],                      // 紫：星
  ];
  const bodyC = new Map();
  function bodyCanvas(sp, pose) {
    const key = sp + pose; let c = bodyC.get(key); if (c) return c;
    const P = spPal(FT.SP[sp] || FT.SP[0]);
    c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
    BODY[pose].forEach((row, y) => { for (let i = 0; i < 16; i++) { const k = row[i]; if (k !== '.' && P[k]) { x.fillStyle = P[k]; x.fillRect(i, y, 1, 1); } } });
    (ACC[sp] || []).forEach(([i, y, col]) => { x.fillStyle = col; x.fillRect(i, y, 1, 1); });
    bodyC.set(key, c); return c;
  }
  // 翅：つけね（体の左うしろ）から2枚。fl：はばたき（0〜1）
  const wingC = new Map();
  function wingCanvas(sp, fl) {
    const q = Math.round(fl * 6), key = sp + ':' + q; let c = wingC.get(key); if (c) return c;
    const P = spPal(FT.SP[sp] || FT.SP[0]), w = P.wing, f = q / 6;
    c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
    dotEllipse(x, 4.2, 6.6 - f * 1.5, 3.6, 1.9 + f * .5, -0.95 - f * .55, css(w, .55), css(lit(w, .4), .85));
    dotEllipse(x, 4.6, 10.2 + f * .4, 2.8, 1.4, 0.55 + f * .35, css(w, .45), css(lit(w, .4), .75));
    wingC.set(key, c); return c;
  }
  // 妖精を描く。x：体のまん中、y：足もと（小さな絵の上のピクセル）、face：1右 -1左
  function fairy(c, sp, x, y, face, pose, fl, alpha) {
    const X = Math.round(x - 8), Y = Math.round(y - 16);
    c.save(); if (alpha !== undefined) c.globalAlpha = alpha;
    if (face < 0) { c.translate(X + 16, Y); c.scale(-1, 1); } else c.translate(X, Y);
    c.drawImage(wingCanvas(sp, fl), 0, 0);
    c.drawImage(bodyCanvas(sp, pose), 0, 0);
    c.restore();
  }
  ART.fairy = fairy; ART.spPal = spPal;
  // 眠る妖精（屍）：横に寝かせる。x：まん中、y：寝ている面
  function sleeper(c, sp, x, y, face, alpha) {
    const X = Math.round(x), Y = Math.round(y);
    c.save(); if (alpha !== undefined) c.globalAlpha = alpha;
    c.translate(X, Y); c.rotate(-Math.PI / 2); if (face < 0) c.scale(1, -1);
    c.drawImage(wingCanvas(sp, 0), -15, -8);
    c.drawImage(bodyCanvas(sp, 'sleep'), -15, -8);
    c.restore();
  }
  ART.sleeper = sleeper;
  // 屍の足場（光る葉）：幅wpx。色は陣営の色
  const padC = new Map();
  function padCanvas(wpx, col, kind) {
    const key = wpx + ':' + col + ':' + kind; let c = padC.get(key); if (c) return c;
    const rgb = hex(col);
    c = document.createElement('canvas'); c.width = wpx + 4; c.height = 9; const x = c.getContext('2d');
    const base = kind === 4 ? [220, 190, 150] : mix([214, 240, 255], rgb, .25);
    dotEllipse(x, (wpx + 4) / 2 - .5, 4, wpx / 2, 2.6, 0, css(base, .9), css(lit(base, -.25), .95));
    x.fillStyle = css(lit(base, .5), .9); for (let i = 3; i < wpx; i += 3) x.fillRect(i + 1, 2, 2, 1);
    if (kind === 2) { x.fillStyle = 'rgba(255,156,207,.95)'; x.fillRect(2, 7, wpx, 1); }
    padC.set(key, c); return c;
  }
  ART.padCanvas = padCanvas;
  // =============================================
  //  蛾・蜂
  // =============================================
  function moth(c, x, y, s, frozen, off) {
    const fl = frozen ? .2 : Math.abs(Math.sin(s * 14 + off * 9));
    const wc = frozen ? [159, 212, 255] : [155, 111, 214], bc = frozen ? [61, 106, 138] : [59, 36, 87];
    dotEllipse(c, x - 4, y - 1, 4.5, 1.5 + fl * 2.5, -.4, css(wc, .95), css(lit(wc, -.3)));
    dotEllipse(c, x + 4, y - 1, 4.5, 1.5 + fl * 2.5, .4, css(wc, .95), css(lit(wc, -.3)));
    c.fillStyle = css(lit(wc, .5)); c.fillRect(Math.round(x - 6), Math.round(y - 2), 1, 1); c.fillRect(Math.round(x + 5), Math.round(y - 2), 1, 1);
    c.fillStyle = css(bc); c.fillRect(Math.round(x - 1), Math.round(y - 4), 2, 8);
    c.fillStyle = css(lit(bc, -.4)); c.fillRect(Math.round(x - 2), Math.round(y - 6), 1, 2); c.fillRect(Math.round(x + 1), Math.round(y - 6), 1, 2);
  }
  function bee(c, x, y, s, frozen, off, face) {
    if (!ok()) return;
    const fr = frozen ? 0 : Math.floor((s * 18 + off * 7) % 4);
    c.save(); if (frozen) c.globalAlpha = .75;
    spr(c, 'bee' + fr, x - 19, y - 24, face < 0);
    if (frozen) { c.globalAlpha = .35; c.fillStyle = '#9fd4ff'; c.fillRect(Math.round(x - 7), Math.round(y - 8), 14, 14); }
    c.restore();
  }
  ART.moth = moth; ART.bee = bee;
  // =============================================
  //  背景（世界樹の中）
  // =============================================
  //  c：小さな絵、cam：画面の上の高さ（マス）、vh：画面の高さ（マス）、a：景色の高さ、t：時間
  function background(c, z, cam, vh, a, t, H) {
    const W = 20 * PX;
    // いちばん奥：明るさのむら
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, css(z.bg0)); gr.addColorStop(1, css(z.bg1)); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // 梢から上：星空（空洞のすき間から見える）
    if (z.sky > .02) {
      const k = .15, oy = cam * PX * k;
      for (let i = 0; i < 70; i++) {
        const sx = Math.floor(hash(i * 7 + 1) * W), sy = Math.floor(((hash(i * 13 + 5) * 900 - oy) % 900 + 900) % 900);
        if (sy >= H) continue;
        const tw = .5 + .5 * Math.sin(t * (1 + hash(i) * 2) + i);
        c.fillStyle = css([220, 230, 255], z.sky * (.25 + .6 * tw * hash(i * 3)));
        c.fillRect(sx, sy, 1, 1);
      }
    }
    // 奥の幹のすじ（ゆっくり動く）
    {
      const k = .3, oy = cam * PX * k;
      for (let i = 0; i < 14; i++) {
        const bx = hash(i * 31 + 7) * W, bw = 5 + Math.floor(hash(i * 17) * 12), sh = lit(z.rib, (hash(i * 5) - .5) * .4);
        c.fillStyle = css(sh, .55 + hash(i * 3) * .3);
        for (let y = 0; y < H; y += 4) { const wy = y + oy, sway = Math.round(Math.sin(wy * .012 + i * 1.7) * 6 + Math.sin(wy * .031 + i) * 2); c.fillRect(Math.round(bx + sway), y, bw, 4); }
      }
    }
    // 空洞の窓（枝より上：外の空が見える穴）
    if (a > 55) {
      const k = .45, oy = cam * PX * k, step = 260;
      const j0 = Math.floor((oy - 40) / step), j1 = Math.floor((oy + H + 40) / step);
      for (let j = j0; j <= j1; j++) {
        if (hash(j * 97) < .45) continue;
        const cx = 40 + hash(j * 11) * (W - 80), cy = j * step + hash(j * 3) * 120 - oy, rx = 14 + hash(j * 5) * 16, ry = rx * 1.4;
        dotEllipse(c, cx, cy, rx + 2, ry + 2, 0, css(lit(z.rib, -.3)));
        dotEllipse(c, cx, cy, rx, ry, 0, css(mix(z.bg0, [30, 44, 90], .5 + z.sky * .5)));
        for (let s2 = 0; s2 < 8; s2++) { const px = cx + (hash(j * 50 + s2) - .5) * rx * 1.4, py = cy + (hash(j * 70 + s2) - .5) * ry * 1.4; c.fillStyle = css([230, 236, 255], .4 + .4 * Math.sin(t * 2 + s2)); c.fillRect(Math.round(px), Math.round(py), 1, 1); }
      }
    }
    // つた・根（まん中くらいの近さ）
    {
      const k = .6, oy = cam * PX * k, step = 70;
      const j0 = Math.floor(oy / step) - 2, j1 = Math.floor((oy + H) / step) + 1;
      for (let j = j0; j <= j1; j++) {
        const n = 1 + Math.floor(hash(j * 13 + 1) * 3);
        for (let q = 0; q < n; q++) {
          const vx = 20 + hash(j * 41 + q * 7) * (W - 40), top = j * step - oy, len = 30 + hash(j * 19 + q) * 90;
          c.fillStyle = css(z.vine, .9);
          for (let y = 0; y < len; y += 2) { const sw = Math.sin((y + j * 30) * .07 + t * .6 + q) * (y / len) * 3; c.fillRect(Math.round(vx + sw), Math.round(top + y), 1, 2); if (y % 10 === 0) { c.fillStyle = css(lit(z.vine, .25), .9); c.fillRect(Math.round(vx + sw + (y % 20 ? 1 : -1)), Math.round(top + y), 1, 1); c.fillStyle = css(z.vine, .9); } }
        }
      }
    }
  }
  ART.background = background;
  // 幹の壁（左右の1マス）。lights に光るきのこを足す
  function walls(c, z, cam, H, t, lights) {
    const W = 20 * PX, oy = Math.round(cam * PX);
    for (const side of [0, 1]) {
      const x0 = side ? W - PX : 0;
      c.fillStyle = css(z.wall); c.fillRect(x0, 0, PX, H);
      for (let y = -(oy % 4); y < H; y += 4) {
        const row = Math.floor((y + oy) / 4);
        for (let i = 0; i < 4; i++) { const v = h2(row, i * 5 + side * 31); if (v < .35) { c.fillStyle = css(lit(z.wall2, (v - .17) * 1.2)); c.fillRect(x0 + i * 4 + (row % 2), y, 2 + (v < .12 ? 1 : 0), 4); } }
      }
      // 内側のふち（光が当たる）
      c.fillStyle = css(lit(z.wall2, .15)); c.fillRect(side ? x0 : x0 + PX - 1, 0, 1, H);
      c.fillStyle = css(lit(z.wall, -.4)); c.fillRect(side ? x0 + 1 : x0 + PX - 2, 0, 1, H);
      // 苔・きのこ・棚きのこ
      const step = 48, j0 = Math.floor(oy / step) - 1, j1 = Math.floor((oy + H) / step) + 1;
      for (let j = j0; j <= j1; j++) {
        const v = h2(j, side + 11), y = j * step - oy + Math.floor(hash(j * 7 + side) * 30);
        if (v < .3) { c.fillStyle = css(z.moss); for (let i = 0; i < 10; i++) c.fillRect(side ? x0 + Math.floor(hash(j + i) * 4) : x0 + PX - 4 + Math.floor(hash(j + i) * 4), y + i, 3, 1); }
        else if (v < .48) spr(c, side ? 'fungiR' : 'fungiL', side ? x0 - 15 : x0 + PX - 3, y);
        else if (v < .6) { spr(c, ['tmA', 'tmB', 'tmC'][Math.floor(hash(j * 3) * 3)], side ? x0 - 9 : x0 + PX - 1, y, !!side); }
        else if (v < .78) {
          // 光るきのこ（景色の色）
          const gx = side ? x0 - 2 : x0 + PX + 1, gy = y + 4;
          c.fillStyle = css(lit(z.acc, -.2)); c.fillRect(gx - 1, gy, 3, 1); c.fillStyle = css(lit(z.acc, .4)); c.fillRect(gx, gy - 1, 1, 1); c.fillStyle = css(lit(z.wall2, .2)); c.fillRect(gx, gy + 1, 1, 2);
          if (lights) lights.push([gx / PX, (gy + oy) / PX, 1.4, z.acc, .55 + .25 * Math.sin(t * 2 + j)]);
        }
      }
    }
  }
  ART.walls = walls;
  // =============================================
  //  枝（足場）
  // =============================================
  function branch(c, b, i, cam, z, t, burn, lights) {
    const oy = Math.round(cam * PX), x0 = Math.round(b[1] * PX), x1 = Math.round(b[2] * PX), y = Math.round(b[0] * PX) - oy, w = x1 - x0;
    if (w <= 0) return;
    // 木の部分：丸太の素材を、はし・まん中・はしで並べる
    if (ok()) {
      const L = AT.log;
      c.save(); c.beginPath(); c.rect(x0, y - 4, w, 20); c.clip();
      c.drawImage(atlas, L[0], L[1], 10, 16, x0 - 2, y - 3, 10, 16);
      for (let x = x0 + 8; x < x1 - 8; x += 50) c.drawImage(atlas, L[0] + 12, L[1], Math.min(50, x1 - 8 - x), 16, x, y - 3, Math.min(50, x1 - 8 - x), 16);
      c.drawImage(atlas, L[0] + L[2] - 10, L[1], 10, 16, x1 - 8, y - 3, 10, 16);
      c.restore();
    } else { c.fillStyle = css(z.wall2); c.fillRect(x0, y, w, 7); }
    // 燃える枝
    if (burn) {
      if (burn.on || burn.warn) {
        for (let x = x0 + 2; x < x1 - 1; x += 4) {
          const hgt = burn.on ? 4 + Math.floor(3 * Math.abs(Math.sin(x * .7 + t * 14))) : 2;
          c.fillStyle = burn.on ? '#ff5a1a' : 'rgba(255,154,92,.7)'; c.fillRect(x, y - hgt, 3, hgt);
          c.fillStyle = burn.on ? '#ffd24a' : 'rgba(255,210,74,.6)'; c.fillRect(x + 1, y - hgt + 1, 1, hgt - 1);
        }
        if (lights) lights.push([(x0 + w / 2) / PX, b[0] - .3, Math.max(2, w / PX * .7), [255, 130, 60], burn.on ? 1 : .35]);
      } else { c.fillStyle = 'rgba(255,120,60,.55)'; c.fillRect(x0 + 2, y + 5, w - 4, 1); }
      return;
    }
    // 苔（上）と、下にたれる苔
    c.fillStyle = css(z.moss);
    for (let x = x0 + 1; x < x1 - 1; x++) { const v = h2(i * 131 + x, 3); if (v < .75) c.fillRect(x, y - 1 - (v < .2 ? 1 : 0), 1, 1 + (v < .2 ? 1 : 0)); }
    c.fillStyle = css(lit(z.moss, -.3));
    for (let x = x0 + 3; x < x1 - 3; x += 3) { const v = h2(i * 17 + x, 9); if (v < .35) c.fillRect(x, y + 9, 1, 1 + Math.floor(v * 12)); }
    // 小物（きのこ・葉・花）
    const n = Math.floor(w / 40);
    for (let q = 0; q < n; q++) {
      const v = h2(i, q + 50); if (v > .55) continue;
      const px = x0 + 6 + Math.floor(hash(i * 7 + q) * Math.max(1, w - 24));
      if (v < .18) { spr(c, 'mushA', px, y - 13); }
      else if (v < .32) spr(c, 'tmB', px, y - 9);
      else if (v < .45) { spr(c, 'leaf', px - 8, y - 20, hash(i + q) < .5); }
      else { c.fillStyle = css(lit(z.acc, -.1)); c.fillRect(px, y - 3, 1, 2); c.fillStyle = css(lit(z.acc, .5)); c.fillRect(px, y - 4, 1, 1); if (lights) lights.push([px / PX, (y - 4 + oy) / PX, .9, z.acc, .5]); }
    }
  }
  ART.branch = branch;
  // 下の床（前の層の梢・穴）と、上の出口
  function floorFoliage(c, y, cam, z, t, lights, first) {
    const oy = Math.round(cam * PX), Y = Math.round(y * PX) - oy, W = 20 * PX;
    if (first) {
      // 根もと：土と草
      c.fillStyle = css(lit(z.wall, -.2)); c.fillRect(0, Y + 4, W, 200);
      for (let x = 0; x < W; x += 78) spr(c, 'grass', x, Y - 4);
      return;
    }
    const hx = 10 * PX, hw = 26;
    c.fillStyle = css(lit(z.moss, -.55)); c.fillRect(0, Y + 6, hx - hw, 24); c.fillRect(hx + hw, Y + 6, W - hx - hw, 24);
    const names = ['bush2', 'bush3', 'bush4', 'bush1'];
    for (let k = 0; k < 6; k++) { const bx = -40 + k * 62; if (bx + 124 < hx - hw + 30 && bx + 124 > 0) spr(c, names[k % 4], bx, Y - 10); }
    for (let k = 0; k < 6; k++) { const bx = hx + hw - 30 + k * 62; if (bx < W) spr(c, names[(k + 2) % 4], bx, Y - 10, true); }
    if (lights) lights.push([10, y + .4, 3.2, [255, 236, 180], .7]);
  }
  function exitTop(c, cam, z, t, lights, door) {
    const oy = Math.round(cam * PX), W = 20 * PX;
    if (oy > 60) return;
    const Y = -oy;
    if (!door) {
      for (let k = 0; k < 6; k++) { const bx = -50 + k * 70; if (Math.abs(bx + 62 - 160) < 50) continue; c.save(); c.translate(0, Y + 30); c.scale(1, -1); spr(c, ['bush3', 'bush2', 'bush4'][k % 3], bx, 0, k % 2); c.restore(); }
    }
    if (lights) { lights.push([10, .4, 6.5, [255, 240, 190], 1.1]); lights.push([10, .2, 3, [255, 255, 235], 1]); }
  }
  ART.floorFoliage = floorFoliage; ART.exitTop = exitTop;
  // =============================================
  //  光をかける（画面の大きさで）
  // =============================================
  let LC = null;
  //  g：画面、W/H：画面のピクセル、S：1マスのピクセル、cam：上の高さ、sx：ゆれ、z：景色、lights：[x,y,r,色,強さ]、opt：{ t, dark }
  function lighting(g, W, H, S, cam, sx, z, lights, opt) {
    const q = 4, lw = Math.max(8, Math.ceil(W / q)), lh = Math.max(8, Math.ceil(H / q));
    if (!LC) LC = document.createElement('canvas');
    if (LC.width !== lw || LC.height !== lh) { LC.width = lw; LC.height = lh; }
    const l = LC.getContext('2d');
    l.globalCompositeOperation = 'source-over';
    const amb = lit(z.amb, .28); l.fillStyle = css(amb); l.fillRect(0, 0, lw, lh);
    l.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const X = (L[0] + sx) * S / q, Y = (L[1] - cam) * S / q, R = L[2] * S / q * 1.6;
      if (X + R < 0 || X - R > lw || Y + R < 0 || Y - R > lh) continue;
      l.globalAlpha = Math.max(0, Math.min(1, L[4]));
      l.drawImage(glow(L[3]), X - R, Y - R, R * 2, R * 2);
    }
    l.globalAlpha = 1;
    g.save();
    g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.drawImage(LC, 0, 0, lw * q, lh * q);
    // 光のにじみ（明るい所が少しあふれる）
    g.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (L[4] < .6 || L[2] < 1.2) continue;
      const X = (L[0] + sx) * S, Y = (L[1] - cam) * S, R = L[2] * S * .9;
      if (X + R < 0 || X - R > W || Y + R < 0 || Y - R > H) continue;
      g.globalAlpha = .16 * Math.min(1.4, L[4]); g.drawImage(glow(L[3]), X - R, Y - R, R * 2, R * 2);
    }
    // 光の筋（上から差しこむ）
    const t = opt.t || 0, sa = z.sa;
    if (sa > .02 && !opt.low) {
      for (let i = 0; i < 4; i++) {
        const cx = (.15 + .23 * i + .05 * Math.sin(t * .13 + i * 2)) * W, wd = W * (.06 + .05 * ((i * 7) % 3)), lean = W * .28;
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, css(z.shaft, sa * (.8 + .2 * Math.sin(t * .5 + i)))); gr.addColorStop(1, css(z.shaft, 0));
        g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.moveTo(cx - wd / 2, 0); g.lineTo(cx + wd / 2, 0); g.lineTo(cx + wd / 2 - lean, H); g.lineTo(cx - wd / 2 - lean, H); g.closePath(); g.fill();
      }
    }
    // 画面のふちを暗く
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const vg = g.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .5, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.restore();
  }
  ART.lighting = lighting;
  // ---------- タイトルの森（edermunizz） ----------
  const tBack = new Image(), tFront = new Image();
  tBack.src = 'img/title_back.png'; tFront.src = 'img/title_front.png';
  ART.title = { back: tBack, front: tFront };
})(window);
