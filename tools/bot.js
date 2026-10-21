// 試しに昇る人（詰みがないか・何人死ねば越えられるかを調べる）
//  ・本当のゲームと同じ計算で動く
//  ・足場に立つたびに、いくつかの飛び方（待つ時間・ねらう場所）を頭の中でためして、
//    仕掛けに当たらない飛び方をえらぶ（上手な人のまね）。届かない所は、まっすぐ昇って力尽きる
require('../js/engine.js');
const FT = globalThis.FT, PW = FT.PHYS.PW, PH = FT.PHYS.PH;
function supports(lv, cor) {
  const a = lv.br.map(b => ({ y: b[0], x0: b[1], x1: b[2], c: false }));
  for (const [k, c] of cor) { const w = FT.corW(c.n, c.s); a.push({ y: FT.ky(k), x0: FT.kx(k) - w / 2, x1: FT.kx(k) + w / 2, c: true }); }
  return a;
}
function cloneRun(r) { const c = Object.create(FT.Run.prototype); Object.assign(c, r); c.p = Object.assign({}, r.p); c.drops = r.drops.map(d => Object.assign({}, d)); c.dropLast = new Map(r.dropLast); c.block = r.block ? Object.assign({}, r.block) : null; c.frz = new Map(r.frz); c.events = []; return c; }
// 1つの飛び方：wait こま待って、tgt をめざす
function policy(r, st) {
  const p = r.p, feet = p.y + PH, cx = p.x + PW / 2, T = st.tgt;
  if (st.wait > 0) { st.wait--; return 0; }
  let inp = 0;
  // まず立っている足場の上で、ねらう所の近くまで歩く
  if (st.own && !st.walked) { const wx = Math.max(st.own.x0 + .45, Math.min(st.own.x1 - .45, st.tx)); if (p.on && Math.abs(cx - wx) > .2) return cx < wx ? 2 : 1; st.walked = true; }
  if (cx < st.tx - .25) inp |= 2; else if (cx > st.tx + .25) inp |= 1;
  const over = cx > T.x0 + .15 && cx < T.x1 - .15, above = feet < T.y - 0.35;
  if (p.wet && r.sp !== 7) { if (!(above && over)) inp |= 4; }
  else if (T.c && over && (feet - T.y < 0.75 || p.gauge < 0.04)) { }
  else if (!(above && over)) inp |= 4;
  if (st.skill && r.t % 60 === 0) inp |= 8;
  return inp;
}
function ownOf(S, r) { const p = r.p, feet = p.y + PH, cx = p.x + PW / 2; return S.find(q => Math.abs(q.y - feet) < .03 && cx > q.x0 - .4 && cx < q.x1 + .4) || null; }
function trial(r0, tgt, wait, xoff, startFeet, kill, own) {
  const r = cloneRun(r0), st = { tgt, wait, tap: 0, own, tx: Math.max(1.5, Math.min(18.5, (tgt.x0 + tgt.x1) / 2 + xoff)), skill: r.sp === 1 };
  const lim = r.t + wait + 120 * 4;
  let left = false;
  while (!r.over && r.t < lim) {
    r.step(policy(r, st));
    if (!r.p.on) left = true;
    if (left && r.p.on && r.p.y + PH < startFeet - 0.3) return { ok: true, r };
  }
  if (r.clear) return { ok: true, r };
  if (kill && r.over && (r.dead === 'wing' || r.dead === 'drown') && r.p.y + PH < startFeet - 4) return { ok: true, r };
  return { ok: false, r };
}
function life(lv, cor, sp, b, door, seed, tickLim, from) {
  const r = new FT.Run(lv, cor, { sp, b, door });
  if (from) { r.p.x = from.x; r.p.y = from.y - PH; r.t = from.t || 0; }
  let s = ((seed + 1) * 2654435761) >>> 0; const R = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const reach = 9.16 * (sp === 0 ? 1.3 : 1) * (1 + 0.03 * b) - 0.6;
  const S = supports(lv, cor);
  const rec = new FT.Rec();
  const act = inp => { rec.put(r.t + 1, inp); r.step(inp); };
  while (!r.over && r.t < tickLim) {
    const p = r.p;
    if (!p.on || p.gauge < 1) { act(0); continue; }
    const feet = p.y + PH;
    // ねらえる足場（高い順）
    const cand = S.filter(q => q.y < feet - 0.3 && feet - q.y <= reach + (q.c ? 1.1 : 0)).sort((a, b) => a.y - b.y).slice(0, 4);
    let plan = null; const own = ownOf(S, r);
    const tries = [];
    for (const q of cand) for (let k = 0; k < 6; k++) tries.push({ q, kill: false });
    {
      let nx = null; for (const q of S) if (q.y < feet - 0.3 && (!nx || q.y > nx.y)) nx = q;
      const c = nx ? (nx.x0 + nx.x1) / 2 : 10;
      for (let k = 0; k < 16; k++) tries.push({ q: { y: -99, x0: c - .3, x1: c + .3 }, kill: true });
    }
    let k2 = 0; for (const tr of tries) {
      const wait = Math.floor(R() * 300), xoff = (R() - .5) * (tr.kill ? (k2++ < 8 ? 6 : 16) : Math.max(0, tr.q.x1 - tr.q.x0 - .8));
      const res = trial(r, tr.q, wait, xoff, feet, tr.kill, own);
      if (res.ok) { plan = { q: tr.q, wait, xoff }; break; }
    }
    if (!plan) { const q = cand[0] || { y: -99, x0: 9.7, x1: 10.3 }; plan = { q, wait: Math.floor(R() * 200), xoff: (R() - .5) * 4 }; }
    // 決めた飛び方で動く
    const st = { tgt: plan.q, wait: plan.wait, tap: 0, own, tx: Math.max(1.5, Math.min(18.5, (plan.q.x0 + plan.q.x1) / 2 + plan.xoff)), skill: r.sp === 1 };
    let left = false; const lim = r.t + plan.wait + 120 * 5;
    while (!r.over && r.t < lim) { act(policy(r, st)); if (!r.p.on) left = true; if (left && r.p.on) break; }
  }
  return { r, rec: rec.str() };
}
function addCorpse(cor, pl, sp) { if (!pl || pl.k < 0) return; const c = cor.get(pl.k); if (c) c.n++; else cor.set(pl.k, { n: 1, s: sp, name: 'bot' }); }
function climb(lv, opt) {
  opt = opt || {};
  const cor = opt.cor || new Map(), sp = opt.sp === undefined ? 3 : opt.sp, b = opt.b || 0, max = opt.max || 400;
  let ticks = 0, best = lv.h;
  for (let i = 0; i < max; i++) {
    const spx = opt.mix ? (i % 9) : sp;
    const { r, rec } = life(lv, cor, spx, b, opt.door !== false, i * 7 + 1 + (opt.seed || 0) * 1000, 120 * 120, opt.ckpt ? opt._from : null);
    ticks += r.t; best = Math.min(best, r.p.top);
    if (opt.ckpt && r.lastOn && (!opt._from || r.lastOn.y < opt._from.y - 0.5)) opt._from = Object.assign({ t: (i * 997) % 5000 }, r.lastOn);
    if (r.clear) return { ok: true, lives: i + 1, ticks, cor: cor.size, rec, sp: spx, corMap: cor };
    if (opt.onLife) opt.onLife(r, rec, spx, new Map(cor));
    if (r.over && r.place) addCorpse(cor, r.place, spx);
  }
  return { ok: false, lives: max, ticks, best, cor: cor.size, corMap: cor };
}
module.exports = { climb, life, cloneRun };
if (require.main === module) {
  const floors = require('../data/floors.json');
  const list = process.argv[2] ? process.argv[2].split(',').map(Number) : floors.map(l => l.f);
  const sp = process.argv[3] !== undefined ? +process.argv[3] : 3;
  for (const f of list) {
    const lv = floors[f - 1], t0 = Date.now();
    const res = climb(lv, { sp, max: +(process.argv[4] || 400), mix: sp < 0, ckpt: !!process.env.CKPT });
    console.log(`第${f}層 ${lv.name} [${lv.th}] h${lv.h}`, res.ok ? `越えた：${res.lives}人目` : `越えられない（${res.lives}人。一番上 ${res.best.toFixed(1)}）`, `屍${res.cor}か所`, `${(Date.now() - t0) / 1000}s`);
  }
}
