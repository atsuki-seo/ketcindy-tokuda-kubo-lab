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
node tools/make-index.mjs build/html                # → build/html/index.html（教材一覧）
node tools/ketjs-run.mjs build/html/nyquist_g4.html \
  --assert '=ReVal(1)|-0.005882|1e-5' --shot build/shot.png
```
- `--assert '=式|期待値|許容誤差'`: CindyScript の式の値を照合する（失敗で終了コード 1）
- `--eval '=式'` / `--eval 'コード;'`: 式の値の表示、またはコードの実行
- `--viewport 390x844`: 画面サイズを指定する。幅 768 未満はスマートフォンとして扱い、タッチ操作も有効にする
- コンソール出力（`println`）と JS 例外を表示し、ページ全体のスクリーンショットを保存する
- ページ幅が画面幅を超える（横スクロールが出る）と失敗にする

### 公開ページの構成
- `index.html`（教材一覧）と各教材ページは、スマートフォン・タブレットでも表示できる。
  キャンバスは画面幅に合わせて縦横比を保ったまま縮み、PC では KeTJS 既定の 742×526 で表示する。
- 各教材ページの上部にパンくずリスト（教材一覧 ／ 教材名）を表示する。
- 教材ページの見出しは、スクリプト先頭などに書いた `// @title 見出し` から取る（なければファイル名）。
  コメント行なので Cinderella 上の動作には影響しない。
- 共通のスタイルと校章は `assets/` にあり、ビルド時に `build/html/assets/` へコピーされる。
  配色・書体・校章は [NITYC-MCC-Tools](https://github.com/atsuki-seo/NITYC-MCC-Tools) の授業資料に合わせている。
- 狭い画面ではキャンバス内の文字（`Letter` など）は縮まず KeTJS と同じ大きさのままなので、
  座標で決めた間隔のままだと文字どうしが重なることがある（下記で対処する）。

### 狭い画面で文字を重ならせない書き方
`Letter` などで文字を縦や横に並べるときは、間隔を px で指定する。
HTML 版では描画のたびに `Ketjspx`（画面上の 1px が何座標分か）が計算されるので、
`16*Ketjspx` と書けば、画面幅によらず 16px の間隔になる。

```
dy = 0.3;                  // Cinderella・TeX 出力用（座標）
//dy = 16*Ketjspx; //only ketjs
Letter([-3,2.7],    "e", "1行目");
Letter([-3,2.7-dy], "e", "2行目");
```

- `//...//only ketjs` の行は HTML 版でだけ実行される（KeTCindy の決まり）。
  `Ketjspx` は HTML 版にしかないので、Cinderella 側の値は通常の行で別に書いておく。
- 行間の目安は、文字の大きさ 12px に対して 16px 程度。
- 例: [src/nyquist_g4.cs](src/nyquist_g4.cs) の「13. スライダー位置のゲイン・位相差」

### 注意（実際の KeTJS 出力との差）
- Cinderella の作図要素（`.cdy` の点など）は、スクリプトの `Putpoint` / `Slider` から推定して宣言している。
- `Textedit` / `subsedit` など Cinderella 専用の機能は、HTML 版では動かない。
- 最終確認は Cinderella の KeTJS ボタンで出した HTML でも行うこと
  （`File > Export to CindyJS` → KeTJS / KeTJSoff）。

参考: [KeTCindyJS の使い方](https://ctan.csail.mit.edu/graphics/ketcindy/ketcindyfolder/work/samples/s16ketJSmisc/howtouseketcindyjsE.txt)

## 校章について

`assets/kousho.svg` は弓削商船高等専門学校の校章で、著作権は同校に帰属する。
校章の使用は同校の教育活動に関わる資料に限られる。
