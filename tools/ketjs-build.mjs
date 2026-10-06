#!/usr/bin/env node
// KeTCindyJS の HTML 出力（KeTJS ボタンの処理）を、Cinderella なしで再現するビルドスクリプト。
//
// 移植元: ketcindylibbasic3r.cs の Mkketcindyjs / Extractfun / Extractall
//   1. スクリプトから呼び出している関数名を拾う
//   2. ketcindyjs/*list.txt の依存表をたどり、必要な KeTCindy 関数だけを ketlib から抜き出す
//   3. csinit（関数群）+ csdraw（利用者スクリプト）+ CindyJS({geometry...}) を 1 つの HTML にする
//
// 使い方: node tools/ketjs-build.mjs src/nyquist_g4.cs [出力ディレクトリ(既定 build/html)]
// 環境変数: KETCINDY_HOME（既定 ~/ketcindy）
//
// ページの見出しは、スクリプト中の「// @title 見出し」行から取る（なければファイル名）。
// コメント行なので Cinderella 上の動作には影響しない。
//
// HTML 版では、描画のたびに Ketjspx（画面上の 1px が何座標分か）を計算してからスクリプトを実行する。
// キャンバスは画面幅に合わせて縮むが文字の大きさは変わらないので、文字を並べる間隔は
// 「//dy=16*Ketjspx; //only ketjs」のように px で指定すると、狭い画面でも重ならない。

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { INDEX_TITLE, breadcrumb, copyAssets, docFoot, docHead, escapeHtml, headCommon, pageTitle } from "./site.mjs";

const HOME = process.env.KETCINDY_HOME ?? join(homedir(), "ketcindy");
const SCRIPTS = join(HOME, "ketcindyfolder", "scripts");
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

const srcLines = readLines(srcPath);
const title =
  srcLines.map((l) => l.match(/^\s*\/\/\s*@title\s+(.+?)\s*$/)?.[1]).find(Boolean) ??
  basename(srcPath).replace(/\.cs$/, "");
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

// geometry: Cinderella の作図要素に相当する部分。スクリプトが前提とする要素を宣言する。
// SW/NE は Setwindow、Text0 は Textedit(0,...) が参照する。
// JS 版の Putpoint / Slider は点を作らず既存の点を動かすだけなので（createpoint は no ketjs 区間）、
// Cinderella では作図として存在する点を、スクリプトの記述から推定して Free 点として宣言する。
const drawCode = drawLines.join("\n");
const pointNames = new Set();
for (const m of drawCode.matchAll(/\b(?:Putpoint|Slider)\(\s*"([^"]+)"/g)) {
  for (const n of m[1].split("-")) pointNames.add(n);
}
const textNos = new Set([...drawCode.matchAll(/\bText(\d+)\b/g)].map((m) => m[1]));
for (const m of drawCode.matchAll(/\bTextedit\(\s*(\d+)/g)) textNos.add(m[1]);

const geometry = [
  `{name: "SW", type: "Free", pos: [-5.0, -5.0, 1.0], color: [1.0,1.0,1.0], labeled: false, size: 2.0, border: false }`,
  `{name: "NE", type: "Free", pos: [5.0, 5.0, 1.0], color: [1.0,1.0,1.0], labeled: false, size: 2.0, border: false }`,
  ...[...pointNames].map(
    (n) => `{name: "${n}", type: "Free", pos: [0.0, 0.0, 1.0], color: [1.0,0.0,0.0], labeled: false, size: 3.0, border: true }`,
  ),
  ...[...textNos].map(
    (n) => `{name: "Text${n}", type: "EditableText", pos: [0.0, -4.0, 1.0], text: "", minwidth: 120 }`,
  ),
];

// キャンバスの基準サイズ（KeTJS の既定値）。PC ではこの大きさで表示し、
// 狭い画面では縦横比を保ったまま縮める（assets/site.css の .stage を参照）。
const CANVAS_W = 742;
const CANVAS_H = 526;
const draggable = pointNames.size > 0;

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
${headCommon()}
<title>${escapeHtml(pageTitle(title))}</title>
    <style type="text/css">
        #CSConsole { background-color: #FAFAFA; border-top: 1px solid #333333; bottom: 0px;
            height: 200px; overflow-y: scroll; position: fixed; width: 100%; }
    </style>
    <link rel="stylesheet" href="ketcindyjs/CindyJS.css">
    <script type="text/javascript" src="ketcindyjs/Cindy.js"></script>
<script id="csinit" type="text/x-cindyscript">
${initLines.join("\n")}
</script>
<script id="csdraw" type="text/x-cindyscript">
Ketjspx=1/screenresolution();
${drawLines.join("\n")}
</script>
    <script type="text/javascript">
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
    transform: [{visibleRect: [-5.0, 5.0, 5.0, -5.0]}],
    background: "rgb(247,247,247)"
  }],
  csconsole: false
});
    </script>
</head>
<body>
<div class="wrap">

${breadcrumb([[INDEX_TITLE, "index.html"], [title]])}

${docHead(title)}

<main>
  <div class="stage" style="--stage-max: ${CANVAS_W}px; --stage-ratio: ${CANVAS_W} / ${CANVAS_H};">
    <div id="CSCanvas"></div>
  </div>${draggable ? `\n  <p class="stage-note">スライダーや点は、ドラッグ（スマートフォン・タブレットではタッチ）で動かせます。</p>` : ""}
</main>

${docFoot({ backToIndex: true })}

</div>
</body>
</html>
`;

copyAssets(outDir);
mkdirSync(join(outDir, "ketcindyjs"), { recursive: true });
for (const f of ["Cindy.js", "Cindy.js.map", "CindyJS.css", "katex-plugin.js", "webfont.js"]) {
  const p = join(SCRIPTS, "ketcindyjs", f);
  if (existsSync(p)) copyFileSync(p, join(outDir, "ketcindyjs", f));
}
cpSync(join(SCRIPTS, "ketcindyjs", "katex"), join(outDir, "ketcindyjs", "katex"), { recursive: true });

const outFile = join(outDir, basename(srcPath).replace(/\.cs$/, "") + ".html");
writeFileSync(outFile, html);
console.log(`生成: ${outFile}`);
console.log(`関数: ${out.length} 個 / csinit ${initLines.length} 行 / csdraw ${drawLines.length} 行`);
console.log(`抽出: ${out.map((e) => e[0]).join(", ")}`);
