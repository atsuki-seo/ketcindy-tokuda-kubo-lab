// @title 直線の傾きと切片
// @category 数学2
// @unit 2 直線の式
// @print 【直線の傾きと切片】
// @lead 直線 y = ax + b の a（傾き）を変えると直線の傾き方が、b（y 切片）を変えると y 軸と交わる位置が変わることを確かめる。
// @step スライダーで a を変え、x が 1 増えると y が a だけ増える（a が負なら減る）ことを、直角三角形の縦の長さで確かめる。
// @step スライダーで b を変え、直線が y 軸と交わる点 (0, b) が動くことを確かめる。
// @step a = 0 にすると、x 軸に平行な直線 y = b になることを確かめる。
// @check 2点 (1, 3)、(3, 7) を通る直線の傾きと y 切片を求めよ。 | 傾き a = (7 − 3)/(3 − 1) = 2。y = 2x + b に (1, 3) を代入して b = 1。y = 2x + 1（傾き 2、y 切片 1）
//
// 新規作成（対応する cdy なし）
Ketinit();
Setax(["a","x","e","y","n","O","sw"]);
Setpt(3);
Setwindow([-6,6],[-5,5]);
// a は −3〜3、b は −4〜4。どちらも 0.5 刻み
Putpoint("SA",[-0.5,-5.8],SA.xy);
Putpoint("SB",[4.875,-5.8],SB.xy);
Slider("SA",[-3,-5.8],[0,-5.8]);
Slider("SB",[3,-5.8],[6,-5.8]);
aa=round(2*(SA.x+1.5)*2)/2;
bb=round(2*(SB.x-4.5)*8/3)/2;
Letter([-3.2,-5.8],"w","a");
Letter([2.8,-5.8],"w","b");

Fmt(v):=(regional(s); s=format(v,2); if(abs(v-round(v))<10^(-9), s=text(round(v))); s);
Plotdata("1",Fmt(aa)+"*x+("+Fmt(bb)+")","x=[-6,6]",["Color=red"]);
// y 切片
Pointdata("b",[0,bb],["Size=5","Color=red"]);
Letter([0,bb],"w2","(0, b)");
// x が 1 増えたときの y の増え方（x = 1 から 2 まで）
X0=1; Y0=aa*X0+bb;
Listplot("run",[[X0,Y0],[X0+1,Y0]],["Color=blue","dr,2"]);
Listplot("rise",[[X0+1,Y0],[X0+1,Y0+aa]],["Color=blue","dr,2"]);
Letter([X0+0.5,Y0],"s","1");
if(abs(aa)>0, Letter([X0+1,Y0+aa/2],"e","a"));

Bstr="+ "+Fmt(bb);
if(bb<0, Bstr="− "+Fmt(-bb));
if(bb==0, Bstr="");
Astr=Fmt(aa)+"x ";
if(aa==1, Astr="x ");
if(aa==-1, Astr="−x ");
if(aa==0, Astr="");
if(aa==0 & bb==0, Bstr="0");
if(aa==0 & bb<0, Bstr="−"+Fmt(-bb));
if(aa==0 & bb>0, Bstr=Fmt(bb));
//Readout(["y = "+Astr+Bstr, "傾き a = "+Fmt(aa), "y 切片 b = "+Fmt(bb)]); //only ketjs

Windispg();
