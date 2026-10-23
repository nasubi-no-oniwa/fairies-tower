// 混んだ時間のテスト：P人が同じ層で、25秒に1回くらい死んで、そのたびに屍を読みなおす
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = process.env.FT_ROOT || path.join(__dirname, '..');
const PORT = 9950 + Math.floor(Math.random() * 40);
const srv = cp.spawn(process.execPath, [path.join(__dirname, 'fakefb.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
process.on('exit', () => { try { srv.kill(); } catch (e) { } });
const floors = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/floors.json')));
const CFG = { g: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'g' }, r: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'r' }, b: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'b' } };
function client() {
  const mem = {};
  const ctx = { console, Math, Map, Set, Array, Object, JSON, Number, String, Promise, Error, Date, URL, URLSearchParams, encodeURIComponent, decodeURIComponent, Infinity, isNaN, parseInt, Float64Array, Int16Array, Uint8Array, setTimeout, clearTimeout, fetch, localStorage: { getItem: k => mem[k] === undefined ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); } } };
  ctx.globalThis = ctx; ctx.window = ctx;
  ctx.FT_CONFIG = CFG; ctx.FT_AUTHURL = { up: `http://127.0.0.1:${PORT}/auth/up`, ref: `http://127.0.0.1:${PORT}/auth/ref` }; ctx.FT_SNAPBASE = `http://127.0.0.1:${PORT}/nosnap/`;
  vm.createContext(ctx);
  for (const f of ['engine.js', 'verify.js', 'net.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
  ctx.FT.NET.fac = 'g'; return ctx;
}
const stat = async () => (await (await fetch(`http://127.0.0.1:${PORT}/__stats`)).json());
const P = +(process.argv[2] || 20), SECS = +(process.argv[3] || 90), F = 3, SYNC = +(process.env.SYNC || 20);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function player(i, until) {
  const C = client(), N = C.FT.NET, lv = Object.assign({}, floors[F - 1], { _ctx: { maxB: 0, door: false } });
  let cor = await N.loadCells(lv), seed = i * 7919 + 13, syncAt = Date.now();
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  await sleep(rnd() * 25000);
  while (Date.now() < until) {
    const r = new C.FT.Run(lv, cor, { sp: 3 }), rec = new C.FT.Rec(); let hold = 0, b = 0;
    while (!r.over && r.t < 120 * 60) { if (--hold <= 0) { hold = 20 + Math.floor(rnd() * 90); b = (rnd() < .8 ? 4 : 0) | (rnd() < .5 ? 1 : 2); } rec.put(r.t + 1, b); r.step(b); }
    if (r.over && !r.clear && r.place) {
      const pl = r.place, st = C.FT.corStr(cor); const mine = new Map();
      if (pl.k >= 0) { const c = cor.get(pl.k); if (pl.merge && c) c.n++; else { cor.set(pl.k, { n: 1, s: 3, name: 'p' + i }); mine.set(pl.k, cor.get(pl.k)); } }
      N.died({ f: F, k: pl.k, merge: !!pl.merge, s: 3, name: 'p' + i, rec: rec.str(), cor: st, ticks: r.t, b: 0, m: 10 }).catch(() => { });
      if (Date.now() - syncAt > SYNC * 1000) { syncAt = Date.now(); const m = await N.syncCells(lv, mine).catch(() => null); if (m) cor = m; }
    }
    await sleep(20000 + rnd() * 10000);
  }
  await N.flush().catch(() => { });
}
(async () => {
  await new Promise(r => srv.stdout.once('data', r));
  // はじめに、その層に200人分の屍がある状態にする
  const seedC = client(); const lv0 = Object.assign({}, floors[F - 1], { _ctx: { maxB: 0, door: false } }); let cor = await seedC.FT.NET.loadCells(lv0);
  for (let i = 0; i < 200; i++) { const r = new seedC.FT.Run(lv0, cor, { sp: 3 }), rec = new seedC.FT.Rec(); let s = i * 31 + 7, hold = 0, b = 0; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; while (!r.over && r.t < 7200) { if (--hold <= 0) { hold = 20 + Math.floor(rnd() * 90); b = (rnd() < .8 ? 4 : 0) | (rnd() < .5 ? 1 : 2); } rec.put(r.t + 1, b); r.step(b); } if (!r.over || r.clear) continue; const pl = r.place, st = seedC.FT.corStr(cor); if (pl.k >= 0) { const c = cor.get(pl.k); if (pl.merge && c) c.n++; else cor.set(pl.k, { n: 1, s: 3, name: 's' }); } seedC.FT.NET.died({ f: F, k: pl.k, merge: !!pl.merge, s: 3, name: 's' + i, rec: rec.str(), cor: st, ticks: r.t, b: 0, m: 10 }).catch(() => { }); }
  await seedC.FT.NET.flush(); await sleep(1500); await seedC.FT.NET.flush();
  const s0 = await stat(); const until = Date.now() + SECS * 1000;
  await Promise.all(Array.from({ length: P }, (_, i) => player(i, until)));
  const s1 = await stat(); const kb = (s1.bytes - s0.bytes) / 1024;
  console.log(`${P}人 × ${SECS}秒（読みなおし ${SYNC}秒ごと）：読んだ量 ${kb.toFixed(0)} KB、読んだ回数 ${s1.read - s0.read}　→ 1人1時間あたり ${(kb / P * 3600 / SECS / 1024).toFixed(1)} MB`);
  process.exit(0);
})();
