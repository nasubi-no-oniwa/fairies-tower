// =============================================
//  Fairies' Tower  つなぎ先（陣営ごとに別の Firebase プロジェクト）
//  ※この値は公開しても問題ない種類のものです（守りはデータベースのルールで行います）
//  Firebase の画面で作った3つのプロジェクトの「apiKey」と「databaseURL」を入れてください
// =============================================
window.FT_CONFIG = window.FT_CONFIG || {
  g: { apiKey: 'AIzaSyCfCUAY7vhCFVF58tGOQzLCQsfPhp-Qi1A', databaseURL: 'https://ft-green-default-rtdb.asia-southeast1.firebasedatabase.app' },   // 緑の同盟
  r: { apiKey: 'AIzaSyBCzVyblBmfNQq4XdPHdQppE94gyiYxDkA', databaseURL: 'https://ft-red-default-rtdb.asia-southeast1.firebasedatabase.app' },   // 赤の軍勢
  b: { apiKey: 'AIzaSyB2iLUuAyxSJ45RewGrbyLg0sYLsC7njIo', databaseURL: 'https://ft-blue-default-rtdb.asia-southeast1.firebasedatabase.app' },   // 青の連合
};
// ゲームの住所（Xに投稿する文に入る）
window.FT_GAME_URL = window.FT_GAME_URL || 'https://nasubi-no-oniwa.github.io/fairies-tower/';
