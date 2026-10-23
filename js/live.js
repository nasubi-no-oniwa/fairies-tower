// =============================================
//  Fairies' Tower  配信中の人
//  ・管理ページで出した「配信中の人」を、タイトル・陣営の部屋と、遊んでいる画面の右上（🔴）に出す
//  ・タイトルでは開いたときに読む（1分に1回まで）。遊んでいる間は5分に1回だけ読みなおし、新しく始まった配信を小さく知らせる
// =============================================
(function (G) {
  const FT = G.FT, N = FT.NET, UI = FT.UI, T = FT.T, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LIVE = { list: [], at: 0, busy: false };
  const host = u => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return /youtu/.test(h) ? 'YouTube' : /twitch/.test(h) ? 'Twitch' : /nicovideo|nico\.ms/.test(h) ? T('ニコニコ') : /twitcasting/.test(h) ? T('ツイキャス') : /tiktok/.test(h) ? 'TikTok' : /(^|\.)(x|twitter)\.com$/.test(h) ? 'X' : h; } catch (e) { return ''; } };
  const inGame = () => $('game').classList.contains('on');
  function paint() { const on = LIVE.list.length > 0; $('tLive').hidden = !on; $('gLive').hidden = !on; }
  async function load(force, gap) {
    if (LIVE.busy || UI.OFFLINE) return LIVE.list;
    if (!force && Date.now() - LIVE.at < (gap || 60000)) return LIVE.list;
    LIVE.busy = true; LIVE.at = Date.now();
    try { LIVE.list = await N.live(); } catch (e) { } finally { LIVE.busy = false; }
    paint(); return LIVE.list;
  }
  function open() {
    const L = LIVE.list;
    $('liveList').innerHTML = L.length ? L.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer"><b>${esc(x.n)}</b><span>${esc(host(x.u))}</span>${x.m ? `<small>${esc(x.m)}</small>` : ''}</a>`).join('') : `<p class="note">${esc(T('いまは配信中の人はいません。'))}</p>`;
    UI.modal('oLive', 1); if (inGame() && UI.S.lv) UI.S.paused = true;
  }
  function close() { UI.modal('oLive', 0); if (inGame() && UI.S.lv && !document.querySelector('.over.on')) UI.S.paused = false; }
  $('tLive').onclick = open; $('gLive').onclick = open; $('liveClose').onclick = close;
  $('oLive').addEventListener('click', e => { if (e.target.id === 'oLive') close(); });
  // タイトルにいるときは1分に1回、遊んでいる間は5分に1回
  setInterval(() => {
    if (document.hidden) return;
    if (!inGame()) { load(false, 60000); return; }
    if (Date.now() - LIVE.at < 300000) return;
    const before = new Set(LIVE.list.map(x => x.id));
    load(true).then(list => { const nw = list.filter(x => !before.has(x.id)); if (nw.length && inGame() && !UI.S.paused) UI.toast(T('🔴 {0}さんが配信を始めました', nw[0].n), T('右上の🔴から見に行けます'), 2800); });
  }, 15000);
  setTimeout(() => load(true), 1500);
  FT.LIVE = { load, open, list: () => LIVE.list };
})(window);
