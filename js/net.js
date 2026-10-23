// =============================================
//  Fairies' Tower  みんなとつながる（陣営ごとに別の Firebase Realtime Database）
//
//  データの形（どの陣営のデータベースも同じ）
//   ft_cells/{層}/{場所}  : { n：その屍に眠る人数, s：最初に作った人の種族, l：最初に作った人の名前, t：時刻, g：記録の番号 }
//   ft_dlog/{層}/{番号}   : { p：場所, u：匿名ID, t, v：1, s：種族, b：追い上げ }     だれがどこに屍を置いたか（軽い）
//   ft_drec/{層}/{番号}   : { r：操作の記録, c：始まりの屍, k：死ぬまでの時間 }       再生用（重いので要る分だけ読む）
//   ft_stat/{層}          : { d：死んだ数, c：越えた数, m：一番上まで行った割合（0〜1000） }
//   ft_clear/{層}/{番号}  : { n：名前, x：XのID, t, r, c, k, u, s, b }               越えた記録
//   ft_open/{層}          : { t, n, x, id, u }   その層をはじめて越えた（次の層が開いた）
//   ft_end                : { t, w：勝った陣営 }   ゲームの終わり（管理人が入れる。入ると書きこめなくなる）
//   ft_u/{匿名ID}          : { c：最後に死んだ時刻, k：最後に越えた時刻, w/{層}：越えた記録の数（3まで） }
//   ft_rm/{層}・ft_reset/{層} : { t }   管理人が屍を取り除いた・層を消した時刻
//   ft_help/{層}/{場所}   : その屍が、あとから来た人の足場になった数（1回の挑戦で1つの屍につき1）
//   ft_board/{番号}       : 陣営の掲示板 { n：名前, m：文, t, u, s：種族, l：言葉, f：いちばん高く昇った層 }   ft_pin：管理人のお知らせ
//   ft_gboard/{番号}      : 全体の掲示板（緑のデータベースに置く。a：陣営）   ft_gpin：全体のお知らせ
//   ft_ckpt               : 管理人が「ここまでは本物」と確かめた層
//   ft_admin/key・ft_admins/{匿名ID} : 管理のかぎ
//
//  通信を減らす工夫
//   ・常時接続を使わない（同時接続の上限にかからない）
//   ・死んだ記録は、まとめて送る（最大6人分・8秒ごと）
//   ・GitHub に置いた「まとめ」（data/snap/）を先に読み、データベースからは、それより新しい分だけ読む
//   ・書きこみの返事を空にする（print=silent）
// =============================================
(function (G) {
  const FT = G.FT, V = FT.V;
  const N = FT.NET = {};
  const late = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = (k, v) => { try { if (typeof localStorage === 'undefined') return null; if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  N.store = store;
  N.FACS = ['g', 'r', 'b'];
  N.fac = 'g'; N.frozen = false;
  const cfg = f => (G.FT_CONFIG && G.FT_CONFIG[f || N.fac]) || null;
  N.ready = f => { const c = cfg(f); return !!(c && c.apiKey && c.databaseURL && !/ここに/.test(c.apiKey)); };
  const DB = f => cfg(f).databaseURL.replace(/\/$/, '');
  const NS = f => cfg(f).ns ? '&ns=' + cfg(f).ns : '';
  // ---------- 名乗り（匿名。陣営ごとに別のID） ----------
  const AUTH = G.FT_AUTHURL || { up: 'https://identitytoolkit.googleapis.com/v1/accounts:signUp', ref: 'https://securetoken.googleapis.com/v1/token' };
  const tk = {};
  async function signIn(f) {
    const key = cfg(f).apiKey, sk = 'ft_auth_' + f, saved = store(sk), T = tk[f];
    if (saved && saved.rt) {
      const r = await Promise.race([fetch(AUTH.ref + '?key=' + key, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(saved.rt) }), late(12000)]);
      if (r.ok) { const j = await r.json(); T.tok = j.id_token; T.exp = Date.now() + (Math.max(300, +j.expires_in || 3600) - 240) * 1000; T.uid = j.user_id; store(sk, { rt: j.refresh_token, uid: j.user_id }); return T.tok; }
      if (r.status !== 400 && r.status !== 403) throw new Error('auth ' + r.status);
      store(sk, { rt: '' });
    }
    const r = await Promise.race([fetch(AUTH.up + '?key=' + key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' }), late(12000)]);
    if (!r.ok) throw new Error('auth ' + r.status);
    const j = await r.json(); T.tok = j.idToken; T.exp = Date.now() + (Math.max(300, +j.expiresIn || 3600) - 240) * 1000; T.uid = j.localId;
    store(sk, { rt: j.refreshToken, uid: j.localId });
    return T.tok;
  }
  N.token = function (force, f) {
    f = f || N.fac; const T = tk[f] = tk[f] || {};
    if (!force && T.tok && Date.now() < T.exp) return Promise.resolve(T.tok);
    if (!T.p) T.p = signIn(f).finally(() => { T.p = null; });
    return T.p;
  };
  N.uid = f => (tk[f || N.fac] || {}).uid || null;
  N.warm = () => { if (N.ready()) N.token().catch(() => { }); };
  // ---------- 通信 ----------
  async function rest(path, q, f) {
    const qs = q ? '?' + Object.entries(q).map(([k, v]) => k + '=' + encodeURIComponent(/^(limitTo|shallow)/.test(k) ? String(v) : JSON.stringify(v))).join('&') : '';
    const r = await Promise.race([fetch(DB(f) + '/' + path + '.json' + (qs || (NS(f) ? '?' : '')) + (qs ? NS(f) : NS(f).slice(1)), { cache: 'no-store' }), late(12000)]);
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }
  N.rest = rest;
  async function restWrite(method, path, val, f) {
    for (let i = 0; ; i++) {
      const t = await N.token(i > 0, f);
      const r = await Promise.race([fetch(DB(f) + '/' + path + '.json?print=silent&auth=' + encodeURIComponent(t) + NS(f), { method, body: JSON.stringify(val), cache: 'no-store' }), late(12000)]);
      if (r.ok) return null;
      const txt = await r.text().catch(() => '');
      if (i === 0 && r.status === 401 && /token|auth/i.test(txt) && !/permission/i.test(txt)) continue;
      const e = new Error('http ' + r.status); if (r.status === 401 || r.status === 403) e.code = 'PERMISSION_DENIED'; else if (r.status === 400) e.code = 'BAD_REQUEST'; throw e;
    }
  }
  N.restWrite = restWrite;
  async function restMe(path, f) { const t = await N.token(false, f); const r = await Promise.race([fetch(DB(f) + '/' + path + '.json?auth=' + encodeURIComponent(t) + NS(f), { cache: 'no-store' }), late(12000)]); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }
  const update = (val, f) => restWrite('PATCH', '', val, f);
  N.update = update;
  const SV = { '.sv': 'timestamp' }, INC = n => ({ '.sv': { increment: n || 1 } });
  const perm = e => e && (e.code === 'PERMISSION_DENIED' || e.code === 'BAD_REQUEST');
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // 番号：時刻＋つづき番号＋でたらめ（同じ時刻にまとめて送っても、作った順に並ぶ）
  let seqN = 0;
  const pid = () => { let s = Date.now().toString(36) + (seqN++ % 1296).toString(36).padStart(2, '0'); for (let i = 0; i < 9; i++) s += AZ[Math.floor(Math.random() * AZ.length)]; return s; };
  N.pid = pid;
  N.now = () => Date.now();
  N.cleanName = s => String(s || '').replace(/[<>&"'\\\/.#$\[\]\n\r\t]/g, '').slice(0, 12);
  N.cleanX = s => { s = String(s || '').trim().replace(/^@/, ''); return /^[A-Za-z0-9_]{1,15}$/.test(s) ? s : ''; };
  // ---------- GitHub のまとめ ----------
  N.SNAP = (G.FT_SNAPBASE !== undefined ? G.FT_SNAPBASE : 'data/snap/');
  const snapIdx = {};
  N.snapIndex = async function (f) {
    f = f || N.fac;
    if (snapIdx[f] && Date.now() - snapIdx[f].at < 300000) return snapIdx[f].v;
    let v = null; try { const r = await Promise.race([fetch(N.SNAP + f + '/index.json?t=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' }), late(10000)]); if (r.ok) v = await r.json(); } catch (e) { v = null; }
    snapIdx[f] = { at: Date.now(), v }; return v;
  };
  async function snapFloor(f, idx) {
    if (!idx || !idx.floors || !idx.floors[f]) return null;
    try { const r = await Promise.race([fetch(N.SNAP + N.fac + '/f' + f + '.json?v=' + idx.floors[f], { cache: 'force-cache' }), late(15000)]); if (r.ok) return await r.json(); } catch (e) { }
    return null;
  }
  // =============================================
  //  全体：自分の陣営の開いた層と、3陣営の高さ
  // =============================================
  N.overview = async function () {
    const out = { tops: {}, ends: {}, open: {}, stat: {}, ckpt: null, okSnap: {}, snapAt: 0 };
    const idx = await N.snapIndex();
    // ゲームが終わったあとは、まとめだけを読む（データベースは読まない）
    N.frozen = !!(idx && idx.end);
    if (N.frozen) { out.open = idx.open || {}; out.stat = idx.stat || {}; out.okSnap = idx.ok || {}; out.ckpt = idx.ckpt; out.tops = Object.assign({}, idx.vtops || idx.tops || {}); out.ends = { [idx.end.w]: idx.end }; out.snapAt = idx.at; return out; }
    if (idx) { out.open = idx.open || {}; out.stat = idx.stat || {}; out.okSnap = idx.ok || {}; out.snapAt = idx.at || 0; out.ckpt = idx.ckpt == null ? null : idx.ckpt; }
    // 3つの陣営の高さ：GitHub のまとめで確かめ済みの高さだけを使う（にせの「開いた」で高く見せられないように）
    //  自分の陣営は、この端末で確かめた分も足す（main.js）。終わりの印だけはデータベースから読む（とても軽い）
    const jobs = N.FACS.map(async F => {
      const ix = F === N.fac ? idx : await N.snapIndex(F);
      out.tops[F] = ix && ix.vtop >= 1 ? ix.vtop : 1;
      if (!N.ready(F)) return;
      const end = await rest('ft_end', null, F).catch(() => null);
      if (end && typeof end === 'object') out.ends[F] = end;
    });
    // 自分の陣営：確かめる前の「開いた」の一番上（下から順に確かめるために使う。見せる高さには使わない）
    const own = N.ready() ? rest('ft_open', { shallow: true }).catch(() => null) : Promise.resolve(null);
    await Promise.all(jobs);
    const op = await own; out.rawTop = 1;
    if (op && typeof op === 'object') { let m = 0; for (const k in op) if (+k > m && +k <= 100) m = +k; out.rawTop = Math.min(101, m + 1); }
    if (N.ready()) {
      // まとめより上の「開いた」だけ読む
      const top = out.rawTop || 1, from = Math.max(1, Math.min(top, Object.keys(out.okSnap).length ? Math.max(...Object.keys(out.okSnap).map(Number)) : 0));
      const ck = await rest('ft_ckpt').catch(() => null); if (typeof ck === 'number') out.ckpt = ck;
      const need = []; for (let f = from; f < top && f <= 100; f++) if (!out.okSnap[f]) need.push(f);
      if (top >= 100) need.push(100);
      await Promise.all(need.slice(0, 30).map(f => rest('ft_open/' + f).then(v => { if (v && typeof v === 'object') out.open[f] = v; }).catch(() => { })));
    }
    return out;
  };
  N.floorStat = f => rest('ft_stat/' + f);
  // =============================================
  //  屍を読む（まとめ＋新しい分。確かめた屍と、確かめ中の屍）
  // =============================================
  const DV = () => store('ft_dv_' + N.fac) || {};
  function dvSave(f, st) { const o = DV(); o[f] = st; for (const k of Object.keys(o)) if (Math.abs(+k - f) > 3) delete o[k]; store('ft_dv_' + N.fac, o); }
  N.ctx = { maxB: 0, door: false };   // 追い上げの上限・頂上の扉（main.js が層ごとに lv._ctx に入れる）
  const ctxOf = lv => lv._ctx || N.ctx;
  let worker = null, wid = 0; const wcb = {};
  function getWorker() {
    if (worker !== null) return worker;
    try { if (typeof Worker === 'undefined' || typeof document === 'undefined') return (worker = false); worker = new Worker('js/worker.js?v=' + (FT.VER || '0')); worker.onmessage = ev => { const f = wcb[ev.data.id]; if (f) { delete wcb[ev.data.id]; f(ev.data); } }; worker.onerror = () => { worker = false; for (const k in wcb) { const f = wcb[k]; delete wcb[k]; f({ err: 1 }); } }; } catch (e) { worker = false; }
    return worker;
  }
  function inWorker(type, payload, sync) {
    const w = getWorker(); if (!w) return Promise.resolve(sync());
    return new Promise(res => { const id = ++wid, tm = setTimeout(() => { if (wcb[id]) { delete wcb[id]; res(sync()); } }, 120000); wcb[id] = d => { clearTimeout(tm); res(d.err ? sync() : d.res); }; try { w.postMessage(Object.assign({ type, id }, payload)); } catch (e) { clearTimeout(tm); delete wcb[id]; res(sync()); } });
  }
  const plainLv = lv => ({ f: lv.f, h: lv.h, br: lv.br, sp: lv.sp, fj: lv.fj, mo: lv.mo, fr: lv.fr, tn: lv.tn, wa: lv.wa, dk: lv.dk, door: lv.door });
  N.plainLv = plainLv;
  const runDeaths = (lv, items, present, bad, budget, ctx) => inWorker('deaths', { lv: plainLv(lv), items: items.map(d => ({ id: d.id, p: d.p, u: d.u, t: d.t, s: d.s, b: d.b, r: d.r, c: d.c, k: d.k, cs: d.cs, n: d.n })), present, bad, budget, ctx }, () => V.verifyDeaths(lv, items, present, bad, budget, ctx));
  N.verifyClearAsync = (lv, c, present, ctx) => inWorker('clear', { lv: plainLv(lv), c: { t: c.t, r: c.r, c: c.c, k: c.k, s: c.s, b: c.b }, present, ctx }, () => V.verifyClear(lv, c, present, ctx));
  // 1つの層の屍の状態（lv._F に置く）
  async function floorState(lv) {
    const f = lv.f;
    if (lv._F) return lv._F;
    const F = { raw: {}, maxT: 0, st: null, rmKey: '', fullAt: 0, rest: [] };
    // 屍を取り除いた・層を消した合図
    const [rm, rs] = N.ready() && !N.frozen ? await Promise.all([rest('ft_rm/' + f + '/t').catch(() => null), rest('ft_reset/' + f + '/t').catch(() => null)]) : [null, null];
    F.rmKey = (rm || 0) + '_' + (rs || 0); F.rmT = Math.max(rm || 0, rs || 0); F.rmAt = Date.now();
    const idx = await N.snapIndex(), sn = await snapFloor(f, idx);
    const c = DV()[f];
    if (sn && sn.at > F.rmT) { F.raw = sn.raw || {}; F.maxT = Math.max(0, (sn.at || 0) - 120000); F.st = sn.st || V.newState(); }
    else F.st = V.newState();
    if (c && c.key === F.rmKey && c.st && c.st.t >= F.st.t) F.st = c.st;   // この端末で確かめた所の方が先なら、そこから
    // データベースから：まとめより新しい屍（まとめがなければ全部）
    if (N.ready() && !N.frozen) {
      const v = F.maxT ? await rest('ft_cells/' + f, { orderBy: 't', startAt: F.maxT }) : await rest('ft_cells/' + f);
      for (const k in v || {}) if (v[k]) F.raw[k] = v[k];
      F.fullAt = Date.now();
    }
    for (const k in F.raw) if (F.raw[k] && F.raw[k].t > F.maxT) F.maxT = F.raw[k].t;
    lv._F = F; return F;
  }
  // 確かめを進めて、見せる屍を返す
  async function trust(lv, ms) {
    const F = await floorState(lv), f = lv.f;
    if (!N.ready() || N.frozen) return V.shown(F.st, F.raw, []);
    if (Date.now() - F.rmAt > 300000) {   // 取り除きの合図は5分に1回
      F.rmAt = Date.now();
      const [rm, rs] = await Promise.all([rest('ft_rm/' + f + '/t').catch(() => null), rest('ft_reset/' + f + '/t').catch(() => null)]);
      const key = (rm || 0) + '_' + (rs || 0); if (key !== F.rmKey) { lv._F = null; return trust(lv, ms); }
    }
    // 前に読んでから時間がたっていれば、新しい屍だけ読みたす（同じ層に入りなおしたとき、増えた屍が見えないままにならないように）
    if (Date.now() - F.fullAt > 3000) {
      try { const v = await rest('ft_cells/' + f, { orderBy: 't', startAt: F.maxT + 1 }); for (const k in v || {}) { if (!v[k]) continue; F.raw[k] = v[k]; if (v[k].t > F.maxT) F.maxT = v[k].t; } F.fullAt = Date.now(); } catch (e) { }
    }
    let items = null;
    try { items = V.newItems(F.st, await rest('ft_dlog/' + f, { orderBy: 't', startAt: F.st.t })); } catch (e) { items = null; }
    if (!items) { F.more = true; return V.shown(F.st, F.raw, F.rest); }
    const res = await V.advance(lv, F.st, F.raw, items, id => rest('ft_drec/' + f + '/' + id), ctxOf(lv), { ms, run: runDeaths, save: st => dvSave(f, { key: F.rmKey, st }) });
    F.rest = res.rest; F.more = res.more;
    return V.shown(F.st, F.raw, F.rest);
  }
  N.trust = (lv, ms) => { const p = (lv._tp || Promise.resolve()).catch(() => { }).then(() => trust(lv, ms)); lv._tp = p; return p; };
  N.loadCells = lv => N.trust(lv, 8000);
  // 新しい屍だけ読みなおす（20秒に1回まで）
  N.syncCells = async function (lv, mine) {
    const F = await floorState(lv);
    if (N.ready() && !N.frozen) {
      try { const v = await rest('ft_cells/' + lv.f, { orderBy: 't', startAt: F.maxT + 1 }); for (const k in v || {}) { if (!v[k]) continue; F.raw[k] = v[k]; if (v[k].t > F.maxT) F.maxT = v[k].t; } } catch (e) { }
    }
    // 遊んでいる間は、新しい屍の「場所」だけ見せる（再生しての確かめは、層に入るときと GitHub のまとめで行う。通信を大きく減らすため）
    const m = V.shown(F.st, F.raw, F.rest);
    for (const k in F.raw) { const c = F.raw[k]; if (c && !m.has(+k) && c.t > (F.st.t || 0) - 1) m.set(+k, { n: Math.min(5, c.n | 0 || 1), s: c.s | 0, name: String(c.l || '名無し').slice(0, 12), t: c.t || 0, nAll: c.n | 0 }); }
    for (const [k, c] of mine || []) if (!m.has(k)) m.set(k, c);   // 自分の屍で、まだ届いていないもの
    return m;
  };
  N.present = lv => lv._F ? V.presentOf(lv._F.st, lv._F.raw) : {};
  N.more = lv => !!(lv._F && lv._F.more);
  // =============================================
  //  死んだ：まとめて送る
  // =============================================
  const Q = []; let qT = 0, qBusy = false, lastC = 0;
  N.pending = () => Q.length;
  N.died = function (e) {   // e：{ f, k, merge, s, name, rec, cor, ticks, b, m（割合）}
    if (!N.ready()) return Promise.resolve(false);
    return new Promise((res, rej) => { e.res = res; e.rej = rej; Q.push(e); if (!qT) qT = setTimeout(flush, 8000); if (Q.length >= 6) { clearTimeout(qT); qT = 0; flush(); } });
  };
  N.flush = () => { if (qT) { clearTimeout(qT); qT = 0; } return flush(); };
  async function flush() {
    qT = 0; if (qBusy || !Q.length) return; qBusy = true;
    try {
      const wait = lastC + 800 - Date.now(); if (wait > 0) await sleep(wait);
      await N.token();
      const uid = N.uid(), batch = [], seen = new Set();
      for (const e of Q) { if (batch.length >= 6) break; const key = e.f + ':' + e.k; if (e.k >= 0 && seen.has(key)) continue; seen.add(key); batch.push(e); }
      const w = { ['ft_u/' + uid + '/c']: SV }, per = {};
      for (const e of batch) {
        per[e.f] = per[e.f] || { d: 0, m: 0 }; per[e.f].d++; per[e.f].m = Math.max(per[e.f].m, e.m | 0);
        for (const hk of (e.help || []).slice(0, 20)) w['ft_help/' + e.f + '/' + hk] = INC();
        if (e.k < 0) continue;
        const g = pid(), cp = 'ft_cells/' + e.f + '/' + e.k;
        if (e.merge && !e.asNew) { w[cp + '/n'] = INC(); w[cp + '/t'] = SV; w[cp + '/g'] = g; }
        else w[cp] = { n: INC(), s: e.s | 0, l: N.cleanName(e.name) || '名無し', t: SV, g };
        w['ft_dlog/' + e.f + '/' + g] = { p: String(e.k), u: uid, t: SV, v: 1, s: e.s | 0, b: e.b | 0 };
        w['ft_drec/' + e.f + '/' + g] = { r: String(e.rec || '').slice(0, 30000), c: String(e.cor || '').slice(0, 30000), k: Math.max(1, e.ticks | 0) };
      }
      for (const f in per) { w['ft_stat/' + f + '/d'] = INC(per[f].d); if (per[f].m > (N.mKnown[f] || 0)) w['ft_stat/' + f + '/m'] = Math.min(1000, per[f].m); }
      let ok = false, err = null;
      for (let i = 0; i < 4 && !ok; i++) {
        try { await update(w); ok = true; }
        catch (e) {
          err = e; if (!perm(e)) break;
          // 断られた：新しい屍のつもりが、もうほかの人が作っていた → 合流として送りなおす。一番上の割合も外す
          await Promise.all(batch.filter(e2 => e2.k >= 0 && w['ft_cells/' + e2.f + '/' + e2.k]).map(async e2 => { const cp = 'ft_cells/' + e2.f + '/' + e2.k, v = w[cp]; const ex = await rest(cp + '/n').catch(() => null); if (typeof ex === 'number') { delete w[cp]; w[cp + '/n'] = INC(); w[cp + '/t'] = SV; w[cp + '/g'] = v.g; } }));
          // 合流のつもりが、その屍がもうない（管理人が取り除いた）→ 新しい屍として送る
          await Promise.all(batch.filter(e2 => e2.k >= 0 && w['ft_cells/' + e2.f + '/' + e2.k + '/n']).map(async e2 => { const cp = 'ft_cells/' + e2.f + '/' + e2.k; const ex = await rest(cp + '/n').catch(() => 1); if (ex === null) { const g = w[cp + '/g']; delete w[cp + '/n']; delete w[cp + '/t']; delete w[cp + '/g']; w[cp] = { n: INC(), s: e2.s | 0, l: N.cleanName(e2.name) || '名無し', t: SV, g }; } }));
          for (const f in per) delete w['ft_stat/' + f + '/m'];
          for (const k in w) if (k.startsWith('ft_help/')) delete w[k];   // 足場の数は、送れなくてもよい
          await sleep(900 + Math.random() * 600);
          w['ft_u/' + uid + '/c'] = SV;
        }
      }
      lastC = Date.now();
      for (const e of batch) { Q.splice(Q.indexOf(e), 1); if (ok) e.res(true); else e.rej(err || new Error('send')); }
      if (ok) for (const f in per) N.mKnown[f] = Math.max(N.mKnown[f] || 0, per[f].m);
    } catch (e) {
      for (const x of Q.splice(0, Math.min(Q.length, 6))) x.rej(e);
    } finally { qBusy = false; if (Q.length) qT = setTimeout(flush, 1000); }
  }
  N.mKnown = {};
  // =============================================
  //  越えた
  // =============================================
  let lastK = 0;
  N.clear = async function (lv, o) {   // o：{ name, rec, cor, ticks, s, b, full }
    const f = lv.f; await N.flush().catch(() => { });
    const wait = lastK + 4300 - Date.now(); if (wait > 0) await sleep(wait);
    await N.token(); const uid = N.uid();
    for (let i = 0; i < 5; i++) {
      const [op, wn] = await Promise.all([rest('ft_open/' + f).catch(() => null), o.full ? restMe('ft_u/' + uid + '/w/' + f).catch(() => null) : null]);
      let full = o.full && !(+wn >= 3);
      const w = { ['ft_u/' + uid + '/k']: SV, ['ft_stat/' + f + '/c']: INC(), ['ft_stat/' + f + '/m']: 1000 };
      let id = null, opened = false;
      if (full) {
        id = pid(); w['ft_clear/' + f + '/' + id] = { n: N.cleanName(o.name) || '名無し', x: '', t: SV, r: o.rec, c: o.cor, k: o.ticks, u: uid, s: o.s | 0, b: o.b | 0 };
        w['ft_u/' + uid + '/w/' + f] = (+wn || 0) + 1;
        if (!op) { w['ft_open/' + f] = { t: SV, n: N.cleanName(o.name) || '名無し', x: '', id, u: uid }; opened = true; }
      }
      if (i === 0) for (const hk of (o.help || []).slice(0, 20)) w['ft_help/' + f + '/' + hk] = INC();
      try { await update(w); lastK = Date.now(); return { id, opened }; }
      catch (e) { lastK = Date.now(); if (!perm(e)) throw e; await sleep(4400 + Math.random() * 800); }
    }
    throw new Error('混みあっています');
  };
  N.setXid = async function (f, id, xid, open) {
    const jobs = [update({ ['ft_clear/' + f + '/' + id + '/x']: xid })];
    if (open) jobs.push(update({ ['ft_open/' + f + '/x']: xid }));
    const r = await Promise.allSettled(jobs); if (r[0].status !== 'fulfilled') throw r[0].reason;
  };
  // その層を本当に越えた一番早い記録（古い順に確かめる。にせだった所は覚えておく）
  const VC = () => store('ft_vc_' + N.fac) || {};
  N.firstClear = async function (lv) {
    const f = lv.f;
    if (N.more(lv)) return { wait: true };   // 屍の確かめが途中なら、少しあとで
    const F = lv._F, rs = F ? F.rmKey : '';
    const vc = VC(); let cur = vc[f] && vc[f].rs === rs ? vc[f].t : 0;
    let budget = 120 * 60 * 120;
    const present = N.present(lv);
    for (let page = 0; page < 30; page++) {
      const v = await rest('ft_clear/' + f, { orderBy: 't', startAt: cur + 1, limitToFirst: 10 });
      const list = Object.entries(v || {}).map(([id, c]) => Object.assign({ id }, c)).filter(c => typeof c.t === 'number' && c.t > cur).sort((a, b) => a.t - b.t);
      if (!list.length) return null;
      for (const c of list) {
        if (budget <= 0) return { wait: true };
        budget -= Math.min(120 * 60 * 10, Math.max(1, c.k | 0));
        if (await N.verifyClearAsync(lv, c, present, ctxOf(lv))) return c;
        cur = c.t; const o = VC(); o[f] = { t: cur, rs }; store('ft_vc_' + N.fac, o);
      }
      if (list.length < 10) return null;
    }
    return { wait: true };
  };
  // 頂の碑（第100層を越えた人）
  N.summit = async function () { const v = await rest('ft_clear/100', { orderBy: 't', limitToFirst: 300 }).catch(() => null); return Object.values(v || {}).filter(c => c && c.n).sort((a, b) => a.t - b.t).map(c => ({ n: N.cleanName(c.n) || '名無し', x: N.cleanX(c.x), t: c.t })); };
  // =============================================
  //  管理（管理のかぎを、この端末の匿名IDに登録してから）
  // =============================================
  // ---------- 配信中の人（ft_live/{id}：{ n：名前, u：配信のURL, m：ひとこと, t }。緑のデータベースに置く。書けるのは管理人だけ） ----------
  const liveTxt = (s, n) => String(s || '').replace(/[<>&"'\\\n\r\t]/g, '').trim().slice(0, n);
  const liveUrl = s => { s = String(s || '').trim(); return /^https:\/\/[^\s<>"']{3,300}$/.test(s) ? s : ''; };
  N.liveUrl = liveUrl;
  N.live = async function () {
    if (!N.ready('g')) return [];
    const v = await rest('ft_live', null, 'g') || {};
    return Object.entries(v).filter(([, x]) => x && typeof x === 'object').map(([id, x]) => ({ id, n: liveTxt(x.n, 20), u: liveUrl(x.u), m: liveTxt(x.m, 30), t: +x.t || 0 }))
      .filter(x => x.n && x.u).sort((a, b) => b.t - a.t).slice(0, 10);
  };
  N.liveAdd = async function (n, u, m) { n = liveTxt(n, 20); u = liveUrl(u); m = liveTxt(m, 30); if (!n || !u) throw new Error('名前とURL（https://）を入れてください'); await restWrite('PUT', 'ft_live/' + pid(), { n, u, m, t: SV }, 'g'); };
  N.liveDel = id => update({ ['ft_live/' + id]: null }, 'g');
  N.adminLogin = async function (key, f) { await N.token(false, f); await restWrite('PUT', 'ft_admins/' + N.uid(f), String(key), f); return N.uid(f); };
  N.resetFloor = (f, F) => update({ ['ft_cells/' + f]: null, ['ft_dlog/' + f]: null, ['ft_drec/' + f]: null, ['ft_help/' + f]: null, ['ft_rm/' + f]: { t: SV }, ['ft_reset/' + f]: { t: SV } }, F);
  // 自分の屍が、何人の足場になったか（list：[{ a：陣営, f：層, k：場所 }]）。陣営ごとのデータベースから、1つずつ読む（軽い）
  N.helpOf = async function (list) {
    const out = new Map();
    await Promise.all(list.filter(o => N.ready(o.a)).map(o => rest('ft_help/' + o.f + '/' + o.k, null, o.a).then(v => { out.set(o.a + ':' + o.f + ':' + o.k, typeof v === 'number' ? v : 0); }).catch(() => { })));
    return out;
  };
  // ---------- 掲示板 ----------
  //  kind：'fac'（自分の陣営）・'all'（全体。緑のデータベース）
  const BDB = kind => kind === 'all' ? 'g' : N.fac, BPATH = kind => kind === 'all' ? 'ft_gboard' : 'ft_board', BPIN = kind => kind === 'all' ? 'ft_gpin' : 'ft_pin';
  N.boardReady = kind => N.ready(BDB(kind));
  N.boardRead = async function (kind, since) {
    const v = since ? await rest(BPATH(kind), { orderBy: 't', startAt: since + 1, limitToFirst: 60 }, BDB(kind)) : await rest(BPATH(kind), { orderBy: 't', limitToLast: 40 }, BDB(kind));
    return Object.entries(v || {}).map(([id, c]) => Object.assign({ id }, c)).filter(c => c && typeof c.m === 'string' && typeof c.t === 'number').sort((a, b) => a.t - b.t);
  };
  N.boardPin = kind => rest(BPIN(kind), null, BDB(kind)).catch(() => null);
  N.boardLast = kind => rest(BPATH(kind), { orderBy: 't', limitToLast: 1 }, BDB(kind)).then(v => { let t = 0; for (const k in v || {}) if (v[k] && v[k].t > t) t = v[k].t; return t; }).catch(() => 0);
  N.boardPost = async function (kind, o) {   // o：{ n, m, s, l, f }
    const F = BDB(kind); await N.token(false, F); const uid = N.uid(F), id = pid();
    const post = { n: N.cleanName(o.n) || '名無し', m: String(o.m).slice(0, 120), t: SV, u: uid, s: o.s | 0, l: o.l, f: Math.max(0, Math.min(101, o.f | 0)) };
    if (kind === 'all') post.a = N.fac;
    await update({ ['ft_u/' + uid + '/p']: SV, [BPATH(kind) + '/' + id]: post }, F);
    return id;
  };
  N.boardReport = async function (kind, id) {
    const F = BDB(kind); await N.token(false, F); const uid = N.uid(F);
    await update({ [BPATH(kind) + '_r/' + id + '/' + uid]: true, [BPATH(kind) + '/' + id + '/r']: INC() }, F);
  };
  N.boardDel = (kind, id, F) => update({ [BPATH(kind) + '/' + id]: null }, F || BDB(kind));
  N.boardSetPin = (kind, text, F) => restWrite('PUT', BPIN(kind), String(text || ''), F || BDB(kind));
  N.boardUid = kind => N.uid(BDB(kind));
  N.setCkpt = (f, F) => restWrite('PUT', 'ft_ckpt', f, F);
  N.setEnd = (w, F) => restWrite('PUT', 'ft_end', { t: SV, w }, F);
  N.dlog = async function (f, F) {
    const v = await rest('ft_dlog/' + f, null, F) || {}, by = new Map();
    for (const id in v) { const d = v[id]; if (!d || typeof d.u !== 'string') continue; const g = by.get(d.u) || { u: d.u, n: 0, first: Infinity, last: 0, ids: [], ps: [] }; g.n++; g.first = Math.min(g.first, d.t || 0); g.last = Math.max(g.last, d.t || 0); g.ids.push(id); g.ps.push(d.p); by.set(d.u, g); }
    return [...by.values()].sort((a, b) => b.n - a.n);
  };
  N.removeBy = async function (f, g, F) {
    const cells = await rest('ft_cells/' + f, null, F) || {}, dec = {}, w = {};
    for (const p of g.ps) dec[p] = (dec[p] || 0) + 1;
    for (const p in dec) { const c = cells[p]; if (!c) continue; const n = (c.n | 0) - dec[p]; w['ft_cells/' + f + '/' + p] = n >= 1 ? Object.assign({}, c, { n }) : null; }
    for (const id of g.ids) { w['ft_dlog/' + f + '/' + id] = null; w['ft_drec/' + f + '/' + id] = null; }
    w['ft_rm/' + f] = { t: SV };
    const keys = Object.keys(w); for (let i = 0; i < keys.length; i += 400) { const part = {}; for (const k of keys.slice(i, i + 400)) part[k] = w[k]; await update(part, F); }
    return Object.keys(dec).length;
  };
  N.purge = async function (f, ids, openToo, F) {
    const w = {}; for (const id of ids) w['ft_clear/' + f + '/' + id] = null;
    if (openToo) w['ft_open/' + f] = null;
    if (Object.keys(w).length) await update(w, F);
  };
  // 碑の名前を消す（ふさわしくない名前）
  N.blankName = async function (f, id, F) {
    const w = {}; if (id) w['ft_clear/' + f + '/' + id + '/n'] = '名無し';
    const op = await rest('ft_open/' + f, null, F).catch(() => null); if (op && (!id || op.id === id)) { w['ft_open/' + f + '/n'] = '名無し'; w['ft_open/' + f + '/x'] = ''; }
    if (id) w['ft_clear/' + f + '/' + id + '/x'] = '';
    if (Object.keys(w).length) await update(w, F);
  };
})(typeof window !== 'undefined' ? window : globalThis);
