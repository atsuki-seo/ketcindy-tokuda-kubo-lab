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
node tools/ketjs-build.mjs src/nyquist_g4.cs        # → build/html/control/nyquist_g4.html
node tools/make-index.mjs build/html                # → build/html/index.html（教材一覧）と control/index.html
node tools/ketjs-run.mjs build/html/control/nyquist_g4.html \
  --assert '=ReVal(1)|-0.005882|1e-5' --shot build/shot.png
```
- 科目ごとのディレクトリの教材（例: `src/math2/circle-equation.cs`、`src/math2/conic-tangent.cdy`）も同じようにビルドする。出力先は `@category` で決まる
- 練習問題は `node tools/drill-build.mjs src/math2/drill-point-line.json` でビルドする（下の「練習問題」）
- `--assert '=式|期待値|許容誤差'`: CindyScript の式の値を照合する（失敗で終了コード 1）。
  `--eval` をすべて実行してから照合するので、点を動かして確かめるときは呼び出しを分ける
- `--eval '=式'` / `--eval 'コード;'`: 式の値の表示、またはコードの実行
- `--viewport 390x844`: 画面サイズを指定する。幅 768 未満はスマートフォンとして扱い、タッチ操作も有効にする
- コンソール出力（`println`）と JS 例外を表示し、ページ全体のスクリーンショットを保存する
- ページ幅が画面幅を超える（横スクロールが出る）と失敗にする

### 公開ページの構成
教材は「科目 → 教材」の階層で並ぶ。URL には科目の英字名（slug）を使う。

```
index.html                  ← 教材一覧（科目の一覧と件数）
control/index.html          ← 制御工学の教材の一覧
control/nyquist_g4.html     ← 教材ページ
```

- 教材の科目は、スクリプト先頭などに書いた `// @category 科目名` で指定する（必須。ないとビルドが失敗する）。
- 科目名と slug の対応は [tools/site.mjs](tools/site.mjs) の `CATEGORIES` にまとめてある。新しい科目の教材を作るときは、
  先にここへ `{ slug: "circuit", name: "電気回路" }` のように追加する。一覧ページの科目はこの表の順に並ぶ。
- 一覧ページ（教材一覧・科目ごとの一覧）は `make-index.mjs` がビルド後の HTML から作る。
- 一覧ページと各教材ページは、スマートフォン・タブレットでも表示できる。
  キャンバスは画面幅に合わせて縦横比を保ったまま縮み、PC では KeTJS 既定の 742×526 で表示する。
- 各ページの上部にパンくずリスト（教材一覧 ／ 科目名 ／ 教材名）を表示する。
- 教材ページの見出しは、スクリプト先頭などに書いた `// @title 見出し` から取る（なければファイル名）。
  コメント行なので Cinderella 上の動作には影響しない。
