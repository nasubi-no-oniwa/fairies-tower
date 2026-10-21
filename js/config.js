// =============================================
//  Fairies' Tower  つなぎ先（陣営ごとに別の Firebase プロジェクト）
//  ※この値は公開しても問題ない種類のものです（守りはデータベースのルールで行います）
//  Firebase の画面で作った3つのプロジェクトの「apiKey」と「databaseURL」を入れてください
// =============================================
window.FT_CONFIG = window.FT_CONFIG || {
  g: { apiKey: 'ここに緑の同盟のapiKey', databaseURL: 'ここに緑の同盟のdatabaseURL' },   // 緑の同盟
  r: { apiKey: 'ここに赤の軍勢のapiKey', databaseURL: 'ここに赤の軍勢のdatabaseURL' },   // 赤の軍勢
  b: { apiKey: 'ここに青の連合のapiKey', databaseURL: 'ここに青の連合のdatabaseURL' },   // 青の連合
};
// ゲームの住所（Xに投稿する文に入る）
window.FT_GAME_URL = window.FT_GAME_URL || 'https://nasubi-no-oniwa.github.io/fairies-tower/';
