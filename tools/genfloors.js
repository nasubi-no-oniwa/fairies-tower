// 100層を作る（決まった乱数なので、何度作っても同じ）→ data/floors.json
//  層の種類：第1〜5層はふつう。第6〜95層は9種族それぞれが得意な層を10回ずつ（並びは決まった乱数）。
//  第96〜99層は3つの種類をまぜる。第100層は頂上（扉つき）
const fs = require('fs'), path = require('path');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r2 = v => Math.round(v * 100) / 100;
const NAMES = [
  ['風の吹き抜け', '高き空洞', '鳥の通い路', '空ろの塔', '果てなき縦穴', '雲の通り道', '渡り風の間', '天への煙突', '大うろ', '風鳴りの井戸'],
  ['蛾の巣', '羽音の間', '蜂の回廊', '鱗粉の霧', '群れの棲み処', '夜蛾の庭', '針の羽音', '舞う影の間', '蛾の女王の間', '羽ばたきの嵐'],
  ['実りの枝', '熟れ実の間', '落ち実の坂', '甘露の天井', '木の実の雨', '重たい梢', '実を抱く枝', '果樹の回廊', '実の滝', '豊穣の天蓋'],
  ['燻る樹皮', '火守の間', '燃える枝', '熾火の回廊', '炎の喉', '焦げた洞', '火の粉の間', '灼けた幹', '紅蓮の節', '炎樹の芯'],
  ['小枝の道', '細枝の綱', '爪先の枝', '糸の枝', '危うい足場', '揺れる小枝', '針の枝', '細き渡り', '枝先の間', '千の小枝'],
  ['何もない空', '虚ろの間', '足場なき空', '霞む空洞', '白い虚空', '空白の節', '宙の間', '風なき空', '沈黙の空洞', '果ての空'],
  ['見えざる棘', '隠れ棘の間', '影の茨', '幻の棘', '忍ぶ茨', '透ける棘', '罠の回廊', '茨の迷い路', '盲いの棘', '棘の帳'],
  ['樹液の泉', '水の節', '沈む洞', '雫の回廊', '満ちる水', '地下水の間', '水脈の道', '深き泉', '水の天井', '樹海の湖'],
  ['闇の節', '暗がりの間', '光なき洞', '夜の芯', '影の回廊', '月なき間', '黒い霧', '宵闇の道', '深い眠りの間', '闇の玉座'],
];
const BASE = ['根の洞', '苔むす回廊', '樹液の小径', '胞子の間', 'うろの広間'];
const MIX = ['試しの枝', '三色の間', '嵐の梢', '最後の節'];
// 層の種類の並び
const order = [];
{ const R = rng(20261021); for (let round = 0; round < 10; round++) { const a = [0, 1, 2, 3, 4, 5, 6, 7, 8]; for (let i = 8; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } order.push(...a.map(t => ({ t, round }))); } }
// 第70層から上は、試しに昇る人（tools/bot.js）でちょうどよい難しさになる作り方（SALT）を選んである（tools/tunefloors.js）
const SALT = { 70: 4, 71: 13, 72: 14, 73: 8, 74: 4, 75: 5, 76: 0, 77: 0, 78: 3, 79: 5, 80: 0, 81: 1, 82: 10, 83: 0, 84: 5, 85: 1, 86: 0, 87: 0, 88: 1, 89: 0, 90: 7, 91: 0, 92: 3, 93: 1, 94: 2, 95: 17, 96: 0, 97: 7, 98: 14, 99: 4, 100: 0 };
function gen(f, salt) {
  if (salt === undefined) salt = SALT[f] || 0;
  const R = rng(f * 7919 + 13 + salt * 100003), d = f / 100;
  // 第70層から上は「長く・手ごわく」（v16）。高さをのばし、仕掛けは高さに合わせて増やす。届かない所は作らない
  const HK = f >= 70 ? (f - 69) / 31 : 0, HM = f >= 70 ? 1.2 + 0.25 * HK : 1, XM = f >= 70 ? HM * (1.05 + 0.15 * HK) : 1;
  const h = Math.round((44 + f * 0.86) * HM);
  let themes = [], name;
  if (f <= 5) { name = BASE[f - 1]; }
  else if (f <= 95) { const o = order[f - 6]; themes = [o.t]; name = NAMES[o.t][o.round]; }
  else { const R2 = rng(f * 31); themes = [0, 3, 6].map(b => b + Math.floor(R2() * 3)); name = f === 100 ? '世界樹の頂' : MIX[f - 96]; }   // 3陣営から1つずつ
  const has = t => themes.includes(t);
  const lv = { f, name, th: themes, h, br: [], sp: [], fj: [], mo: [], fr: [], tn: [], wa: [], dk: [] };
  if (f === 100) lv.door = 1;
  // ---------- 枝 ----------
  lv.br.push([h - 1, 1, 19]);
  let y = h - 1, side = R() < .5 ? -1 : 1;
  let bigP = Math.max(0, Math.min(.75, (f - 8) / 60)) * (has(0) || has(5) ? 1.25 : 1);
  if (f >= 70) bigP = Math.min(.9, bigP + .05 + .08 * HK);
  while (true) {
    let gap;
    if (R() < bigP) gap = 10 + R() * (2 + f * 0.1);
    else gap = 4.5 + R() * (f <= 10 ? 3 : 3.6);
    if (has(0) || has(5)) gap += 1.5 + R() * 2;
    if (has(7)) gap = Math.min(gap, 8);   // 水の層：水のある所で高さをかせぐ
    const ny = y - gap;
    if (ny < 6.5) break;
    let w = Math.max(2, 7.5 - d * 4.5 + R() * 2 - (f >= 70 ? .3 + .3 * HK : 0));
    if (has(4)) w = 1.2 + R() * 1.1;
    side = -side;
    const span = 18 - w; let x0 = 1 + (side < 0 ? R() * span * .55 : span * .45 + R() * span * .55);
    x0 = Math.max(1, Math.min(19 - w, x0));
    const b = [r2(ny), r2(x0), r2(x0 + w)];
    if (has(3) && R() < .55) { b.push(r2(2.6 + R() * 1.6), r2(R() * 3)); }
    lv.br.push(b); y = ny;
  }
  // 最後の枝から出口（y<1.2）までは、翅1回で届く高さにする
  if (y - 1.2 > 7) { const w = 4; lv.br.push([r2(1.2 + 6), r2(10 - w / 2), r2(10 + w / 2)]); y = 7.2; }
  lv.top = y;
  // ---------- 仕掛け（枝の近くは避ける） ----------
  const near = (yy, m) => lv.br.some(b => Math.abs(b[0] - yy) < m);
  const pickY = (m, lo, hi) => { for (let i = 0; i < 40; i++) { const yy = (lo || 3) + R() * ((hi || h - 4) - (lo || 3)); if (!near(yy, m)) return r2(yy); } return null; };
  const nSp = Math.round((d * 8 + (has(4) || has(5) ? 3 : 0)) * XM);
  for (let i = 0; i < nSp; i++) { const yy = pickY(1.4); if (yy !== null) lv.sp.push([yy, R() < .5 ? -1 : 1, r2(6 + R() * 6), r2(1.7 + R() * 1.2), r2(R() * 3)]); }
  const nMo = Math.round(((f <= 3 ? f - 1 : 1 + d * 4) + (has(1) ? 6 + d * 6 : 0) + (has(8) ? 2 : 0)) * XM);
  for (let i = 0; i < nMo; i++) { const yy = pickY(1.1); if (yy === null) continue; const bee = has(1) && R() < .45 ? 1 : 0; const a = 1.5 + R() * 3, b = 18.5 - R() * 3; lv.mo.push([yy, r2(a), r2(b), r2(bee ? 1.6 + R() * 1.2 : 3 + R() * 2.2), r2(R()), bee]); }
  const nFr = Math.round((d * 3 + (has(2) ? 8 + d * 8 : 0)) * XM);
  for (let i = 0; i < nFr; i++) { const yy = pickY(.5, 14); if (yy !== null) lv.fr.push([r2(2 + R() * 16), yy, r2(2.2 + R() * 1.6), r2(R() * 3)]); }
  if (has(3)) { const n = Math.round((5 + d * 7) * XM); for (let i = 0; i < n; i++) { const yy = pickY(1.4); if (yy !== null) lv.fj.push([yy, R() < .5 ? -1 : 1, r2(7 + R() * 5), r2(2 + R() * 1.4), r2(R() * 3)]); } }
  // 見えない棘：間を3マス以上あける。生まれる場所の上と、枝の上は避ける
  if (has(6) || has(8)) {
    const n = Math.round((has(6) ? 10 + d * 18 : 4 + d * 6) * XM);
    for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
      const xx = 1.8 + R() * 16.4, yy = 3 + R() * (h - 8);
      if (yy > h - 6 && Math.abs(xx - 10) < 3) continue;
      if (lv.br.some(b => yy > b[0] - 2 && yy < b[0] + .6 && xx > b[1] - .6 && xx < b[2] + .6)) continue;
      if (lv.tn.some(q => (q[0] - xx) ** 2 + (q[1] - yy) ** 2 < 9)) continue;
      lv.tn.push([r2(xx), r2(yy)]); i++;
    }
  }
  if (has(7)) {
    // 水は、枝と枝のあいだに入れる（下の枝の1マス上から。上の枝まで2マス以上あける）
    const n = Math.round((2 + Math.round(d * 2)) * HM), gaps = [];
    for (let i = 1; i < lv.br.length; i++) { const lo = lv.br[i - 1][0], hi = lv.br[i][0]; if (lo - hi >= 5 && lo < h - 3) gaps.push([lo, hi]); }
    for (let i = 0; i < n && gaps.length; i++) {
      const [lo, hi] = gaps.splice(Math.floor(R() * gaps.length), 1)[0];
      const th = Math.min(lo - hi - 2.5, 2.5 + R() * (1.5 + d * 1.5)); if (th < 2) continue;
      lv.wa.push([r2(lo - 1 - th), r2(lo - 1)]);
    }
  }
  if (has(8)) { const a = h * (.15 + R() * .2), b = a + h * (.4 + R() * .25); lv.dk.push([r2(a), r2(Math.min(h - 2, b))]); }
  if (f === 1) { lv.sp = []; lv.mo = lv.mo.slice(0, 1); lv.fr = []; }
  return lv;
}
module.exports = { gen };
if (require.main !== module) return;
const all = []; for (let f = 1; f <= 100; f++) all.push(gen(f));
const out = path.join(__dirname, '..', 'data', 'floors.json');
fs.writeFileSync(out, JSON.stringify(all));
// 数え：どの種族が得意な層がいくつか
const cnt = new Array(9).fill(0); for (const lv of all) for (const t of lv.th) cnt[t]++;
const fac = [cnt[0] + cnt[1] + cnt[2], cnt[3] + cnt[4] + cnt[5], cnt[6] + cnt[7] + cnt[8]];
console.log('書き出し', out, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
console.log('種族ごと', cnt.join(' '), '陣営ごと', fac.join(' '));
