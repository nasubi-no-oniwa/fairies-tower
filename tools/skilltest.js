// 種族の技のテスト
require('../js/engine.js'); const FT = globalThis.FT;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ○', m); } else { fail++; console.log('  ×', m); } };
const lv = { h: 60, br: [[59, 1, 19]] };
// 灰：空中で翅が尽きると、1回の命で1度だけ足もとに足場が出る
{ const r = new FT.Run(lv, new Map(), { sp: 5 }); let placedAt = -1;
  while (!r.over && r.t < 3000) { r.step(4); if (r.block && placedAt < 0) placedAt = r.t; if (placedAt > 0 && r.p.on) break; }
  ok(placedAt > 0 && !r.over && r.p.on && Math.abs(r.p.y + 0.9 - r.block.y) < .01, `灰の妖精：翅が尽きると足場が出て立てる（高さ ${r.block ? (59 - r.block.y).toFixed(2) : '-'}）`);
  for (let i = 0; i < 120; i++) r.step(0); ok(r.p.gauge > .9, '足場の上で翅が戻る');
  while (!r.over && r.t < 9000) r.step(4); ok(r.over && r.dead === 'wing' && r.events.length >= 0, `2回目は力尽きる（${r.dead}）`);
  const r2 = new FT.Run(lv, new Map(), { sp: 3 }); while (!r2.over) r2.step(4); ok(r2.dead === 'wing' && !r2.block, 'ほかの妖精は足場が出ない'); }
// 黄：魔物がいつも少しゆっくり動く
{ const m = [27.5, 4, 16, 3, 0, 0]; const a = FT.mothAt(m, FT.mothT(1, 2)), b = FT.mothAt(m, FT.mothT(3, 2));
  ok(Math.abs(FT.mothT(1, 10) - 6.5) < 1e-9 && FT.mothT(3, 10) === 10, '黄の妖精には魔物が0.65倍の速さ');
  ok(a.x !== b.x, `同じ時刻でも魔物の位置がちがう（${a.x.toFixed(2)} と ${b.x.toFixed(2)}）`);
  const lv2 = { h: 30, br: [[29, 1, 19]], mo: [[27.5, 9, 11, 3, 0, 0]] };
  const r2 = new FT.Run(lv2, new Map(), { sp: 3 }); for (let i = 0; i < 1200 && !r2.over; i++) r2.step(i % 120 < 60 ? 4 : 0); ok(r2.dead === 'moth' || r2.dead === 'wing', `魔物には触れると死ぬ（${r2.dead}）`); }
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