- 共通のスタイルと校章は `assets/` にあり、ビルド時に `build/html/assets/` へコピーされる。
  `assets/` と KeTCindyJS のライブラリ（`ketcindyjs/`）は出力ディレクトリ直下に 1 つだけ置き、科目の下のページからは `../` で参照する。
  配色・書体・校章は [NITYC-MCC-Tools](https://github.com/atsuki-seo/NITYC-MCC-Tools) の授業資料に合わせている。
- 狭い画面ではキャンバス内の文字（`Letter` など）は縮まず KeTJS と同じ大きさのままなので、
  座標で決めた間隔のままだと文字どうしが重なることがある（下記で対処する）。

### 教材ページの構成（単元・説明・操作・確かめ）
スクリプトのコメント行に次のように書くと、教材ページに単元のタグ、プリントとの対応、説明、
「動かしてみよう」「確かめよう」（答えは開いて見る）を並べる。どれも省略できる。例: [src/math2/circle-equation.cs](src/math2/circle-equation.cs)

```
// @unit 7 楕円の式            単元の番号と名前（科目の一覧ページはこの番号の順に並ぶ）
// @order 2                     同じ単元に教材が複数あるときの順
// @print 【楕円と焦点】         対応するプリントの見出し
// @lead 楕円上のどこに P があっても PF₁+PF₂ は一定になる
// @step P を楕円上で一周させ、和を観察する          （複数書ける）
// @check x²/9+y²/6=1 の2焦点は？ | (±√3, 0)        （| の後ろが答え。複数書ける）
// @switch Ch 楕円|放物線|双曲線   図を切り替えるボタン。押すと Ch=[1] / Ch=[2] / … になる
```

- `@switch` を使うときは、HTML 版では最初に `Ch=[1]` にするので、スクリプトの `Ch=[...]` の行には `//no ketjs` を付ける。
- `Readout(["PF₁ = "+format(d1,3), ...])` と書くと、キャンバスの下に値を並べて表示する（点を動かすとその場で変わる）。
  HTML 版にだけある関数なので、呼び出す行は `//Readout(...); //only ketjs` にする。
- 科目に章（[tools/site.mjs](tools/site.mjs) の `chapters`）があると、一覧ページを章の見出しで分け、各行に単元のタグを付ける。
  各ページの下には、単元の順で前後の教材へのリンクを付ける。

### 印刷用の図と Web 版の両用の cdy
数学2の教材のうち、担当教員の cdy を元にした 11 本は、cdy そのものを `src/math2/*.cdy` に置いている。
1 つの cdy の描画スクリプトに、担当教員の印刷用の図のスクリプト（元のまま）と Web 版の両方が入っている。

- Cinderella では、描画スクリプトの `Web=0;` を `Web=1;` に変えると Web 版を表示する（`0` で印刷用の図）。
- HTML 版（Cinderella の KeTJS ボタン、`tools/ketjs-build.mjs`）では、`//no ketjs` の付いた行と
  `//no ketjs on` 〜 `//no ketjs off` の間（印刷用の図）が除かれ、Web 版だけになる。
- `tools/ketjs-build.mjs` は `.cdy` を直接読む（中の `figures.cs` を使う）。
- Cinderella がなくても、描画スクリプトを取り出して読んだり、編集して書き戻したりできる。
  書き戻すのは描画スクリプトだけで、作図などほかの中身はそのまま残す。

```bash
node tools/cdy.mjs extract src/math2/ellipse-focus.cdy > ellipse-focus.cs
node tools/cdy.mjs replace src/math2/ellipse-focus.cdy ellipse-focus.cs
```

- cdy は zip なので、git の差分では中身が見えない。変更を確かめるときは `extract` で取り出して比べる。
- 元の cdy は担当教員の授業資料フォルダにあり、そちらは変えていない。これからはこのリポジトリの cdy を正本にする。
- 新規作成の 3 本（直線の傾きと切片、直線の平行と垂直、円の方程式）は元の cdy がないので `.cs` のまま。

### 曲線や線分の上を動く点（Putoncurve）
`Putoncurve` / `Putonseg` / `Putonline` で作る点も、HTML 版で宣言して動かせるようにしている。
初期位置は、先に `Putpoint("P",[2,2],P.xy);` と書いておくとその位置になる（スライダーのつまみも同じ）。
曲線は折れ線で近似されているので、値を表示するときは式の上に乗せ直すとよい（例: [src/math2/circle-equation.cs](src/math2/circle-equation.cs)）。

### 練習問題
問題の型を選ぶと数値をランダムに変えた問題が出て、答え合わせのあとに正誤・解き方・グラフ（正解は実線、入力した答えは破線）を表示する。
正解数はページを開いている間だけ数え、保存も送信もしない。

- ページの定義: `src/math2/drill-*.json`（見出し、科目、並び順、出す型）
- 問題の生成・判定・解き方: [tools/drill/core.mjs](tools/drill/core.mjs)。難しさ（基本・試験）の数値の範囲は `LEVELS` の 1 か所にまとめてある
- 画面: [tools/drill/ui.js](tools/drill/ui.js)。ボタンと入力欄は普通の HTML で、グラフだけ CindyJS で描く（`cdy.evokeCS` で変数 `Shapes` を渡す）
- 検証: `node tools/drill-check.mjs` で、シードを固定した大量の問題について、答えが問題の条件を満たすか、判定が正しいかを確かめる

### 数学2の検証
`bash tools/check-math2.sh` で、数学2の教材の値（接する C で判別式が 0、PF₁ + PF₂ = 2a など）と練習問題の自己テストを照合する（CI でも実行する）。

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
  点の初期位置は、Cinderella でスクリプトが初めて点を作るときと同じにする
  （`Putpoint` は第 2 引数、`Slider` のつまみは両端の中点）。
- 表示範囲も `.cdy` がないため、`Setwindow` の範囲とスライダー全体が入る範囲に余白 0.5 を足して決めている。
- 入力欄は `Textedit(番号)` で読める（`Text番号` を入力欄として宣言する）。Enter を押すと描き直す。
  入力欄の初期値は空なので、既定値はスクリプト側で入れる（例: [src/nyquist_g4.cs](src/nyquist_g4.cs) の「1. 伝達関数 G(s) の定義」）。
- `subsedit` など Cinderella 専用の機能は、HTML 版では動かない。
- `Hyperbolaplot` に `"Asy=do"`（漸近線）を付けると、HTML 版では例外が出て白紙になる。漸近線は `Lineplot` で別に描く。
- CindyJS の設定 `angleUnit: "°"` のため、`arccos` などの値は角度として扱われる。数として計算に使うときは `re()` を通す。
- KeTCindy の `Strictmove` は、マウスから離れた位置に動かされた点を元に戻す。`--eval` で点を動かすときは
  `P.xy=[3,0]; Pposition=P.xy;` のように位置の変数も書き換える。
- 最終確認は Cinderella の KeTJS ボタンで出した HTML でも行うこと
  （`File > Export to CindyJS` → KeTJS / KeTJSoff）。

参考: [KeTCindyJS の使い方](https://ctan.csail.mit.edu/graphics/ketcindy/ketcindyfolder/work/samples/s16ketJSmisc/howtouseketcindyjsE.txt)

## 校章について

`assets/kousho.svg` は弓削商船高等専門学校の校章で、著作権は同校に帰属する。
校章の使用は同校の教育活動に関わる資料に限られる。
