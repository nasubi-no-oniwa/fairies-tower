// 通しのテスト：テスト用の Firebase のまね（fakefb.js）に、何人かの端末をつないで動かす
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = 9300 + Math.floor(Math.random() * 500);
const SNAPDIR = fs.mkdtempSync('/tmp/ftsnap');
const srv = cp.spawn(process.execPath, [path.join(__dirname, 'fakefb.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: Object.assign({}, process.env, { FAKE_STATIC: SNAPDIR }) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const floors = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/floors.json')));
const CFG = { g: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'g' }, r: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'r' }, b: { apiKey: 'test', databaseURL: `http://127.0.0.1:${PORT}`, ns: 'b' } };
function client(name, snap) {
  const mem = {};
  const ctx = { console, Math, Map, Set, Array, Object, JSON, Number, String, Promise, Error, Date, URL, URLSearchParams, encodeURIComponent, decodeURIComponent, Infinity, isNaN, parseInt, Float64Array, Int16Array, Uint8Array, setTimeout, clearTimeout, fetch,
    localStorage: { getItem: k => mem[k] === undefined ? null : mem[k], setItem: (k, v) => { mem[k] = String(v); } } };
  ctx.globalThis = ctx; ctx.window = ctx;
  ctx.FT_CONFIG = CFG; ctx.FT_AUTHURL = { up: `http://127.0.0.1:${PORT}/auth/up`, ref: `http://127.0.0.1:${PORT}/auth/ref` }; ctx.FT_SNAPBASE = snap ? `http://127.0.0.1:${PORT}/static/` : `http://127.0.0.1:${PORT}/nosnap/`;
  vm.createContext(ctx);
  for (const f of ['engine.js', 'verify.js', 'net.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
  ctx.FT.NET.fac = 'g'; ctx.name = name; ctx.mem = mem;
  return ctx;
}
const get = async (p, ns) => (await fetch(`http://127.0.0.1:${PORT}/${p}.json?ns=${ns || 'g'}`)).json();
const lvOf = (C, f) => Object.assign({}, floors[f - 1], { _ctx: { maxB: 0, door: false } });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ○', m); } else { fail++; console.log('  ×', m); } };
(async () => {
  await new Promise(r => srv.stdout.once('data', r));
  const bot = require('./bot.js');
  const A = client('A'), B = client('B'), C = client('C');
  const FTA = A.FT, NA = FTA.NET;
  console.log('1) Aが第1層で5回死ぬ（まとめて送る）');
  const lvA = lvOf(A, 1); let corA = await NA.loadCells(lvA); ok(corA.size === 0, 'はじめは屍がない');
  const w0 = (await (await fetch(`http://127.0.0.1:${PORT}/__stats`)).json()).write;
  const jobs = [];
  // 第1層は簡単なので、わざと途中で力尽きる操作を作る
  for (let i = 0; i < 5; i++) {
    const r = new FTA.Run(lvA, corA, { sp: 3 }), rec = new FTA.Rec(); const hold = 60 + i * 37;
    while (!r.over) { const b = r.t < hold ? 4 | (i % 2 ? 2 : 1) : (r.p.on ? 4 : 4); rec.put(r.t + 1, b); r.step(b); if (r.t > 5000) break; }
    ok(r.over && !r.clear && r.place, `${i + 1}回目 死んだ（${r.dead}） 場所 ${r.place && r.place.k}`);
    const pl = r.place; const st = FTA.corStr(corA);
    if (pl.k >= 0) { const c = corA.get(pl.k); if (pl.merge && c) c.n++; else corA.set(pl.k, { n: 1, s: 3, name: 'A' + i }); }
    jobs.push(NA.died({ f: 1, k: pl.k, merge: !!pl.merge, s: 3, name: 'A' + i, rec: rec.str(), cor: st, ticks: r.t, b: 0, m: 100 }));
  }
  const res = await Promise.allSettled(jobs);
  ok(res.every(x => x.status === 'fulfilled'), '5回分、送れた');
  const w1 = (await (await fetch(`http://127.0.0.1:${PORT}/__stats`)).json()).write;
  ok(w1 - w0 <= 2, `書きこみは ${w1 - w0} 回（まとめて送れている）`);
  const cells = await get('ft_cells/1'), stat = await get('ft_stat/1');
  ok(cells && Object.keys(cells).length === corA.size, `データベースの屍 ${cells ? Object.keys(cells).length : 0} か所 ＝ 手元 ${corA.size} か所`);
  ok(stat && stat.d === 5, `死んだ数 ${stat && stat.d}`);
  console.log('2) Bが読みこむ（再生して確かめる）');
  const lvB = lvOf(B, 1); const corB = await B.FT.NET.loadCells(lvB);
  ok(corB.size === corA.size, `Bに見える屍 ${corB.size} か所`);
  if (corB.size !== corA.size) { const dl = await get('ft_dlog/1'); for (const id in dl) { const d = dl[id], rc = await get('ft_drec/1/' + id); const it = Object.assign({ id }, d, rc); const pres = B.FT.V.presentOf(lvB._F.st, lvB._F.raw); console.log('   ', id, d.p, 'snap', rc.c, '→', B.FT.V.verifyDeath(lvB, it, pres, { maxB: 0, door: false }), 'P', JSON.stringify(lvB._F.st.P)); } }
  ok(Object.keys(lvB._F.st.P).length === corA.size, `確かめ済み ${Object.keys(lvB._F.st.P).length} か所`);
  console.log('3) Cがにせの屍を置く（ルールは通るが、再生すると成り立たない）');
  await C.FT.NET.token();
  const cu = C.FT.NET.uid();
  const fake = { ['ft_u/' + cu + '/c']: { '.sv': 'timestamp' } };
  for (let i = 0; i < 4; i++) { const g = C.FT.NET.pid(), k = String(C.FT.ckey(40, (10 + i * 3) * 4)); fake['ft_cells/1/' + k] = { n: 1, s: 0, l: 'にせ', t: { '.sv': 'timestamp' }, g }; fake['ft_dlog/1/' + g] = { p: k, u: cu, t: { '.sv': 'timestamp' }, v: 1, s: 0, b: 0 }; fake['ft_drec/1/' + g] = { r: '1.4', c: '', k: 100 }; }
  let okw = true; try { await C.FT.NET.update(fake); } catch (e) { okw = false; }
  ok(okw, 'にせの屍は、ルール上は書きこめてしまう（形は正しいので）');
  const B2 = client('B2'); const lvB2 = lvOf(B2, 1); const corB2 = await B2.FT.NET.loadCells(lvB2);
  ok(corB2.size === corA.size, `新しく来た人に見える屍 ${corB2.size} か所（にせ4つは見えない）`);
  ok((lvB2._F.st.bad[cu] || 0) >= 3, `にせを置いたIDは、だめな記録 ${lvB2._F.st.bad[cu]} つ`);
  console.log('4) ルールの守り');
  const A2 = A.FT.NET; await sleep(800);
  const k0 = Object.keys(cells)[0];
  let denied = false; try { await A2.update({ ['ft_u/' + A2.uid() + '/c']: { '.sv': 'timestamp' }, ['ft_cells/1/' + k0 + '/n']: 99 }); } catch (e) { denied = true; }
  ok(denied, '人数を一度に増やすことはできない');
  await sleep(800); denied = false;
  try { const g = A2.pid(); await A2.update({ ['ft_u/' + A2.uid() + '/c']: { '.sv': 'timestamp' }, ['ft_cells/1/' + k0]: { n: { '.sv': { increment: 1 } }, s: 4, l: 'のっとり', t: { '.sv': 'timestamp' }, g }, ['ft_dlog/1/' + g]: { p: k0, u: A2.uid(), t: { '.sv': 'timestamp' }, v: 1, s: 4, b: 0 }, ['ft_drec/1/' + g]: { r: '1.4', c: '', k: 5 } }); } catch (e) { denied = true; }
  ok(denied, '屍の名前・種族は書きかえられない');
  denied = false; try { await A2.update({ ['ft_cells/1/' + k0]: null }); } catch (e) { denied = true; }
  ok(denied, 'ふつうの人は屍を消せない');
  denied = false; try { const g = A2.pid(); await A2.update({ ['ft_cells/1/123']: { n: { '.sv': { increment: 1 } }, s: 1, l: 'x', t: { '.sv': 'timestamp' }, g }, ['ft_dlog/1/' + g]: { p: '123', u: A2.uid(), t: { '.sv': 'timestamp' }, v: 1, s: 1, b: 0 }, ['ft_drec/1/' + g]: { r: '1.4', c: '', k: 5 } }); } catch (e) { denied = true; }
  ok(denied, '回数の印（ft_u/c）なしでは屍を置けない');
  console.log('5) Aが第1層を越える → 第2層が開く。Bが確かめる');
  const cl = bot.climb(lvA, { sp: 3, max: 50, cor: new Map([...corA].map(([k, c]) => [k, { n: c.n, s: c.s, name: '' }])) });
  ok(cl.ok, `試しの人が ${cl.lives} 人目で越えた`);
  // 越えた記録は、越えたときの屍（corMap は越えたあとの屍なので、越えた人の直前の屍を使う）
  let lastCor = null; const cl2 = bot.climb(lvA, { sp: 3, max: 50, cor: new Map([...corA].map(([k, c]) => [k, { n: c.n, s: c.s, name: '' }])), onLife: (r, rec, sp, cm) => { lastCor = cm; } });
  // 越えた挑戦の始まりの屍：onLife は死んだ挑戦だけ呼ばれるので、越えたときの屍は corMap（そのあとは足していない）
  const startCor = A.FT.corStr(cl2.corMap);
  // 越えるまでに死んだ分もデータベースに送る（始まりの屍に入っているので）
  void lastCor;
  await sleep(4400);
  let r1 = null; try { r1 = await NA.clear(lvA, { name: 'Aの妖精', rec: cl2.rec, cor: startCor, ticks: 99999, s: 3, b: 0, full: true }); } catch (e) { console.log(e.message); }
  ok(r1 && r1.opened, '第1層をはじめて越えた（印がついた）');
  const op = await get('ft_open/1'); ok(op && op.id === r1.id, '開いた印がある');
  const lvB3 = lvOf(B, 1); lvB3._F = null; await B.FT.NET.loadCells(lvB3);
  const fc = await B.FT.NET.firstClear(lvB3);
  console.log('     始まりの屍の数', cl2.corMap.size, 'データベースの屍', Object.keys(await get('ft_cells/1')).length);
  ok(fc === null || fc.wait || fc.id === r1.id, 'Bの確かめ：始まりの屍がデータベースにない場合は認めない（' + (fc && fc.id ? '認めた' : '認めない') + '）');
  console.log('6) 越えた記録のにせ（操作がでたらめ）は認めない');
  await sleep(4400);
  const C2 = C.FT.NET; let r2 = null; try { r2 = await C2.clear(lvOf(C, 2), { name: 'にせ', rec: '1.4.3c.0', cor: '', ticks: 50, s: 0, b: 0, full: true }); } catch (e) { }
  ok(r2 && r2.opened, 'にせの記録で第2層に「開いた」の印をつけられてしまう（ルール上）');
  const lvB4 = lvOf(B, 2); await B.FT.NET.loadCells(lvB4); const fc2 = await B.FT.NET.firstClear(lvB4);
  ok(fc2 === null, 'Bは、にせの記録を認めない（第3層は開かない）');
  console.log('7) 3つの陣営の高さ');
  const ov = await B.FT.NET.overview();
  ok(ov.tops.g === 1 && ov.tops.r === 1 && ov.tops.b === 1 && ov.rawTop === 3, `見せる高さは確かめ済みだけ g=${ov.tops.g} r=${ov.tops.r} b=${ov.tops.b}（にせの印を含む「開いた」は ${ov.rawTop}）`);
  console.log('7b) GitHub のまとめ（snapshot.js）を作って、新しい人がそれを読む');
  const out = cp.spawnSync(process.execPath, [path.join(__dirname, 'snapshot.js')], { env: Object.assign({}, process.env, { FT_CONFIG_JSON: JSON.stringify(CFG), FT_SNAP_DIR: SNAPDIR }), encoding: 'utf8' });
  console.log('     ' + (out.stdout || '').trim().split('\n').join('\n     ') + (out.stderr ? '\n' + out.stderr : ''));
  const ix = JSON.parse(fs.readFileSync(path.join(SNAPDIR, 'g', 'index.json')));
  ok(ix.ok[1] && ix.ok[1].id === r1.id, 'まとめ：第1層は確かめ済み（本物の記録）');
  ok(!ix.ok[2], 'まとめ：第2層（にせの記録）は確かめ済みにならない');
  const f1 = JSON.parse(fs.readFileSync(path.join(SNAPDIR, 'g', 'f1.json')));
  ok(Object.keys(f1.st.P).length === corA.size && (f1.st.bad[cu] || 0) >= 3, `まとめの第1層：確かめ済みの屍 ${Object.keys(f1.st.P).length} か所、にせのID ${f1.st.bad[cu]}`);
  const s0 = (await (await fetch(`http://127.0.0.1:${PORT}/__stats`)).json());
  const D = client('D', true); const lvD = lvOf(D, 1); const corD = await D.FT.NET.loadCells(lvD);
  const s1 = (await (await fetch(`http://127.0.0.1:${PORT}/__stats`)).json());
  ok(corD.size === corA.size, `まとめを読んだ人に見える屍 ${corD.size} か所`);
  ok(s1.read - s0.read <= 6, `データベースを読んだ回数 ${s1.read - s0.read} 回（まとめから読むので少ない。ふつうは屍の数だけ再生用の記録も読む）`);
  const ovD = await D.FT.NET.overview(); ok(ovD.okSnap[1] && !ovD.okSnap[2], 'まとめの「確かめ済み」が届く');
  ok(ovD.tops.g === 2 && ovD.tops.r === 1, `ほかの陣営から見える高さも、確かめ済みの第${ovD.tops.g}層まで（にせで開いた第3層は見えない）`);
  ok(ix.vtops && ix.vtops.g === 2 && ix.vtops.r === 1 && ix.vtops.b === 1, 'まとめに3つの陣営の確かめ済みの高さが入る');
  console.log('7c) 管理の道具');
  await A2.adminLogin('KEY', 'g');
  const by = await A2.dlog(1, 'g'), gC = by.find(x => x.u === cu);
  ok(gC && gC.n === 4, `にせを置いた人の屍 ${gC && gC.n} 人分が見つかる`);
  await A2.removeBy(1, gC, 'g'); const cAfter = await get('ft_cells/1');
  ok(Object.keys(cAfter).length === corA.size, `取り除いたあとの屍 ${Object.keys(cAfter).length} か所`);
  await A2.blankName(1, r1.id, 'g'); const op1 = await get('ft_open/1');
  ok(op1.n === '名無し', '碑の名前を消せる');
  await A2.purge(2, [r2.id], true, 'g'); const op2 = await get('ft_open/2');
  ok(op2 === null, 'にせの越えた記録と、開いた印を消せる');
  let dn = false; try { await A2.resetFloor(1, 'g'); } catch (e) { dn = true; } const c0 = await get('ft_cells/1');
  ok(!dn && c0 === null, '層の屍をぜんぶ消せる');
  console.log('7d) 屍が足場になった数（ft_help）');
  {
    const ks = [...corA.keys()], k0 = ks[0], k1 = ks[1], E = client('E'); const NE = E.FT.NET;
    const lvE = lvOf(E, 1); await NE.loadCells(lvE);
    const r = new E.FT.Run(lvE, new Map(corA), { sp: 3 }), rec = new E.FT.Rec(); while (!r.over && r.t < 300) { rec.put(r.t + 1, 4); r.step(4); }
    await NE.died({ f: 1, k: -1, merge: false, s: 3, name: 'E', rec: rec.str(), cor: E.FT.corStr(corA), ticks: Math.max(1, r.t), b: 0, m: 0, help: [k0, k1, k0] });
    const h1 = await get('ft_help/1');
    ok(h1 && h1[k0] === 1 && h1[k1] === 1, `乗った屍に1ずつ数が入る（${JSON.stringify(h1)}）`);
    await sleep(900);
    await NE.died({ f: 1, k: -1, merge: false, s: 3, name: 'E2', rec: rec.str(), cor: E.FT.corStr(corA), ticks: Math.max(1, r.t), b: 0, m: 0, help: [k0] });
    const h2 = await get('ft_help/1'); ok(h2[k0] === 2 && h2[k1] === 1, `もう1回乗ると2になる（${h2[k0]}）`);
    let denied = false; try { await NE.update({ ['ft_help/1/' + k0]: 10 }); } catch (e) { denied = true; } ok(denied, '数を一度に増やすことはできない');
    denied = false; try { await NE.update({ ['ft_help/1/' + k0]: 3 }); } catch (e) { denied = true; } ok(denied, '回数の印（ft_u/c）なしでは増やせない');
    const m = await NE.helpOf([{ a: 'g', f: 1, k: k0 }, { a: 'g', f: 1, k: 99999 }]); ok(m.get('g:1:' + k0) === 2 && m.get('g:1:99999') === 0, '自分の屍の数を読める');
  }
  console.log('7e) 掲示板（陣営・広場）');
  {
    const P = client('P'), NP = P.FT.NET, Q = client('Q'), NQ = Q.FT.NET; NP.fac = 'r'; NQ.fac = 'r';
    const id1 = await NP.boardPost('fac', { n: 'ぴー', m: 'こんにちは', s: 3, l: 'ja', f: 5 });
    let ok1 = true; try { await NP.boardPost('fac', { n: 'ぴー', m: 'つづけて', s: 3, l: 'ja', f: 5 }); ok1 = false; } catch (e) { }
    ok(ok1, '20秒たたないと、続けて書けない');
    const rb = await get('ft_board', 'r'); ok(rb && rb[id1] && rb[id1].m === 'こんにちは' && !(await get('ft_board', 'g')), '陣営の掲示板は、その陣営のデータベースだけに入る');
    const id2 = await NQ.boardPost('all', { n: 'きゅー', m: 'Hello world', s: 4, l: 'en', f: 2 });
    const gb = await get('ft_gboard', 'g'); ok(gb && gb[id2] && gb[id2].a === 'r', '広場は緑のデータベースに入り、陣営の印がつく');
    let bad = true; try { await NQ.update({ ['ft_u/' + NQ.uid('r') + '/p']: { '.sv': 'timestamp' }, ['ft_board/zzzzzzzzzz1']: { n: 'x', m: 'y'.repeat(200), t: { '.sv': 'timestamp' }, u: NQ.uid('r'), s: 1, l: 'ja', f: 1 } }, 'r'); bad = false; } catch (e) { }
    ok(bad, '長すぎる文は書けない');
    let bad2 = true; try { await NQ.update({ ['ft_board/' + id1 + '/m']: 'かきかえ' }, 'r'); bad2 = false; } catch (e) { }
    ok(bad2, '人の書きこみは書きかえられない');
    await NQ.boardReport('fac', id1); let dup = true; try { await NQ.boardReport('fac', id1); dup = false; } catch (e) { } const rb2 = await get('ft_board', 'r');
    ok(rb2[id1].r === 1 && dup, '通報は1人1回だけ数える');
    const list = await NP.boardRead('fac'); ok(list.length === 1 && list[0].id === id1, '掲示板を読める');
    const W2 = client('W2'); await W2.FT.NET.adminLogin('KEY', 'r'); await W2.FT.NET.boardDel('fac', id1, 'r'); const rb3 = await get('ft_board', 'r'); ok(!rb3 || !rb3[id1], '管理人は書きこみを消せる');
    let np = true; try { await NQ.boardDel('fac', id2, 'g'); np = false; } catch (e) { } ok(np, 'ふつうの人は消せない');
  }
  console.log('8) 管理：終わりの印を入れると、書きこめなくなる'); await A2.setEnd('g', 'g');
  await sleep(800); denied = false;
  try { const g = A2.pid(); await A2.update({ ['ft_u/' + A2.uid() + '/c']: { '.sv': 'timestamp' }, ['ft_stat/1/d']: { '.sv': { increment: 1 } } }); } catch (e) { denied = true; }
  ok(denied, '終わったあとは、死んだ数も増えない');
  console.log(`\n合格 ${pass}　不合格 ${fail}`);
  srv.kill(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
