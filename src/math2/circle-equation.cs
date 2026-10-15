// @title 円の方程式
// @category 数学2
// @unit 5 円の式
// @print 【円の方程式（標準形）】【円の方程式（一般形）】
// @lead 中心 (a, b)、半径 r の円の上の点 P は、中心からの距離がいつも r なので (x − a)² + (y − b)² = r² を満たす。展開すると一般形 x² + y² + lx + my + n = 0 になる。
// @step 円の上の点 P を動かし、CP がいつも半径 r に等しいことを確かめる。
// @step 中心 C を動かし、標準形の a・b と、一般形の l・m（x・y の係数）がどう変わるかを見る。
// @step スライダーで半径 r を変え、一般形の定数項 n = a² + b² − r² が変わることを確かめる。
// @check 円 x² + y² − 4x + 6y − 3 = 0 の中心と半径を求めよ。 | 平方完成すると (x − 2)² + (y + 3)² = 16。中心 (2, −3)、半径 4
//
// 新規作成（対応する cdy なし）
Ketinit();
Setax(["a","x","e","y","n","O","sw"]);
Setpt(3);
Setwindow([-7,7],[-5,5]);
Putpoint("C",[1,-2],[round(C.x),round(C.y)]);
// 半径 r は 0.5〜4（0.5 刻み）
Putpoint("SR",[3,-5.8],SR.xy);
Slider("SR",[0.5,-5.8],[4,-5.8]);
rr=round(2*SR.x)/2;
Letter([0.3,-5.8],"w","r");
Circledata("1",[C.xy,C.xy+[rr,0]]);
Putpoint("P",[3,0],P.xy);
Putoncurve("P","cr1",[]);
// 曲線は折れ線で近似されているので、円の式の上に正確に乗せ直す
if(|P.xy-C.xy|>10^(-9), P.xy=C.xy+rr*(P.xy-C.xy)/|P.xy-C.xy|);
Listplot("cp",[C,P],["Color=red"]);
Pointdata("C",C,["Size=4"]);
Letter(C,"sw","C");
Pointdata("P",P,["Size=5","Color=red"]);
Letter(P,"ne","P");

Fmt(v):=(regional(s); s=format(v,3); if(abs(v-round(v))<10^(-9), s=text(round(v))); s);
// 符号つきの項（先頭でなければ「+ 3x」「− 3x」の形）。係数 0 の項は書かない
Term(c,v,first):=(
  regional(s,a);
  s="";
  a=abs(c);
  if(abs(c)>10^(-9),
    if(c<0, s=if(first,"−","− "), s=if(first,"","+ "));
    if(v=="" % abs(a-1)>10^(-9), s=s+Fmt(a));
    s=s+v+" ";
  );
  s;
);
Sq(v,c):=(regional(s); s=v; if(c>0, s="("+v+" − "+Fmt(c)+")"); if(c<0, s="("+v+" + "+Fmt(-c)+")"); s+"²");
aa=C.x; bb=C.y;
nn=aa^2+bb^2-rr^2;
Std=Sq("x",aa)+" + "+Sq("y",bb)+" = "+Fmt(rr^2);
Gen="x² + y² "+Term(-2*aa,"x",false)+Term(-2*bb,"y",false)+Term(nn,"",false)+"= 0";
//Readout(["標準形: "+Std, "一般形: "+Gen, "CP = "+format(|P.xy-C.xy|,3)+"（r = "+Fmt(rr)+"）"]); //only ketjs

Windispg();
