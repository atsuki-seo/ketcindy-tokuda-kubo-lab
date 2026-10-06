# ketcindy-tokuda-kubo-lab

## Abstract

工学の分野では数式を多用するが，計算結果を求めるだけでは，数式が表現する特性に気づけない場合がある．そこで数式をグラフ化し，特性を視覚的に捉えられるHTML教材を開発する．KeTCindyは，数学教材の作成に必要な機能やコマンドが用意されたツールである．KeTCindyを用いて，弓削商船高等専門学校 情報工学科の専門科目を対象としたアプリケーションを開発している．

## 開発環境

追加の依存は持たず、[Cinderella](https://cinderella.de/) と KeTCindy 標準の機能だけを使う。

- スクリプト: `src/*.cs`（Cinderella の .cdy のスクリプト欄に貼って実行・検証する）
- PDF 出力: KeTCindy 標準の出力機能（TeX 経由）を使う
- HTML 出力: Cinderella の `File > Export to CindyJS` → KeTJS（オンライン）/ KeTJSoff（オフライン）ボタン

参考: [KeTCindyJS の使い方](https://ctan.csail.mit.edu/graphics/ketcindy/ketcindyfolder/work/samples/s16ketJSmisc/howtouseketcindyjsE.txt)
