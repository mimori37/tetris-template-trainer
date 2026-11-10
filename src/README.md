# src/

コード置き場。`index.html` から相対パスで読み込まれる、ビルドなしの静的ファイル群。

## 読み込み順と依存

`index.html` の `<script>` 順に **data → engine → input → qrcode → app**。
モジュール分割ではなく classic script で、トップレベルの `var` / `function` はファイル間で共有される（グローバルスコープ）。順序を変えると壊れる。

- `js/data.js` — 定数（盤面・色・SRS回転テーブル）とテンプレ定義。依存なし
- `js/engine.js` — ゲーム状態・落下/回転/消去・盤面描画・テーマ切替。data に依存
- `js/input.js` — キー設定（プリセット/カスタム）・DAS・タッチ・ゲームパッド
- `js/qrcode.js` — QR生成ライブラリ（第三者製・MIT、Kazuhiko Arase）。編集しない
- `js/app.js` — 画面遷移・モード・判定・AI（ソルバー/デモ/ゴースト）・引き継ぎ。最後に初期化が走る
- `css/style.css` — テーマ変数（`:root` = ライト、`[data-theme="dark"]` = ダーク）と全スタイル。色はここ経由で変える

主な共有グローバル: `G`（現在のゲーム）、`mode`、`bindings` / `activePreset`（キー設定）、`selectedTpl`。

## テンプレを追加するとき

`js/data.js` の `TEMPLATES` に `{ seq, placements }` を足す。制約が2つ:

- `placements[i]` は `seq[i]` のピースの回転形のどれかと正確に一致する4セル
- 各ピースが「下に支えがある位置」に実在の操作（移動・回転・180度回転）で到達できること。
  浮いた配置や到達不能な配置だと、プレイヤーもAIも100%再現できなくなる（過去に実例あり）
