// @title 直線の平行と垂直
// @category 数学2
// @unit 3 直線の平行と垂直
// @order 1
// @print 【直線の平行と垂直】
// @lead 2直線 ℓ₁: y = m₁x + n₁ と ℓ₂: y = m₂x + n₂ が平行なら m₁ = m₂、垂直なら m₁·m₂ = −1 になることを確かめる。
// @step 点 A・B を動かして直線 ℓ₁ を決める。点 C を動かし、スライダーで ℓ₂ の傾き m₂ を変える。
// @step ℓ₂ を ℓ₁ と平行にしたときの m₁ と m₂ を比べる。
// @step ℓ₂ を ℓ₁ と垂直にしたときの m₁·m₂ の値を読む。
// @check 点 (2, 1) を通り、直線 y = 3x − 1 に平行な直線と垂直な直線を求めよ。 | 平行な直線は傾き 3 なので y − 1 = 3(x − 2) より y = 3x − 5。垂直な直線は傾き −1/3 なので y − 1 = −(1/3)(x − 2) より x + 3y − 5 = 0
//
// 新規作成（対応する cdy なし）
Ketinit();
Setax(["a","x","e","y","n","O","sw"]);
Setpt(3);
Setwindow([-6,6],[-5,5]);
Putpoint("A",[-3,-2],[round(A.x),round(A.y)]);
Putpoint("B",[3,1],[round(B.x),round(B.y)]);
Putpoint("C",[1,3],[round(C.x),round(C.y)]);
if(A.x==B.x, B.x=A.x+1);
m1=(B.y-A.y)/(B.x-A.x);
n1=A.y-m1*A.x;
// m2 は −4〜4。平行・垂直になる値の近くでは、その値に合わせる
Putpoint("S",[1.5,-5.8],S.xy);
Slider("S",[-4,-5.8],[4,-5.8]);
Letter([-4.2,-5.8],"w","m₂");
m2=S.x;
Snap=[m1];
if(abs(m1)>10^(-9), Snap=append(Snap,-1/m1));
forall(Snap, if(abs(m2-#)<0.12 & abs(#)<=4, m2=#; S.x=#));
n2=C.y-m2*C.x;

Lineplot("1",[A,B],["dr,2"]);
Lineplot("2",[C.xy,C.xy+[1,m2]],["dr,2","Color=red"]);
Pointdata("A",A,["Size=4"]); Pointdata("B",B,["Size=4"]); Pointdata("C",C,["Size=4","Color=red"]);
Letter(A,"se","A"); Letter(B,"se","B"); Letter(C,"nw","C");
Letter([5.6,m1*5.6+n1],"n","ℓ₁");

Fmt(v):=(regional(s); s=format(v,3); if(abs(v-round(v))<10^(-9), s=text(round(v))); s);
Kind="";
if(abs(m1-m2)<10^(-9), Kind="ℓ₁ と ℓ₂ は平行（m₁ = m₂）");
if(abs(m1*m2+1)<10^(-9), Kind="ℓ₁ と ℓ₂ は垂直（m₁·m₂ = −1）");
// 垂直のとき、交点に直角の印を付ける
if(abs(m1*m2+1)<10^(-9),
  Xc=(n2-n1)/(m1-m2); Pc=[Xc,m1*Xc+n1];
  u=[1,m1]/|[1,m1]|*0.4; v=[1,m2]/|[1,m2]|*0.4;
  Listplot("rt",[Pc+u,Pc+u+v,Pc+v],["Color=red"]);
);
//Readout(["m₁ = "+Fmt(m1), "m₂ = "+Fmt(m2), "m₁·m₂ = "+Fmt(m1*m2), Kind]); //only ketjs

Windispg();
