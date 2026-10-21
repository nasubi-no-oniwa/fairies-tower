# Fairies' Tower

3つの陣営に分かれて、死ぬと残る屍を足場に、100層の世界樹のてっぺんを目指すブラウザゲーム。

## 公開までの手順

### 1. GitHub に置く
1. GitHub で新しいリポジトリ `fairies-tower` を作る（**公開**にする。公開なら、まとめ作りの GitHub Actions も無料）
2. このフォルダの中身をすべて上げる（`.github` フォルダも忘れずに）
3. リポジトリの Settings → Pages → Branch を `main`、フォルダを `/ (root)` にして保存
   → `https://nasubi-no-oniwa.github.io/fairies-tower/` で開けるようになる
4. Settings → Actions → General → Workflow permissions を「Read and write permissions」にして保存

### 2. Firebase のプロジェクトを3つ作る（陣営ごと。どれも無料のまま）
緑の同盟・赤の軍勢・青の連合の3つ。それぞれで次の手順をくり返す。

1. Firebase の画面で「プロジェクトを追加」（名前の例：`ft-green`、`ft-red`、`ft-blue`）。Google アナリティクスは使わなくてよい
2. 構築 → Authentication → はじめる → ログイン方法 →「匿名」を有効にする
3. 構築 → Realtime Database → データベースを作成 → 場所はシンガポール → 「ロックモード」で始める
4. Realtime Database の「ルール」に、`rules/ft_rules.json` の中身をまるごと貼って「公開」
5. Realtime Database の「データ」で、`ft_admin` → `key` に、管理のかぎ（自分だけが知っている文字）を入れる
6. プロジェクトの設定 → マイアプリ → ウェブアプリを追加（名前は何でもよい）
   → 出てきた `apiKey` と `databaseURL` を、`js/config.js` の陣営の欄に入れる

3つ入れたら `js/config.js` を GitHub に上げる。上げた時点でゲームが始まる（公開した日がスタート）。

### 3. まとめ作りを動かす
リポジトリの Actions → `snapshot` →「Run workflow」で1回動かす。そのあとは15分ごとに自動で動く。
まとめ（`data/snap/`）があると、ゲームの端末はデータベースから新しい分だけを読むので、通信量が大きく減る。

### 4. なすびのお庭からリンクする
`https://nasubi-no-oniwa.github.io/fairies-tower/` にリンクする。

## 公開中
- 管理画面：`https://nasubi-no-oniwa.github.io/fairies-tower/admin.html`
  - 陣営をえらんで、管理のかぎで入る
  - 層ごとに、屍を置いた人・越えた記録（本物かにせか）が見られる。にせの人の屍を取り除く、碑の名前を消す、にせの記録を消す、層の屍をぜんぶ消す
- 不具合が出たら、そのつど直す

## 終わり
1. 頂上（第100層）にたどり着いた陣営が出たら、管理画面で3つの陣営すべてに入る
2. 「ゲームを終える」を押す → 3つのデータベースに「終わり」の印が入り、だれも書きこめなくなる
3. 15分以内に、まとめに「終わり」が入る。そのあと、ゲームの端末はデータベースを読まない（通信量は0になる）
4. 終わったあとも遊べるが、屍は増えない

## ファイル
| ファイル | 中身 |
|---|---|
| `index.html` | ゲームの画面 |
| `admin.html` | 管理画面 |
| `js/engine.js` | 動きの計算（どの端末でも同じ結果になる） |
| `js/verify.js` | ずる対策の確かめ（屍と越えた記録を再生する） |
| `js/net.js` | データベースとのやりとり |
| `js/main.js` | 画面と流れ・絵 |
| `js/sound.js` | 音 |
| `js/worker.js` | 確かめを裏で計算する |
| `js/config.js` | つなぎ先（3つの Firebase） |
| `data/floors.json` | 100層の形（`tools/genfloors.js` で作る） |
| `data/snap/` | まとめ（GitHub Actions が作る） |
| `rules/ft_rules.json` | データベースのルール（3つとも同じ） |
| `tools/snapshot.js` | まとめを作る（GitHub Actions が使うので、必ず置く） |
| `tools/` のほかのファイル | 層を作る・テストする道具 |
