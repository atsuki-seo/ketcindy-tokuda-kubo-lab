// @title ナイキスト軌跡
Ketinit();
// ==========================================
// 【曲線の倍率】
// ==========================================
Slider("D",[0.025,4],[9,4]);
K = 5*D.x;
// ==========================================
// 【1. 伝達関数 G(s) の定義】
// ==========================================
Text0.xy=[2,-4.6];
Expr([[1.68,-4.6],"w","G(s)="]);
// 入力欄の式で G(s) を定義する。掛け算の * は省略してよい（例: 4/((s+1)(s+2))）
Gdefault = "1/((s+1)*(s+2)*(s+3)*(s+4))";
// 入力欄の * を省略した掛け算に * を補う（")(" "2s" "s(" など）
Insertmul(str):=(
 regional(out,c,prev);
 out = ""; prev = "";
 forall(1..length(str),
   c = substring(str,#-1,#);
   if(c != " ",
     if(prev != "" & indexof(")s0123456789",prev) > 0 & indexof("(s",c) > 0,
       out = out + "*";
     );
     out = out + c;
     prev = c;
   );
 );
 out;
);
str = Textedit(0);
if(!isstring(str), str = "");
// 入力欄が空のときは既定の式を使う（HTML 版では入力欄にも既定の式を入れる）
//if(str == "", Text0.currenttext = Gdefault); //only ketjs
if(str == "", str = Gdefault);
Gstr = Insertmul(str);
// 式として読めないときは既定の式で描き、そのことを表示する
Gtry(s) := parse(Gstr);
tmp = Gtry(0.37 + 0.71*i);
Gok = false;
if(isreal(re(tmp)) & isreal(im(tmp)), Gok = true);
if(!Gok, Gstr = Gdefault);
parse("G(s):=" + Gstr + ";");
// ==========================================
// 【画面の設定】
// ==========================================
Setwindow([-5,5],[-5,5]);
Setax(["l","Re","e","Im","n","O","sw"]);

//G(s) := 4 / ((1+s)*(2+s));
// ==========================================
// 【2. 周波数応答の定義】
// ==========================================
// s = jω
Gjw(w) := G(i*w);
// 実部
ReVal(w) := re(Gjw(w));
// 虚部
ImVal(w) := im(Gjw(w));
// ゲイン
Gain(w) := abs(Gjw(w));
// 位相差 [rad]
Phaserad(w) := arctan2(Gjw(w));
// 位相差 [deg]
Phasedeg(w) := Phaserad(w) * 180 / pi;

// ==========================================
// 【3. 計算と出力】
// ==========================================
w = 1;
compVal = Gjw(w);
rVal = ReVal(w);
iVal = ImVal(w);
println("======================================");
println("    【 周波数応答の計算結果 】");
println("======================================");
println("  設定角周波数 (w) : " + w + " [rad/s]");
println("--------------------------------------");
println("  複素数 G(jw)    : "
       + format(rVal,6)
       + " + "
       + format(iVal,6)
       + " j");
println("  実部 Re[G(jw)]  : "
       + format(rVal,6));
println("  虚部 Im[G(jw)]  : "
       + format(iVal,6));
println("--------------------------------------");
println("  位相差 (rad)    : "
       + format(Phaserad(w),6)
       + " rad");
println("======================================");

// ==========================================
// 【4. ゲインと位相差】
// ==========================================
magPlot = Gain(w);
phasePlot = Phasedeg(w);
// ==========================================
// 【5. ナイキスト軌跡の座標リストを作成】
// ==========================================
ptList = [];

// ------------------------------------------
// ω = 0 ～ 15
// 0.01刻みで計算
// ------------------------------------------
forall(0..1500,k,
 // 角周波数
 wk = k / 100;

 // G(jω)の実部・虚部
 rx = ReVal(wk);
 iy = ImVal(wk);

 // ========================================
 // 正常な実数の場合のみ追加
 // ========================================
 if(isreal(rx) & isreal(iy),
   // 画面範囲内の場合のみ追加
   if(abs(rx) <= 3 & abs(iy) <= 3,
     ptList = append(
       ptList,
       [rx,iy]
     );
   );
 );
);
// ==========================================
// 【6. ナイキスト軌跡を描画】
// ==========================================
// 座標を K 倍してから青い線で描画
ptList=apply(ptList,K*#);
Listplot(
 "phasor",
 ptList,
 ["dr,4","Color=blue"]
);
// ==========================================
// 【9. スライダーバー】
// ==========================================
// ω = 0.1 ～ 5
Slider(
 "C",
 [0.1,-2.8],
 [5,-2.8]
);

// ==========================================
// 【10. スライダーからωを取得】
// ==========================================
wSlider = C.x;

// ==========================================
// 【11. スライダーのωに対応するG(jω)】
// ==========================================
// 実部
xSlider = ReVal(wSlider);
// 虚部
ySlider = ImVal(wSlider);

// ==========================================
// 【12. 青い軌跡上を動く赤い点】
// ==========================================
// 赤い点の座標
pSlider = [xSlider,ySlider];
Putpoint("AA",[10,10]);
AA.xy=pSlider*K;
// 原点と赤い点を結ぶ線分（G(jω) を表すベクトル）
Listplot("OA",[[0,0],pSlider*K],["Color=red"]);

//println(sgsliderPoint);
//pointdata("1",AA,["Size=5","Color=red"]);
// ==========================================
// 【13. スライダー位置のゲイン・位相差】
// ==========================================
magSlider = Gain(wSlider);
phaseSlider = Phasedeg(wSlider);
// 文字の行間。HTML 版は画面幅に合わせて図が縮むので、16px で固定して重ならないようにする
dy = 0.3;
//dy = 16*Ketjspx; //only ketjs
// 値の一覧は、縦軸の目盛りの数字（軸の左）と重ならず、軌跡もあまり通らない右上に置く
Letter(
 [0.6,3.4],
 "e",
 "|G(jw)| = " + format(magSlider,2)
);
Letter(
 [0.6,3.4-dy],
 "e",
 "∠G(jw) = " + format(phaseSlider,2) + "°"
);
// スライダーの値（ω は下、K は上に表示）
Letter([2.55,-2.8],"s2","角周波数 ω = " + format(wSlider,2) + " rad/s");
Letter([4.5,4],"n2","曲線の倍率 K = " + format(K,2));

// ==========================================
// 【14. 軌跡の始点（ω = 0）】
// ==========================================
// G(s) が s = 0 で無限大になる場合（1/(s(s+1)) など）は w0 = 0.01 にする
// （0 で割ると NaN になり、NaN は自分自身と等しくならないことで判定する）
w0 = 0;
r0 = ReVal(w0);
if(r0 != r0, w0 = 0.01, if(abs(r0) > 10^6, w0 = 0.01));
crossList = [[w0, ReVal(w0)]];

// ==========================================
// 【15. 座標メモリ（始点を追加）】
// ==========================================
// 曲線は K 倍して描くので、目盛りは「画面上の間隔」で決め、数字（実際の値）を K に合わせて変える。
// 刻みは 1, 2, 5 × 10^n から、画面上の間隔が mingap 以上になる最小のものを選ぶ
// （K を動かしても目盛りは画面内に残り、数字が 0.05 → 0.1 → 0.2 … と切り替わる）
// mingap は HTML 版では 40px にして、狭い画面でも数字どうしが重ならないようにする
mingap = 1;
//mingap = max([1, 40*Ketjspx]); //only ketjs
tmp = 10^floor(log(mingap/K)/log(10));
step = 100*tmp;
forall([10,5,2,1], m, if(K*m*tmp >= mingap, step = m*tmp));
// ラベルは文字列で書く（Htickmark / Vtickmark はリスト中の数値をすべて目盛りの位置として扱う）
// 実軸のラベルは、軸の下だと軌跡と重なるので軸の上（n）に置く
// 始点の値と重なる実軸の目盛りは省く（始点の値は別に表示する）
memori  = [];
memori2 = [];
forall(1..floor((XMAX-0.5)/(K*step)), n,
 forall([n*step, -n*step], u,
   if(min(apply(crossList, abs(K*u - K*#_2))) >= mingap,
     memori = concat(memori, [K*u, "n2", format(u,4)]);
   );
 );
);
forall(1..floor((YMAX-0.5)/(K*step)), n,
 forall([n*step, -n*step], u,
   memori2 = concat(memori2, [K*u, "w3", format(u,4)]);
 );
);
forall(crossList, cp,
 xc = cp_2;
 memori = concat(memori, [K*xc, "n2", format(xc,4)]);
);
Htickmark(memori);
Vtickmark(memori2);
// −1 の点（ナイキストの安定判別で軌跡との位置関係を見る点）に赤い × を付ける
mr = 0.12;
//mr = 6*Ketjspx; //only ketjs
minusin = (-K >= XMIN);
if(minusin,
 Listplot("m1a", [[-K-mr,-mr],[-K+mr,mr]], ["Color=red","dr,2"]);
 Listplot("m1b", [[-K-mr,mr],[-K+mr,-mr]], ["Color=red","dr,2"]);
);
// 始点に点を打つ
if(length(crossList) > 0,
 Pointdata("cross", apply(crossList, [K*#_2, 0]), ["Size=4","Color=red"]);
);
// 始点の値を画面に表示
forall(1..length(crossList), n,
 Letter(
   [0.6, 3.4-(n+1)*dy],
   "e",
   "始点 = " + format(crossList_n_2,4)
   + "  (w = " + format(crossList_n_1,3) + ")"
 );
);

// 値の一覧の続き。−1 の点が画面外のときと、入力した式を読めなかったときに表示する
nline = length(crossList) + 2;
if(!minusin,
 Letter([0.6, 3.4-nline*dy], "e", "-1 の点は画面外（K を下げると表示）");
 nline = nline + 1;
);
if(!Gok,
 Letter(
   [0.6, 3.4-nline*dy],
   "e",
   "式を読めないため既定の式で表示",
   ["Color=red"]
 );
);

// ==========================================
// 【16. 描画】
// ==========================================
Windispg();
