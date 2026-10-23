// 第70層から上の作り方（SALT）をえらぶ：試しに昇る人（bot）が、ちょうどよい人数で越えられるものだけ
//   node tools/tunefloors.js 70 → その層の結果を1行で出す
const { gen } = require('./genfloors.js'), { climb } = require('./bot.js');
const f = +process.argv[2], lo = Math.round(45 + (f - 70) * 2.3) * (f === 100 ? 1.6 : 1), hi = Math.round(lo * 2.4);
let best = null;
for (let salt = 0; salt < 24; salt++) {
  const lv = gen(f, salt), res = climb(lv, { sp: -1, max: Math.round(hi * 1.6), mix: true });
  const n = res.ok ? res.lives : Infinity;
  if (n >= lo && n <= hi) { console.log(JSON.stringify({ f, salt, n, lo, hi, h: lv.h })); process.exit(0); }
  const dist = n === Infinity ? 1e9 : (n < lo ? lo - n : n - hi);
  if (!best || dist < best.dist) best = { f, salt, n, lo, hi, h: lv.h, dist };
}
console.log(JSON.stringify(best));
