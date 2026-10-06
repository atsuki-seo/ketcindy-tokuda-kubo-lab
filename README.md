# ketcindy-tokuda-kubo-lab

## Abstract

工学の分野では数式を多用するが，計算結果を求めるだけでは，数式が表現する特性に気づけない場合がある．そこで数式をグラフ化し，特性を視覚的に捉えられるHTML教材を開発する．KeTCindyは，数学教材の作成に必要な機能やコマンドが用意されたツールである．KeTCindyを用いて，弓削商船高等専門学校 情報工学科の専門科目を対象としたアプリケーションを開発している．

## 開発環境

Cinderella の GUI を使わずに、コマンドで「ビルド → ブラウザ実行 → 検証」ができる。
KeTCindyJS が HTML を作る処理（KeTJS ボタン相当）を `tools/ketjs-build.mjs` に移植し、
`tools/ketjs-run.mjs` がヘッドレス Chrome で開いて検証する。追加の npm パッケージは不要。

### 必要なもの
- Node.js（22 以上）、Google Chrome
- KeTCindy 一式（既定 `~/ketcindy`、環境変数 `KETCINDY_HOME` で変更可）。
  [CTAN](https://ctan.csail.mit.edu/graphics/ketcindy.zip) の `ketcindy.zip` を展開して `~/ketcindy` に置く。

### 使い方
```bash
node tools/ketjs-build.mjs src/nyquist_g4.cs        # → build/html/nyquist_g4.html
node tools/ketjs-run.mjs build/html/nyquist_g4.html \
  --assert '=ReVal(1)|-0.005882|1e-5' --shot build/shot.png
```
- `--assert '=式|期待値|許容誤差'`: CindyScript の式の値を照合する（失敗で終了コード 1）
- `--eval '=式'` / `--eval 'コード;'`: 式の値の表示、またはコードの実行
- コンソール出力（`println`）と JS 例外を表示し、スクリーンショットを保存する

### 注意（実際の KeTJS 出力との差）
- Cinderella の作図要素（`.cdy` の点など）は、スクリプトの `Putpoint` / `Slider` から推定して宣言している。
- `Textedit` / `subsedit` など Cinderella 専用の機能は、HTML 版では動かない。
- 最終確認は Cinderella の KeTJS ボタンで出した HTML でも行うこと
  （`File > Export to CindyJS` → KeTJS / KeTJSoff）。

参考: [KeTCindyJS の使い方](https://ctan.csail.mit.edu/graphics/ketcindy/ketcindyfolder/work/samples/s16ketJSmisc/howtouseketcindyjsE.txt)
