#!/usr/bin/env bash
# 数学2の教材と練習問題を、ヘッドレス Chrome で開いて値を照合する（CI で実行する。ローカルでも実行できる）。
# 先に build/html へビルドしておく（README の「使い方」）。
# ketjs-run.mjs は --eval をすべて実行してから --assert を照合するので、点を動かして確かめるときは 1 回ずつ分けて呼ぶ。
# 点を動かすときは「点.xy=...; 点position=点.xy;」と書く（KeTCindy の Strictmove が、マウスから離れた点を元の位置に戻すため）。
set -euo pipefail
cd "$(dirname "$0")/.."
H=build/html/math2
mkdir -p build/shots
run() {
  local page=$1
  shift
  node tools/ketjs-run.mjs "$H/$page.html" --shot "build/shots/check-$page.png" "$@"
}

# 2次曲線の接線: 接する C で判別式が 0、共有点が 1 個（楕円・放物線・双曲線）
run conic-tangent --assert '=Disc(2*sqrt(5))|0|1e-9' --assert '=Disc(-2*sqrt(5))|0|1e-9' --assert '=Disc(0)|80|1e-9'
run conic-tangent --eval 'C.xy=[4.45,-7]; Cposition=C.xy;' --assert '=Npts|1|0' --assert '=Dv|0|0'
run conic-tangent --eval 'Ch=[2]; C.xy=[-2.05,-7]; Cposition=C.xy;' --assert '=Npts|1|0' --assert '=C.x|-2|1e-9'
run conic-tangent --eval 'Ch=[3]; C.xy=[1.13,-7]; Cposition=C.xy;' --assert '=Npts|1|0' --assert '=C.x|1.118034|1e-6'

# 内分点と外分点: A(0,1), B(3,3) を 2:1 に内分 → (2, 7/3)、外分 → (6, 5)
run section-point --assert '=P_1|2|1e-9' --assert '=P_2|2.333333|1e-6'
run section-point --eval 'Ch=[2];' --assert '=P_1|6|1e-9' --assert '=P_2|5|1e-9'

# 直線の傾きと切片: はじめは y = 2x + 1
run line-slope-intercept --assert '=aa|2|0' --assert '=bb|1|0'

# 直線の平行と垂直: m₂ を −2 の近くにすると垂直に合わせる
run line-parallel-perpendicular --assert '=m1|0.5|1e-9'
run line-parallel-perpendicular --eval 'S.xy=[-1.95,-5.8]; Sposition=S.xy;' --assert '=m1*m2|-1|1e-9'

# 直線に関して対称な点: ℓ: x − y − 1 = 0、P(5,1) → Q(2,4)（プリントの例題3）
run line-symmetric-point --assert '=Q_1|2|1e-9' --assert '=Q_2|4|1e-9'
run line-symmetric-point --eval 'P.xy=[3,0];Pposition=P.xy;L1.xy=[0,1];L1position=L1.xy;L2.xy=[2,3];L2position=L2.xy;' \
  --assert '=Q_1|-1|1e-9' --assert '=Q_2|4|1e-9'

# 円の方程式: 中心 (1,−2)、半径 3 → x² + y² − 2x + 4y − 4 = 0。P は円の上
run circle-equation --assert '=dist(P.xy,C.xy)-rr|0|1e-9' --assert '=nn|-4|1e-9'

# 円を伸ばして楕円へ: P は楕円の上
run circle-to-ellipse --assert '=P_1^2/aa^2+P_2^2/bb^2|1|1e-9'

# 楕円と焦点: a = 3, b = 2 → c = √5、PF₁ + PF₂ = 6
run ellipse-focus --assert '=cc|2.236068|1e-6' --assert '=d1+d2|6|1e-9'

# 双曲線と漸近線: a = 2, b = 1.5 → |PF₁ − PF₂| = 2a = 4（上下に開くときは 2b = 3）
run hyperbola-asymptote --assert '=cc|2.5|1e-9' --assert '=abs(d1-d2)|4|1e-9'
run hyperbola-asymptote --eval 'Ch=[2];' --assert '=abs(d1-d2)|3|1e-9'

# 放物線の焦点と準線: PF = PH
run parabola-focus --assert '=PF-PH|0|1e-9' --assert '=P.y^2-4*pp*P.x|0|1e-9'

# 不等式の表す領域: T(1,1) は y > 3 を満たさない。連立不等式で T(2,1) は満たす
run inequality-region --assert '=if(Ok,1,0)|0|0'
run inequality-region --eval 'Ch=[5]; T.xy=[2,1]; Tposition=T.xy;' --assert '=if(Ok,1,0)|1|0'

# ベクトルの和・差・実数倍: a = (3,1), b = (−1,2) → a + b = (2,3)、a − b = (4,−1)
run vector-operations --assert '=r_1|2|0' --assert '=r_2|3|0'
run vector-operations --eval 'Ch=[2];' --assert '=r_1|4|0' --assert '=r_2|-1|0'

# 線形結合: a = (2,1), b = (1,2), c = (4,5) → m = 1, n = 2 で重なる
run linear-combination --eval 'M.xy=[2,1];Mposition=M.xy;N.xy=[2,4];Nposition=N.xy;' \
  --assert '=mm|1|0' --assert '=nn|2|0' --assert '=dist(s,c)|0|1e-9'

# 2つのベクトルのなす角と内積: a = (4,−2), b = (2,4) は垂直。b = (x, 4) は x = −8 で平行
run vector-angle-dot --assert '=Dot|0|0' --assert '=Deg|90|1e-9'
run vector-angle-dot --eval 'Ch=[2]; X.xy=[-8,-4.7]; Xposition=X.xy;' --assert '=Cross|0|0'

# 練習問題: 型・難しさごとに、正しい答えが正解・違う答えが不正解になり、正解数を数えられる
for d in drill-point-line drill-circle drill-conic drill-vector; do
  run "$d" --eval 'javascript("drillSelfTest()");' --assert '=DrillSelfTest|1|0'
done
