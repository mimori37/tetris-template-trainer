# テトリス テンプレ積みトレーナー

開幕テンプレ積みの練習とスキルチェックができるテトリス。ビルド不要の静的サイトです。

**遊ぶ**: https://mimori37.github.io/tetris-template-trainer/

## 動かし方

```sh
git clone https://github.com/mimori37/tetris-template-trainer.git
# index.html をブラウザで開く
```

## できること

- 本体: ガイドライン寄り（7種1巡、SRS、Tスピン判定、180度回転、DAS/ARR相当）
- テンプレ練習: 5種の開幕形を、目標シルエットとの一致率で判定。図鑑に習得ロードマップと自己ベスト
- スキルチェック: ランダム3題を S〜D ランクで採点
- AIゴースト戦 / お手本デモ: 正解配置をAIが実際に積んで見せる・並走する
- 操作: 環境別キープリセット（標準 / TETR.IO / Jstris / ぷよテト横持ち）＋カスタム、Joy-Con / Proコン対応
- 記録はブラウザ保存。引き継ぎリンク・QRで別端末へ移せる（サーバーなし）

## 構成

| パス | 内容 |
|---|---|
| `index.html` | 画面の骨格 |
| `src/css/style.css` | テーマ（ライト / ダーク）と全スタイル |
| `src/js/data.js` | 定数とテンプレ定義 |
| `src/js/engine.js` | ゲーム本体と描画 |
| `src/js/input.js` | キー設定・ゲームパッド |
| `src/js/app.js` | 画面・判定・AI・引き継ぎ |
| `src/js/qrcode.js` | QR生成ライブラリ（MIT、Kazuhiko Arase） |

## 開発について

- 開発: mimori37（AIコーディング支援を利用。仕様決定・レビュー・動作確認は開発者が実施）
- `main` への push で GitHub Pages に自動デプロイ

本作品は非公式の個人作品です。「テトリス」は The Tetris Company の商標です。
