// =============================================
//  Fairies' Tower  ずる対策の確かめ（ゲームの端末・裏の計算役・GitHubのまとめ役で同じ計算）
//   ・屍：死んだ挑戦の操作を、その挑戦の始まりの屍で再生して、本当にその場所に屍ができるものだけ数える
//     （始まりの屍は、そのときまでに確かめた屍の中にあること）
//   ・越えた記録：操作を再生して、本当に出口に着くものだけ認める
//   ・追い上げ（翅が少し長くなる）は、いまの先頭の高さから決まる上限まで
// =============================================
(function (G) {
  const FT = G.FT;
  const V = FT.V = {};
  V.DMAX = 120 * 60 * 6;   // 1つの挑戦を再生する長さの上限（6分）
  // 追い上げ：先頭の陣営の最新の層より3層以上遅れている層では、1層ごとに翅が3%長くなる（30%まで）
  V.bonusFor = (f, lead) => Math.max(0, Math.min(10, (lead | 0) - f - 2));
  // 頂上の扉：ほかの陣営のどれかが第80層まで来ていれば開く
  V.DOOR_AT = 80;
  V.doorOpen = others => (others || []).some(t => (t | 0) >= V.DOOR_AT);
  // 始まりの屍が、確かめた屍の中にあるか（present：{ 場所: [人数, 種族] }）
  function snapOk(snap, present) {
    for (const [k, c] of snap) { const q = present[k]; if (!q || q[1] !== c.s || c.n > Math.max(1, q[0])) return false; }
    return true;
  }
  V.snapOk = snapOk;
  // 1つの屍の記録：'ok' / 'snap' / 'replay' / 'long' / 'nodata' / 'bonus'
  V.verifyDeath = function (lv, it, present, ctx) {
    if (!it || typeof it.r !== 'string' || typeof it.c !== 'string' || !(it.k >= 1) || typeof it.p !== 'string') return 'nodata';
    if (it.k > V.DMAX) return 'long';
    if ((it.b | 0) > ctx.maxB) return 'bonus';
    const snap = FT.corParse(it.c);
    if (!snapOk(snap, present)) return 'snap';
    const r = FT.replay(lv, snap, it.r, { sp: it.s | 0, b: it.b | 0, door: !!ctx.door }, (it.k | 0) + 2);
    if (r.over && !r.clear && r.place && r.place.k >= 0 && !r.place.merge && String(r.place.k) === it.p) return 'ok';
    return 'replay';
  };
  // まとめて確かめる。budget：計算する動きの量
  V.verifyDeaths = function (lv, items, present, bad, budget, ctx) {
    const add = [], badInc = {}; let i = 0;
    present = Object.assign({}, present);
    for (; i < items.length; i++) {
      const it = items[i];
      if (present[it.p]) continue;
      if (((bad[it.u] || 0) + (badInc[it.u] || 0)) >= 3) continue;
      if (budget <= 0) break;
      if (!(it.k <= V.DMAX)) continue;
      budget -= Math.max(1, it.k | 0);
      const res = V.verifyDeath(lv, it, present, ctx);
      if (res === 'ok') { present[it.p] = [it.n || 1, it.cs === undefined ? (it.s | 0) : it.cs]; add.push(it.p); }
      else if (res === 'replay') badInc[it.u] = (badInc[it.u] || 0) + 1;
    }
    return { done: i, add, badInc };
  };
  // 越えた記録が本当か
  V.verifyClear = function (lv, c, present, ctx) {
    if (!c || typeof c.r !== 'string' || typeof c.c !== 'string' || typeof c.t !== 'number' || !(c.k >= 1)) return false;
    if ((c.b | 0) > ctx.maxB) return false;
    const snap = FT.corParse(c.c);
    if (!snapOk(snap, present)) return false;
    const r = FT.replay(lv, snap, c.r, { sp: c.s | 0, b: c.b | 0, door: !!ctx.door }, Math.min(120 * 60 * 10, (c.k | 0) + 2));
    return r.clear;
  };
  // ---------- 1つの層の確かめの状態 ----------
  //  st：{ t：どこまで確かめたか, ti：その時刻で終えた記録, P：{場所: 確かめた数}, bad：{匿名ID: だめな数} }
  V.newState = () => ({ t: 0, ti: [], P: {}, bad: {} });
  // 確かめた屍（present の形）
  V.presentOf = (st, raw) => { const o = {}; for (const k in st.P) { const c = raw[k]; if (c) o[k] = [Math.min(5, c.n | 0 || 1), c.s | 0]; } return o; };
  // 時刻の順に、確かめる（getRec：sh_drec を読む関数。読めなかったら null）
  //  返り値：{ more：まだ残りがある }
  V.advance = async function (lv, st, raw, items, getRec, ctx, opt) {
    opt = opt || {};
    const until = Date.now() + (opt.ms || 6000);
    let i = 0;
    while (i < items.length) {
      let part = items.slice(i, i + 200);
      const present = V.presentOf(st, raw);
      const need = part.filter(d => !present[d.p] && (st.bad[d.u] || 0) < 3 && d.r === undefined && !d._got);
      const miss = new Set();
      for (let j = 0; j < need.length; j += 24) await Promise.all(need.slice(j, j + 24).map(d => getRec(d.id).then(x => { d._got = 1; if (x && typeof x === 'object') { d.r = x.r; d.c = x.c; d.k = x.k; } }).catch(() => miss.add(d.id))));
      if (miss.size) { const cut = part.findIndex(d => miss.has(d.id)); part = part.slice(0, cut); if (!part.length) break; }
      // 屍の種族は、データベースの場所の記録（最初に作った人）を使う
      for (const d of part) { const c = raw[d.p]; d.cs = c ? (c.s | 0) : (d.s | 0); d.n = c ? Math.min(5, c.n | 0) : 1; }
      const res = opt.run ? await opt.run(lv, part, present, st.bad, 120 * 60 * 20, ctx) : V.verifyDeaths(lv, part, present, st.bad, 120 * 60 * 20, ctx);
      if (!res || !(res.done >= 0)) break;
      const added = new Set(res.add);
      for (const u in res.badInc) st.bad[u] = (st.bad[u] || 0) + res.badInc[u];
      for (let j = 0; j < res.done; j++) {
        const d = part[j];
        if (st.P[d.p] || added.has(d.p)) st.P[d.p] = (st.P[d.p] || 0) + 1;
        if (d.t !== st.t) { st.t = d.t; st.ti = []; } st.ti.push(d.id);
      }
      i += res.done;
      if (opt.save) opt.save(st);
      if (miss.size || res.done === 0 || Date.now() > until) break;
    }
    return { more: i < items.length, rest: items.slice(i) };
  };
  // 新しい記録だけにしぼる（前に確かめた所より後）
  V.newItems = (st, v) => Object.entries(v || {}).map(([id, d]) => Object.assign({ id }, d)).filter(d => d && d.v === 1 && typeof d.t === 'number' && (d.t > st.t || (d.t === st.t && !st.ti.includes(d.id))) && typeof d.p === 'string' && typeof d.u === 'string').sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1));
  // 見せる屍：確かめた屍 ＋ まだ確かめていない屍（だめな記録の多いIDの分は見せない）
  V.shown = (st, raw, rest) => {
    const out = new Map();
    const put = k => { const c = raw[k]; if (c && !out.has(+k)) out.set(+k, { n: Math.min(5, c.n | 0 || 1), s: c.s | 0, name: String(c.l || '名無し').slice(0, 12), t: c.t || 0, nAll: c.n | 0 }); };
    for (const k in st.P) put(k);
    for (const d of rest || []) if ((st.bad[d.u] || 0) < 3) put(d.p);
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
