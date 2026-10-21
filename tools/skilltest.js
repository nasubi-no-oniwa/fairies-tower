// 種族の技のテスト
require('../js/engine.js'); const FT = globalThis.FT;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ○', m); } else { fail++; console.log('  ×', m); } };
const lv = { h: 60, br: [[59, 1, 19]] };
// 灰：空中で足場を作って、そこに降りる
{ const r = new FT.Run(lv, new Map(), { sp: 5 }); let placed = false;
  while (!r.over && r.t < 2000) { const b = r.t < 60 ? 4 : r.t === 61 ? 8 : 0; r.step(b); if (r.block) placed = true; if (placed && r.p.on && r.t > 70) break; }
  ok(placed && r.p.on && Math.abs(r.p.y + 0.9 - r.block.y) < .01, `灰の妖精：空中に足場を作って立てる（高さ ${(59 - r.block.y).toFixed(2)}）`);
  const g0 = r.p.gauge; for (let i = 0; i < 120; i++) r.step(0); ok(r.p.gauge > g0, '足場の上で翅が戻る');
  r.step(8); ok(r.events.filter(e => e.k === 'block').length <= 1, '足場は1つの命で1つ'); }
// 黄：魔物を止める
{ const lv2 = { h: 30, br: [[29, 1, 19]], mo: [[27.5, 9, 11, 3, 0, 0]] };
  const r = new FT.Run(lv2, new Map(), { sp: 1 }); r.step(8); ok(r.frz.size === 1, '黄の妖精：近くの魔物が止まる');
  let alive = true; for (let i = 0; i < 280; i++) { r.step(0); if (r.over) { alive = false; break; } } ok(alive, '止まっている間は触れても平気');
  const r2 = new FT.Run(lv2, new Map(), { sp: 3 }); let died = null; for (let i = 0; i < 1200 && !r2.over; i++) r2.step(i % 120 < 60 ? 4 : 0); ok(r2.dead === 'moth' || r2.dead === 'wing', `ほかの妖精は魔物で死ぬ（${r2.dead}）`); }
// 赤：炎で死なない
{ const lv3 = { h: 30, br: [[29, 1, 19, 1, 0]], fj: [] };
  const r = new FT.Run(lv3, new Map(), { sp: 3 }); for (let i = 0; i < 600 && !r.over; i++) r.step(0); ok(!r.over, '赤の妖精：燃える枝でも平気');
  const r2 = new FT.Run(lv3, new Map(), { sp: 0 }); for (let i = 0; i < 600 && !r2.over; i++) r2.step(0); ok(r2.dead === 'burn', `ほかの妖精は燃える枝で死ぬ（${r2.dead}）`); }
// 桃：桃色の屍から高く跳ぶ
{ const k = FT.ckey(40, 50 * 4); const run = (s) => { const r = new FT.Run({ h: 60, br: [[59, 1, 19]] }, new Map([[k, { n: 1, s }]]), { sp: 3 }); r.p.x = 9.65; r.p.y = 50 - .9; r.p.on = true; let top = 99; r.step(0); for (let i = 0; i < 100; i++) { r.step(4); top = Math.min(top, r.p.y); if (r.p.gauge < .9) break; } return 50 - .9 - top; };
  const a = run(2), b = run(3); ok(a > b + 2, `桃色の屍からは高く跳ぶ（${a.toFixed(2)} ＞ ${b.toFixed(2)}）`); }
// 茶：広い屍
ok(FT.corW(1, 4) > FT.corW(1, 3) + 1, `茶の妖精の屍は広い（${FT.corW(1, 4)} ＞ ${FT.corW(1, 3)}）`);
// 青：水の中で息が切れない
{ const lv4 = { h: 30, br: [[29, 1, 19]], wa: [[10, 28.5]] };
  const r = new FT.Run(lv4, new Map(), { sp: 7 }); for (let i = 0; i < 1500 && !r.over; i++) r.step(i < 900 ? 4 : 0); ok(!r.over || r.clear || r.dead !== 'drown', `青の妖精：水の中で息が切れない（${r.dead || '生きている'}）`);
  const r2 = new FT.Run(lv4, new Map(), { sp: 3 }); for (let i = 0; i < 1500 && !r2.over; i++) r2.step(4); ok(r2.dead === 'drown', `ほかの妖精は息が尽きる（${r2.dead}）`); }
// 緑：長く飛ぶ
{ const h = sp => { const r = new FT.Run(lv, new Map(), { sp }); while (!r.over) r.step(4); return 59 - (r.p.y + .9); };
  ok(h(0) > h(3) * 1.2, `緑の妖精は高く飛べる（${h(0).toFixed(2)} ＞ ${h(3).toFixed(2)}）`); }
// 追い上げ
{ const h = b => { const r = new FT.Run(lv, new Map(), { sp: 3, b }); while (!r.over) r.step(4); return 59 - (r.p.y + .9); };
  ok(h(10) > h(0) * 1.2, `追い上げ（${h(10).toFixed(2)} ＞ ${h(0).toFixed(2)}）`); }
// 頂上の扉
{ const lv5 = { h: 12, br: [[11, 1, 19]], door: 1 };
  const r = new FT.Run(lv5, new Map(), { sp: 0, door: false }); for (let i = 0; i < 400 && !r.over; i++) r.step(4); ok(!r.clear, '扉が閉じていると、頂上に抜けられない');
  const r2 = new FT.Run(lv5, new Map(), { sp: 0, door: true }); for (let i = 0; i < 400 && !r2.over; i++) r2.step(4); ok(r2.clear, '扉が開いていれば抜けられる'); }
// 決まった答え：同じ操作なら同じ結果
{ const floors = require('../data/floors.json'); const lvx = floors[49]; const inp = t => ((t * 7919) % 13 < 7 ? 4 : 0) | ((t >> 6) % 3 === 0 ? 1 : 2);
  const a = new FT.Run(lvx, new Map(), { sp: 3 }), b = new FT.Run(lvx, new Map(), { sp: 3 }); while (!a.over && a.t < 20000) a.step(inp(a.t + 1)); while (!b.over && b.t < 20000) b.step(inp(b.t + 1));
  ok(a.t === b.t && a.p.x === b.p.x && a.p.y === b.p.y, `同じ操作なら同じ結果（${a.t}こま ${a.dead}）`); }
console.log(`合格 ${pass}　不合格 ${fail}`); process.exit(fail ? 1 : 0);
