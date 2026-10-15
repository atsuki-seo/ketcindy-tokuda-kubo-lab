#!/usr/bin/env node
// KeTCindyJS の HTML 出力（KeTJS ボタンの処理）を、Cinderella なしで再現するビルドスクリプト。
//
// 移植元: ketcindylibbasic3r.cs の Mkketcindyjs / Extractfun / Extractall
//   1. スクリプトから呼び出している関数名を拾う
//   2. ketcindyjs/*list.txt の依存表をたどり、必要な KeTCindy 関数だけを ketlib から抜き出す
//   3. csinit（関数群）+ csdraw（利用者スクリプト）+ CindyJS({geometry...}) を 1 つの HTML にする
//
// 使い方: node tools/ketjs-build.mjs src/nyquist_g4.cs [出力ディレクトリ(既定 build/html)]
//         node tools/ketjs-build.mjs src/math2/ellipse-focus.cdy   （.cdy なら中の描画スクリプト figures.cs を読む）
// 環境変数: KETCINDY_HOME（既定 ~/ketcindy）
//
// ページの見出しは、スクリプト中の「// @title 見出し」行から取る（なければファイル名）。
// 科目は「// @category 科目名」行で指定し（必須）、出力ディレクトリの下の科目のディレクトリに書き出す
// （例: src/nyquist_g4.cs → build/html/control/nyquist_g4.html）。科目名は tools/site.mjs の CATEGORIES から選ぶ。
// どちらもコメント行なので Cinderella 上の動作には影響しない。
//
// 教材ページの構成は、次のコメント行から作る（どれも省略できる。@step と @check は複数書ける）。
//   // @unit 7 楕円の式            単元の番号と名前（授業プリントの単元）。一覧ページはこの番号の順に並ぶ
//   // @order 2                     同じ単元に教材が複数あるときの順（小さい順。既定 0）
//   // @print 【楕円と焦点】         対応するプリントの見出し
//   // @lead 楕円上のどこに P があっても PF₁+PF₂ は一定になる     この教材でわかること
//   // @step P を楕円上で一周させ、和を観察する                  動かしてみよう
//   // @check x²/9+y²/6=1 の2焦点は？ | (±√3, 0)                 確かめよう（| の後ろが答え）
//   // @switch Ch 楕円|放物線|双曲線  図を切り替えるボタン。押すと Ch=[1] / Ch=[2] / ... になる
//                                   （csinit で Ch=[1] にするので、スクリプトの Ch=[...] の行には「//no ketjs」を付ける）
// 値の表示: スクリプトで Readout(["PF₁ = "+format(d1,3), ...]) を呼ぶと、キャンバスの下に値を並べて表示する
// （HTML 版にだけある関数なので、呼び出す行は「//...//only ketjs」にする）。
//
// HTML 版では、描画のたびに Ketjspx（画面上の 1px が何座標分か）を計算してからスクリプトを実行する。
// キャンバスは画面幅に合わせて縮むが文字の大きさは変わらないので、文字を並べる間隔は
// 「//dy=16*Ketjspx; //only ketjs」のように px で指定すると、狭い画面でも重ならない。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readCdyScript } from "./cdy.mjs";
import {
  CATEGORIES,
  INDEX_TITLE,
  breadcrumb,
  categoryByName,
  copyAssets,
  copyCindyJs,
  KETCINDY_SCRIPTS,
  docFoot,
  docHead,
  escapeHtml,
  headCommon,
  pageMeta,
  pagerSlot,
  pageTitle,
  unitTag,
} from "./site.mjs";

const SCRIPTS = KETCINDY_SCRIPTS;
const LIBNAMES = ["basic1", "basic2", "basic3", "3d"];

const [srcPath, outDir = "build/html"] = process.argv.slice(2);
if (!srcPath) {
  console.error("usage: ketjs-build.mjs <script.cs> [outDir]");
  process.exit(2);
}
if (!existsSync(SCRIPTS)) {
  console.error(`KeTCindy が見つかりません: ${SCRIPTS}\nKETCINDY_HOME を設定するか README の手順で導入してください。`);
  process.exit(2);
}

