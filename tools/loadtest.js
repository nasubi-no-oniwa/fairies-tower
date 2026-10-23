// 通信量のテスト：何百人も死んだ層に、新しい人が入るとき、どれだけ読むか
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = 9800 + Math.floor(Math.random() * 150);
const SNAPDIR = fs.mkdtempSync('/tmp/ftsnap');
const srv = cp.spawn(process.execPath, [path.join(__dirname, 'fakefb.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: Object.assign({}, process.env, { FAKE_STATIC: SNAPDIR }) });
process.on('exit', () => { try { srv.kill(); } catch (e) { } });
const floors = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/floors.json')));
const CFG = { g: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'g' }, r: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'r' }, b: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'b' } };
function client(snap) {
  const mem = {};
  const ctx = { console, Math, Map, Set, Array, Object, JSON, Number, String, Promise, Error, Date, URL, URLSearchParams, encodeURIComponent, decodeURIComponent, Infinity, isNaN, parseInt, Float64Array, Int16Array, Uint8Array, setTimeout, clearTimeout, fetch, localStorage: { getItem: k => mem[k] === undefined ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); } } };
  ctx.globalThis = ctx; ctx.window = ctx;
  ctx.FT_CONFIG = CFG; ctx.FT_AUTHURL = { up: `http://127.0.0.1:${PORT}/auth/up`, ref: `http://127.0.0.1:${PORT}/auth/ref` }; ctx.FT_SNAPBASE = snap ? `http://127.0.0.1:${PORT}/static/` : `http://127.0.0.1:${PORT}/nosnap/`;
  vm.createContext(ctx);
  for (const f of ['engine.js', 'verify.js', 'net.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
  ctx.FT.NET.fac = 'g'; return ctx;
}
const stat = async () => (await (await fetch(`http://127.0.0.1:${PORT}/__stats`)).json());
const F = +(process.argv[2] || 1), DEATHS = +(process.argv[3] || 300);
const lvOf = () => Object.assign({}, floors[F - 1], { _ctx: { maxB: 0, door: false } });
async function dieMany(n, who) {
  const C = client(false), N = C.FT.NET, lv = lvOf(); let cor = await N.loadCells(lv); const jobs = [];
  for (let i = 0; i < n; i++) {
    const r = new C.FT.Run(lv, cor, { sp: 3 }), rec = new C.FT.Rec(); let seed = (i + 1) * 7919 + who * 104729;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let hold = 0, b = 0;
    while (!r.over && r.t < 120 * 40) { if (--hold <= 0) { hold = 20 + Math.floor(rnd() * 90); b = (rnd() < .8 ? 4 : 0) | (rnd() < .5 ? 1 : 2); } rec.put(r.t + 1, b); r.step(b); }
    if (!r.over || r.clear) continue;
    const pl = r.place, st = C.FT.corStr(cor);
    if (pl.k >= 0) { const c = cor.get(pl.k); if (pl.merge && c) c.n++; else cor.set(pl.k, { n: 1, s: 3, name: 'x' + i }); }
    jobs.push(N.died({ f: F, k: pl.k, merge: !!pl.merge, s: 3, name: 'bot' + who + '_' + i, rec: rec.str(), cor: st, ticks: r.t, b: 0, m: 10 }).catch(() => { }));
  }
  await N.flush(); await Promise.all(jobs);
}
async function measure(label, snap) {
  const s0 = await stat(); const C = client(snap); const t0 = Date.now(); const cor = await C.FT.NET.loadCells(lvOf()); const s1 = await stat();
  console.log(`${label}: 見える屍 ${cor.size}　読んだ量 ${((s1.bytes - s0.bytes) / 1024).toFixed(1)} KB　読んだ回数 ${s1.read - s0.read}　${Date.now() - t0}ms`);
  return s1.bytes - s0.bytes;
}
(async () => {
  await new Promise(r => srv.stdout.once('data', r));
  const per = Math.ceil(DEATHS / 10); const t0 = Date.now();
  await Promise.all(Array.from({ length: 10 }, (_, i) => dieMany(per, i)));
  const dl = await (await fetch(`http://127.0.0.1:${PORT}/ft_dlog/${F}.json?ns=g`)).json(), cells = await (await fetch(`http://127.0.0.1:${PORT}/ft_cells/${F}.json?ns=g`)).json();
  const drec = await (await fetch(`http://127.0.0.1:${PORT}/ft_drec/${F}.json?ns=g`)).json();
  console.log(`第${F}層：死んだ記録 ${Object.keys(dl || {}).length} 件、屍 ${Object.keys(cells || {}).length} か所、再生用の記録 合計 ${(JSON.stringify(drec).length / 1024).toFixed(0)} KB（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
  const a = await measure('まとめなしで新しい人が入る', false);
  const out = cp.spawnSync(process.execPath, [path.join(__dirname, 'snapshot.js')], { env: Object.assign({}, process.env, { FT_CONFIG_JSON: JSON.stringify(CFG), FT_SNAP_DIR: SNAPDIR }), encoding: 'utf8' });
  const sz = fs.existsSync(path.join(SNAPDIR, 'g', 'f' + F + '.json')) ? fs.statSync(path.join(SNAPDIR, 'g', 'f' + F + '.json')).size : 0;
  console.log(`まとめを作った（第${F}層のまとめ ${(sz / 1024).toFixed(1)} KB。GitHub から配るので Firebase の通信には入らない）`);
  const b = await measure('まとめのあとに新しい人が入る', true);
  await dieMany(30, 99);
  const c = await measure('まとめのあと、さらに30人死んでから入る', true);
  console.log(JSON.stringify({ a, b, c }));
  process.exit(0);
})();
