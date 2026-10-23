// =============================================
//  掲示板（陣営の掲示板 ×3 ＋ 広場（全体の掲示板））
//  ・1人20秒に1回まで（データベースのルールでも止める）
//  ・ひどい言葉・リンク・連絡先は書けない（書く前に止める。見るときも隠す）
//  ・ほかの言葉の投稿は、ブラウザの中の翻訳（Chrome など）で自動で訳す。できないブラウザは「翻訳」で Google 翻訳を開く
//  ・3人に通報された投稿は見せない。自分で「隠す」「この人を見えなくする」もできる
//  ・開いているあいだだけ、12秒ごとに新しい分を読む（通信を少なく）
// =============================================
(function (G) {
  const FT = G.FT, UI = FT.UI, N = FT.NET, T = FT.T, SND = FT.SND, ART = FT.ART;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ME = UI.ME, saveMe = () => N.store('ft_me', ME);
  const COOL = 20000, MAXLEN = 120;

  // ---------- 書いてはいけない言葉 ----------
  //  くらべる前に：全角半角をそろえる・小文字・カタカナをひらがな・空白や記号をぬく（「し ね」「シ.ネ」も止める）
  const BAN = [
    // 日本語
    'しね', '氏ね', '死ね', 'ころす', '殺す', 'ぶっころ', 'きえろ', '消えろ', 'じさつ', '自殺', 'くびつれ', '首吊',
    'がいじ', 'ちしょう', '池沼', '知恵遅れ', 'きちがい', '基地外', '気違い', 'かたわ', 'めくら', 'つんぼ',
    'ちんこ', 'ちんぽ', 'まんこ', 'せっくす', 'れいぷ', '犯す', 'おかす', 'ふぇら', 'えろ動画', 'えろ画像', 'ぱいずり', 'なかだし', '中出し',
    'うりせん', '売春', '援交', '援助交際', 'ぱぱかつ', 'ぱぱ活', '出会い系', 'せふれ',
    '支那', 'しなじん', 'ざいにち', '在日', 'ぶらく', '部落', 'くろんぼ', '黒んぼ', 'にがー',
    'らいん交換', 'らいんこうかん', 'line交換', 'かかお', 'でぃすこ', 'いんすた', '連絡先', 'でんわばんごう', '電話番号', '住所',
    // 英語
    'fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'dick', 'cocksuck', 'pussy', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'raping', 'rapist', 'kys', 'killyourself', 'porn', 'nazi', 'hitler', 'sex', 'nude', 'onlyfans', 'snapchat', 'telegram', 'whatsapp', 'discord', 'instagram',
    // 中国語
    '幹你', '幹您', '干你', '操你', '肏', '他媽', '他妈', '傻逼', '傻屄', '雞巴', '鸡巴', '白癡', '白痴', '智障', '去死', '賤人', '贱人', '婊子', '屄', '黑鬼', '約炮', '约炮', '色情', '援交',
    // 韓国語
    '씨발', '시발', '씨팔', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '새끼', '지랄', '미친놈', '미친년', '닥쳐', '꺼져', '섹스', '보지', '자지', '창녀', '느금마', '니애미', '자살',
  ].map(w => norm(w)).filter(Boolean);
  function norm(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    s = s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));   // カタカナ → ひらがな
    return s.replace(/[\s　.,、。・!！?？~〜ー\-_*＊/\\|()（）「」『』\[\]{}<>＜＞'"`^:;]/g, '');
  }
  // リンク・メール・電話・SNSのID
  const PAT = [/https?:|www\.|\.(com|net|org|jp|io|gg|me|ly|tv|xyz|info|app|dev)\b/i, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, /(\d[\s-]?){10,}/, /@[a-z0-9_]{3,}/i, /(line|kakao|discord|tg)\s*(id|:|：)/i];
  function check(text) {
    const t = String(text || '').trim();
    if (!t) return T('文を入れてください');
    if (t.length > MAXLEN) return T('{0}文字までです', MAXLEN);
    if ((t.match(/\n/g) || []).length > 4) return T('改行が多すぎます');
    if (/(.)\1{9,}/.test(t)) return T('同じ文字が続きすぎています');
    for (const p of PAT) if (p.test(t)) return T('リンク・連絡先・IDは書けません');
    const n = norm(t); for (const w of BAN) if (n.includes(w)) return T('使えない言葉が入っています');
    return '';
  }
  const bad = text => { const n = norm(text); if (BAN.some(w => n.includes(w))) return true; return PAT.some(p => p.test(String(text || ''))); };
  FT.BOARD_CHECK = check;

  // ---------- 翻訳 ----------
  const TL = { ja: 'ja', en: 'en', zh: 'zh-Hant', ko: 'ko' }, GTL = { ja: 'ja', en: 'en', zh: 'zh-TW', ko: 'ko' };
  const trans = new Map(), tCache = new Map();
  let autoTr = ME.bAuto !== 0, canAPI = null;
  async function apiOk(src) {
    if (!('Translator' in G)) return false;
    try { const a = await G.Translator.availability({ sourceLanguage: TL[src], targetLanguage: TL[FT.LANG] }); return a && a !== 'unavailable'; } catch (e) { return false; }
  }
  async function translate(text, src) {
    const key = src + '|' + text; if (tCache.has(key)) return tCache.get(key);
    let tr = trans.get(src);
    if (!tr) { tr = G.Translator.create({ sourceLanguage: TL[src], targetLanguage: TL[FT.LANG] }); trans.set(src, tr); }
    const out = await (await tr).translate(text); tCache.set(key, out); return out;
  }
  const gURL = text => `https://translate.google.com/?sl=auto&tl=${GTL[FT.LANG]}&text=${encodeURIComponent(text)}&op=translate`;

  // ---------- 状態 ----------
  const B = { kind: 'fac', list: [], last: 0, pin: '', timer: 0, open: false, busy: false };
  ME.bseen = ME.bseen || {}; ME.bhide = ME.bhide || []; ME.bmute = ME.bmute || [];
  const seenKey = kind => kind === 'all' ? 'all' : 'fac_' + N.fac;
  const facOf = a => FT.FAC[Math.max(0, N.FACS.indexOf(a))];
  const ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return T('たった今'); if (s < 3600) return T('{0}分前', Math.floor(s / 60)); if (s < 86400) return T('{0}時間前', Math.floor(s / 3600)); return T('{0}日前', Math.floor(s / 86400)); };
  const LNAME = { ja: '日本語', en: 'English', zh: '中文', ko: '한국어' };
  const myName = () => { if (!ME.bname) { ME.bname = (UI.newName ? UI.newName() : 'Fairy'); saveMe(); } return ME.bname; };

  function sprite(s) { const c = document.createElement('canvas'); c.width = c.height = 16; c.className = 'bdSp'; try { ART.fairy(c.getContext('2d'), s | 0, 8, 15, 1, 'stand', .3); } catch (e) { } return c; }
  function paint() {
    const box = $('bdList'), me = N.boardUid(B.kind);
    const rows = B.list.filter(c => !ME.bhide.includes(c.id) && !ME.bmute.includes(c.u) && !((c.r | 0) >= 3)).slice(-80).reverse();
    box.innerHTML = '';
    if (!rows.length) { box.innerHTML = `<p class="bdEmpty">${esc(T('まだ書きこみがありません。最初のひとことをどうぞ'))}</p>`; return; }
    for (const c of rows) {
      const F = B.kind === 'all' ? facOf(c.a) : facOf(N.fac), mine = c.u === me, hidden = bad(c.m) || bad(c.n);
      const el = document.createElement('div'); el.className = 'bdPost' + (mine ? ' mine' : ''); el.dataset.id = c.id;
      el.appendChild(sprite(c.s));
      const body = document.createElement('div'); body.className = 'bdBody';
      const foreign = c.l && c.l !== FT.LANG && !hidden;
      body.innerHTML = `<div class="bdHead"><b style="color:${F ? F.color : 'inherit'}">${esc(hidden ? T('名無し') : N.cleanName(c.n))}</b>${mine ? `<em>${esc(T('自分'))}</em>` : ''}<small>${B.kind === 'all' && F ? esc(F.name) + ' · ' : ''}${c.f ? esc(T('第{0}層', Math.min(100, c.f))) + ' · ' : ''}${esc(ago(c.t))}${foreign ? ' · ' + esc(LNAME[c.l] || c.l) : ''}</small></div>` +
        `<p class="bdMsg">${hidden ? `<i>${esc(T('表示できない言葉が含まれています'))}</i>` : esc(c.m)}</p><p class="bdTr" hidden></p>` +
        `<div class="bdAct">${foreign ? `<button data-a="tr">${esc(T('翻訳'))}</button>` : ''}${mine ? '' : `<button data-a="more">…</button>`}</div><div class="bdMore" hidden><button data-a="hide">${esc(T('この投稿を隠す'))}</button><button data-a="mute">${esc(T('この人を見えなくする'))}</button><button data-a="rep" class="warn">${esc(T('通報する'))}</button></div>`;
      el.appendChild(body); box.appendChild(el);
      if (foreign && autoTr && canAPI) doTr(el, c, true);
    }
  }
  async function doTr(el, c, auto) {
    const out = el.querySelector('.bdTr');
    if (canAPI === null) canAPI = await apiOk(c.l);
    if (canAPI || await apiOk(c.l)) {
      try { out.hidden = false; out.textContent = '…'; const t = await translate(c.m, c.l); out.textContent = t; out.classList.add('ok'); return; }
      catch (e) { out.hidden = true; if (auto) return; }
    }
    if (!auto) open(gURL(c.m), '_blank', 'noopener');
  }
  $('bdList').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const el = b.closest('.bdPost'), c = B.list.find(x => x.id === el.dataset.id); if (!c) return;
    const a = b.dataset.a;
    if (a === 'tr') doTr(el, c, false);
    else if (a === 'more') { const m = el.querySelector('.bdMore'); m.hidden = !m.hidden; }
    else if (a === 'hide') { ME.bhide = ME.bhide.concat(c.id).slice(-300); saveMe(); paint(); UI.toast(T('隠しました')); }
    else if (a === 'mute') { ME.bmute = ME.bmute.concat(c.u).slice(-200); saveMe(); paint(); UI.toast(T('この人の書きこみを見えなくしました')); }
    else if (a === 'rep') {
      if (!confirm(T('この投稿を通報しますか？（3人に通報されると、みんなから見えなくなります）'))) return;
      try { await N.boardReport(B.kind, c.id); c.r = (c.r | 0) + 1; } catch (e2) { }
      ME.bhide = ME.bhide.concat(c.id).slice(-300); saveMe(); paint(); UI.toast(T('通報しました。ありがとうございます'));
    }
  });

  // ---------- 読む ----------
  async function load(full) {
    if (B.busy) return; B.busy = true;
    try {
      const v = await N.boardRead(B.kind, full ? 0 : B.last);
      if (full) B.list = v; else for (const c of v) if (!B.list.some(x => x.id === c.id)) B.list.push(c);
      for (const c of B.list) if (c.t > B.last) B.last = c.t;
      ME.bseen[seenKey(B.kind)] = Math.max(ME.bseen[seenKey(B.kind)] || 0, B.last); saveMe();
      paint(); badge();
    } catch (e) { if (full) $('bdList').innerHTML = `<p class="bdEmpty">${esc(T('読みこめませんでした'))}</p>`; }
    finally { B.busy = false; }
  }
  // ---------- 開く ----------
  UI.openBoard = async function (kind) {
    if (UI.OFFLINE || !N.boardReady(kind)) { UI.toast(T('つなぎ先がないので、掲示板は使えません')); return; }
    B.kind = kind; B.list = []; B.last = 0; B.open = true;
    const F = facOf(N.fac);
    $('bdTitle').innerHTML = kind === 'all' ? esc(T('広場')) + `<small>${esc(T('すべての陣営・すべての言葉'))}</small>` : `<span style="color:${F.color}">${esc(T('{0}の掲示板', F.name))}</span><small>${esc(T('仲間だけが見られる'))}</small>`;
    $('oBoard').dataset.kind = kind; $('oBoard').style.setProperty('--fc', kind === 'all' ? '#ffe9a8' : F.color);
    $('bdName').value = myName(); $('bdMsg').value = ''; count();
    $('bdList').innerHTML = `<p class="bdEmpty">${esc(T('読みこみ中…'))}</p>`;
    $('bdPin').hidden = true; N.boardPin(kind).then(p => { if (p && typeof p === 'string') { $('bdPin').hidden = false; $('bdPin').textContent = p; } });
    const auto = $('bdAuto'); auto.hidden = !('Translator' in G); auto.classList.toggle('off', !autoTr); auto.textContent = autoTr ? T('自動翻訳：オン') : T('自動翻訳：オフ');
    $('bdTrNote').textContent = ('Translator' in G) ? '' : T('ほかの言葉の投稿は「翻訳」で Google 翻訳を開けます');
    UI.modal('oBoard', 1); cool();
    await load(true);
    clearInterval(B.timer); B.timer = setInterval(() => { if (B.open && !document.hidden) load(false); }, 12000);
  };
  function close() { B.open = false; clearInterval(B.timer); UI.modal('oBoard', 0); badge(); if (UI.S.lv && $('game').classList.contains('on') && !document.querySelector('.over.on')) UI.S.paused = false; }
  $('bdClose').onclick = close;
  $('oBoard').addEventListener('click', e => { if (e.target.id === 'oBoard') close(); });
  $('bdAuto').onclick = () => { autoTr = !autoTr; ME.bAuto = autoTr ? 1 : 0; saveMe(); $('bdAuto').classList.toggle('off', !autoTr); $('bdAuto').textContent = autoTr ? T('自動翻訳：オン') : T('自動翻訳：オフ'); if (autoTr) paint(); };
  // ---------- 書く ----------
  function count() { const n = $('bdMsg').value.length; $('bdCount').textContent = `${n} / ${MAXLEN}`; $('bdCount').classList.toggle('over', n > MAXLEN); }
  $('bdMsg').addEventListener('input', count);
  let coolT = 0;
  function cool() {
    clearTimeout(coolT); const left = (ME.bpost || 0) + COOL - Date.now(), btn = $('bdSend');
    if (left > 0) { btn.disabled = true; btn.textContent = T('あと{0}秒', Math.ceil(left / 1000)); coolT = setTimeout(cool, 500); }
    else { btn.disabled = false; btn.textContent = T('書きこむ'); }
  }
  $('bdSend').onclick = async () => {
    const m = $('bdMsg').value.trim(), n = $('bdName').value.trim();
    const e1 = check(m); if (e1) { UI.toast(e1); return; }
    const nn = N.cleanName(n); if (!nn) { UI.toast(T('名前を入れてください')); return; }
    if (bad(nn)) { UI.toast(T('その名前は使えません')); return; }
    if (ME.blast && ME.blast.m === m && Date.now() - ME.blast.t < 300000) { UI.toast(T('同じ文は続けて書けません')); return; }
    if ((ME.bpost || 0) + COOL > Date.now()) { cool(); return; }
    $('bdSend').disabled = true;
    try {
      ME.bname = nn; ME.bpost = Date.now(); ME.blast = { m, t: Date.now() }; saveMe();
      await N.boardPost(B.kind, { n: nn, m, s: ME.sp | 0, l: FT.LANG, f: (ME.best && ME.best[N.fac]) || 0 });
      $('bdMsg').value = ''; count(); SND.se('ui'); await load(false);
    } catch (e) { ME.bpost = Date.now() - COOL + 3000; saveMe(); UI.toast(T('書きこめませんでした'), T('少し待ってもう一度')); }
    cool();
  };
  // ---------- 新着の印 ----------
  let badgeAt = 0;
  async function badge(force) {
    if (UI.OFFLINE) return;
    if (force && Date.now() - badgeAt > 60000) {
      badgeAt = Date.now();
      const [a, f] = await Promise.all([N.boardReady('all') ? N.boardLast('all') : 0, N.boardReady('fac') ? N.boardLast('fac') : 0]);
      B.lastAll = a; B.lastFac = f;
    }
    const newA = (B.lastAll || 0) > (ME.bseen.all || 0), newF = (B.lastFac || 0) > (ME.bseen[seenKey('fac')] || 0);
    const pa = $('bPlaza'), pf = $('bBoard'); if (pa) pa.classList.toggle('new', newA); if (pf) pf.classList.toggle('new', newF);
  }
  UI.boardBadge = badge;
})(window);