const readLines = (p) => readFileSync(p, "utf8").split(/\r?\n/);

// "no ketjs" / "only ketjs" マーカーによる行フィルタ（Mkketcindyjs の forall 部分と同じ規則）
function filterKetjs(lines) {
  const out = [];
  let ketflg = false;
  let onlyflg = false;
  for (const line of lines) {
    if (line.includes("only ketjs on")) onlyflg = true;
    if (line.includes("only ketjs off")) onlyflg = false;
    if (line.includes("no ketjs")) {
      if (line.includes("no ketjs on")) ketflg = true;
      if (line.includes("no ketjs off")) ketflg = false;
      continue;
    }
    if (ketflg) continue;
    const t = line.replace(/\s/g, "");
    if (!t.startsWith("//")) {
      out.push(line);
      continue;
    }
    const at = line.indexOf("only ketjs");
    if (at >= 0 || onlyflg) {
      if (/only ketjs (on|off)/.test(line)) continue;
      let body = line.trimStart().slice(2);
      const cut = body.indexOf("only ketjs");
      if (cut >= 0) body = body.slice(0, cut);
      if (body.trim()) out.push(body);
    }
  }
  return out;
}

// Extractfun: 文字列リテラルを除いた上で NAME( の NAME を集める
function extractFunNames(lines) {
  const names = [];
  for (const line of lines) {
    const code = line.replace(/"[^"]*"/g, "");
    for (const m of code.matchAll(/([A-Za-z_]\w*)\(/g)) {
      if (!names.includes(m[1])) names.push(m[1]);
    }
  }
  return names;
}

// 依存表: name,lib,from,upto,dep1,dep2,...
const DL = new Map();
for (const lib of LIBNAMES) {
  for (const line of readLines(join(SCRIPTS, "ketcindyjs", `${lib}list.txt`))) {
    const f = line.split(",").map((s) => s.trim());
    if (f.length >= 4 && f[0]) DL.set(f[0], f);
  }
}
const ignore = readLines(join(SCRIPTS, "ketcindyjs", "ignoredfun.txt"))
  .map((s) => s.replace(/\s/g, ""))
  .filter((s) => s && !s.startsWith("//"));
const isIgnored = (name) =>
  ignore.some((p) => (p.includes("*") ? name.startsWith(p.slice(0, p.indexOf("*"))) : name === p));

// Extractall: 依存を深さ優先でたどる
const out = [];
const seen = new Set();
function extractAll(name) {
  const e = DL.get(name);
  if (!e || isIgnored(name) || seen.has(name)) return;
  seen.add(name);
  out.push(e);
  for (const dep of e.slice(4)) extractAll(dep);
}

// .cdy（Cinderella の作図ファイル）なら、中の描画スクリプトを読む
const srcLines = srcPath.endsWith(".cdy") ? readCdyScript(srcPath).split(/\r?\n/) : readLines(srcPath);
const srcName = basename(srcPath).replace(/\.(cs|cdy)$/, "");
const tags = (name) =>
  srcLines.map((l) => l.match(new RegExp(`^\\s*//\\s*@${name}\\s+(.+?)\\s*$`))?.[1]).filter(Boolean);
const tag = (name) => tags(name)[0];
const title = tag("title") ?? srcName;
const categoryName = tag("category");
const category = categoryByName(categoryName);
if (!category) {
  const known = CATEGORIES.map((c) => c.name).join("、");
  console.error(
    categoryName
      ? `科目「${categoryName}」は tools/site.mjs の CATEGORIES にありません（${known}）。`
      : `${srcPath} に「// @category 科目名」の行がありません（科目: ${known}）。`,
  );
  process.exit(2);
}
// 教材ページの構成（単元・説明・操作・確かめ・図の切り替え）
const unitMatch = tag("unit")?.match(/^(\d+)\s*(.*)$/);
const page = {
  unit: unitMatch?.[1],
  unitName: unitMatch?.[2],
  order: tag("order"),
  print: tag("print"),
  lead: tag("lead"),
  steps: tags("step"),
  checks: tags("check").map((c) => {
    const at = c.indexOf("|");
    return at < 0 ? [c, ""] : [c.slice(0, at).trim(), c.slice(at + 1).trim()];
  }),
};
const switchMatch = tag("switch")?.match(/^([A-Za-z]\w*)\s+(.+)$/);
const switcher = switchMatch && { name: switchMatch[1], labels: switchMatch[2].split("|").map((s) => s.trim()) };
// 教材ページは科目のディレクトリの下に置くので、assets/ などは 1 つ上を参照する
const ROOT = "../";
const drawLines = filterKetjs(srcLines);
for (const fn of extractFunNames(drawLines)) extractAll(fn);

const libLines = Object.fromEntries(
  LIBNAMES.map((n) => [n, readLines(join(SCRIPTS, "ketlib", `ketcindylib${n}r.cs`))]),
);
const initLines = [];
for (const [, lib, from, upto] of out) {
  const key = LIBNAMES.find((n) => lib.includes(n));
  initLines.push(...filterKetjs(libLines[key].slice(Number(from) - 1, Number(upto))));
}
initLines.push("Ketcindyjsfigure=0;", "Ketcindyjsscale=1;");
// KeTCindy の Putoncurve(pn,crv) は小文字の putoncurve を呼んでいて、HTML 版では未定義の関数になる
for (let i = 0; i < initLines.length; i++) {
  initLines[i] = initLines[i].replace(/^(Putoncurve\(pn,crv\):=)putoncurve\(/, "$1Putoncurve(");
}
if (switcher) initLines.push(`${switcher.name}=[1];`);
// Readout(["名前 = 値", ...]): キャンバスの下に値を並べて表示する（HTML 版だけの関数）
const usesReadout = /\bReadout\(/.test(filterKetjs(srcLines).join("\n"));
if (usesReadout) {
  initLines.push(
    'Readout(list):=(regional(s); s=""; forall(list, if(s!="", s=s+unicode("001f")); s=s+#;); javascript("ketReadout(`"+s+"`)"););',
  );
}

// geometry: Cinderella の作図要素に相当する部分。スクリプトが前提とする要素を宣言する。
// SW/NE は Setwindow、Text0 は Textedit(0,...) が参照する。
// JS 版の Putpoint / Slider は点を作らず既存の点を動かすだけなので（createpoint は no ketjs 区間）、
// Cinderella では作図として存在する点を、スクリプトの記述から推定して Free 点として宣言する。
// 点の初期位置は、Cinderella でスクリプトが初めて点を作るときの位置に合わせる
// （Putpoint は第 2 引数、Slider はつまみを両端の中点、"A-C-B" 形式の両端はそれぞれの端）。
// Slider より前に同じ名前の Putpoint があれば、そちらの位置を優先する（Cinderella でも先に作った点がつまみになる）。
const drawCode = drawLines.join("\n");
const num = "\\s*(-?[\\d.]+)\\s*";
const pair = `\\[${num},${num}\\]`;
const toPair = (a, b) => [Number(a), Number(b)];
const pointNames = new Set();
const pointPos = new Map();
const sliderEnds = [];
// Putoncurve / Putonseg / Putonline の点も、HTML 版では作られないので宣言する
// （初期位置は先に書いた Putpoint があればその位置、なければ原点。曲線や線分の上へは描画のときに移る）。
for (const m of drawCode.matchAll(/\b(?:Putpoint|Slider|Putoncurve|Putonseg|Putonline)\(\s*"([^"]+)"/g)) {
  for (const n of m[1].split("-")) pointNames.add(n);
}
for (const m of drawCode.matchAll(new RegExp(`\\bPutpoint\\(\\s*"([^"]+)"\\s*,\\s*${pair}`, "g"))) {
  if (!pointPos.has(m[1])) pointPos.set(m[1], toPair(m[2], m[3]));
}
for (const m of drawCode.matchAll(new RegExp(`\\bSlider\\(\\s*"([^"]+)"\\s*,\\s*${pair}\\s*,\\s*${pair}`, "g"))) {
  const [p1, p2] = [toPair(m[2], m[3]), toPair(m[4], m[5])];
  const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const names = m[1].split("-");
  const pos = names.length === 3 ? [p1, mid, p2] : [mid];
  // つまみの位置は、先に Putpoint("C",[x,y],C.xy) と書いておけばその位置から始まる
  names.forEach((n, i) => {
    if (!pointPos.has(n)) pointPos.set(n, pos[i]);
  });
  sliderEnds.push(p1, p2);
}

// 表示範囲: Setwindow の範囲とスライダー全体が入るようにし、軸のラベル（Im など）が切れないよう余白を足す。
// Cinderella では作図画面の表示範囲が KeTJS に引き継がれるが、ここでは .cdy がないのでスクリプトから決める。
const win = drawCode.match(new RegExp(`\\bSetwindow\\(\\s*${pair}\\s*,\\s*${pair}`));
const [xmin, xmax, ymin, ymax] = win ? [1, 2, 3, 4].map((i) => Number(win[i])) : [-5, 5, -5, 5];
const VIEW_MARGIN = 0.5;
const view = {
  left: Math.min(xmin, ...sliderEnds.map((p) => p[0])) - VIEW_MARGIN,
  right: Math.max(xmax, ...sliderEnds.map((p) => p[0])) + VIEW_MARGIN,
  bottom: Math.min(ymin, ...sliderEnds.map((p) => p[1])) - VIEW_MARGIN,
  top: Math.max(ymax, ...sliderEnds.map((p) => p[1])) + VIEW_MARGIN,
};
const textNos = new Set([...drawCode.matchAll(/\bText(\d+)\b/g)].map((m) => m[1]));
for (const m of drawCode.matchAll(/\bTextedit\(\s*(\d+)/g)) textNos.add(m[1]);

const geometry = [
  `{name: "SW", type: "Free", pos: [-5.0, -5.0, 1.0], color: [1.0,1.0,1.0], labeled: false, size: 2.0, border: false }`,
  `{name: "NE", type: "Free", pos: [5.0, 5.0, 1.0], color: [1.0,1.0,1.0], labeled: false, size: 2.0, border: false }`,
  ...[...pointNames].map((n) => {
    const [x, y] = pointPos.get(n) ?? [0, 0];
    return `{name: "${n}", type: "Free", pos: [${x}, ${y}, 1.0], color: [1.0,0.0,0.0], labeled: false, size: 3.0, border: true }`;
  }),
  ...[...textNos].map(
    (n) => `{name: "Text${n}", type: "EditableText", pos: [0.0, -4.0, 1.0], text: "", minwidth: 220 }`,
  ),
];

// キャンバスの基準サイズ（KeTJS の既定値）。PC ではこの大きさで表示し、
// 狭い画面では縦横比を保ったまま縮める（assets/site.css の .stage を参照）。
const CANVAS_W = 742;
const CANVAS_H = 526;
const draggable = pointNames.size > 0;

// 図の切り替えボタン（押すと CindyScript の変数を [番号] にして描き直す）
const switchHtml = switcher
  ? `\n  <div class="switch" role="group" aria-label="図の切り替え">\n` +
    switcher.labels
      .map(
        (l, i) =>
          `    <button type="button" data-switch="${escapeHtml(switcher.name)}=[${i + 1}];" aria-pressed="${i === 0}">${escapeHtml(l)}</button>`,
      )
      .join("\n") +
    `\n  </div>`
  : "";
const switchScript = switcher
  ? `
document.querySelectorAll("[data-switch]").forEach(function (b) {
  b.addEventListener("click", function () {
    document.querySelectorAll("[data-switch]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
    cdy.evokeCS(b.getAttribute("data-switch"));
  });
});`
  : "";
const readoutScript = usesReadout
  ? `
// CindyScript の Readout([...]) から呼ばれる。値を U+001F 区切りで受け取り、キャンバスの下に並べる。
var ketReadoutLast = "";
function ketReadout(s) {
  if (s === ketReadoutLast) return;
  ketReadoutLast = s;
  var ul = document.getElementById("readout");
  if (!ul) return;
  ul.textContent = "";
  s.split("\\u001f").forEach(function (t) {
    if (!t) return;
    var li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
}`
  : "";

// 単元・プリントとの対応、この教材でわかること
const unitLine =
  page.unit || page.print
    ? `\n  <p class="unit-line">${unitTag(page.unit, page.unitName)}${
        page.print ? `<span>プリント${escapeHtml(page.print)}</span>` : ""
      }</p>`
    : "";
const leadHtml = page.lead ? `\n  <p class="lead">${escapeHtml(page.lead)}</p>` : "";
const stepsHtml = page.steps.length
  ? `

  <section class="page-part">
    <h2>動かしてみよう</h2>
    <ol>
${page.steps.map((t) => `      <li>${escapeHtml(t)}</li>`).join("\n")}
    </ol>
  </section>`
  : "";
const checksHtml = page.checks.length
  ? `

  <section class="page-part">
    <h2>確かめよう</h2>
${page.checks
  .map(
    ([q, a]) => `    <p>${escapeHtml(q)}</p>
    <details class="answer">
      <summary>答えを見る</summary>
      <div><p>${escapeHtml(a)}</p></div>
    </details>`,
  )
  .join("\n")}
  </section>`
  : "";

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
${headCommon(ROOT)}
<title>${escapeHtml(pageTitle(title))}</title>
${pageMeta({ unit: page.unit, unitName: page.unitName, order: page.order, kind: "material" })}
    <style type="text/css">
        #CSConsole { background-color: #FAFAFA; border-top: 1px solid #333333; bottom: 0px;
            height: 200px; overflow-y: scroll; position: fixed; width: 100%; }
    </style>
    <link rel="stylesheet" href="${ROOT}ketcindyjs/CindyJS.css">
    <script type="text/javascript" src="${ROOT}ketcindyjs/Cindy.js"></script>
<script id="csinit" type="text/x-cindyscript">
${initLines.join("\n")}
</script>
<script id="csdraw" type="text/x-cindyscript">
Ketjspx=1/screenresolution();
${drawLines.join("\n")}
</script>
    <script type="text/javascript">${readoutScript}
var cdy = CindyJS({
  scripts: "cs*",
  use: ["katex"],
  defaultAppearance: { dimDependent: 0.7, fontFamily: "sans-serif", lineSize: 1, pointSize: 5.0, textsize: 12.0 },
  angleUnit: "°",
  geometry: [
    ${geometry.join(",\n    ")}
  ],
  ports: [{
    id: "CSCanvas",
    fill: "parent",
    transform: [{visibleRect: [${view.left}, ${view.top}, ${view.right}, ${view.bottom}]}],
    background: "rgb(247,247,247)"
  }],
  csconsole: false
});
    </script>
</head>
<body>
<div class="wrap">

${breadcrumb([[INDEX_TITLE, `${ROOT}index.html`], [category.name, "index.html"], [title]])}

${docHead(title, category.name, ROOT)}

<main>${unitLine}${leadHtml}${switchHtml}
  <div class="stage" style="--stage-max: ${CANVAS_W}px; --stage-ratio: ${CANVAS_W} / ${CANVAS_H};">
    <div id="CSCanvas"></div>
  </div>${usesReadout ? `\n  <ul class="readout" id="readout" aria-live="polite"></ul>` : ""}${
    draggable ? `\n  <p class="stage-note">スライダーや点は、ドラッグ（スマートフォン・タブレットではタッチ）で動かせます。</p>` : ""
  }${stepsHtml}${checksHtml}

  ${pagerSlot()}
</main>

${docFoot({ back: [`${category.name}の${INDEX_TITLE}`, "index.html"], root: ROOT })}

</div>${switchScript ? `\n<script type="text/javascript">${switchScript}\n</script>` : ""}
</body>
</html>
`;

copyAssets(outDir);
copyCindyJs(outDir);

mkdirSync(join(outDir, category.slug), { recursive: true });
const outFile = join(outDir, category.slug, srcName + ".html");
writeFileSync(outFile, html);
console.log(`生成: ${outFile}`);
console.log(`関数: ${out.length} 個 / csinit ${initLines.length} 行 / csdraw ${drawLines.length} 行`);
console.log(`抽出: ${out.map((e) => e[0]).join(", ")}`);
