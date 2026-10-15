// 公開ページ（教材ページ・一覧ページ）に共通する部品。
// ketjs-build.mjs と make-index.mjs の両方から使う。
//
// ページは「科目 → 教材」の階層に並ぶ。
//   index.html              教材一覧（科目の一覧）
//   <科目>/index.html       科目ごとの教材の一覧
//   <科目>/<教材>.html      教材ページ
// assets/ と ketcindyjs/ は出力ディレクトリ直下に 1 つだけ置き、各ページからは相対パスで参照する。
// リンクもすべて相対パスなので、GitHub Pages でも、ローカルで build/html を直接開いても同じようにたどれる。

import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// KeTCindy 一式の scripts ディレクトリ（環境変数 KETCINDY_HOME、既定 ~/ketcindy）
export const KETCINDY_SCRIPTS = join(process.env.KETCINDY_HOME ?? join(homedir(), "ketcindy"), "ketcindyfolder", "scripts");

export const SCHOOL = "弓削商船高等専門学校";
export const INDEX_TITLE = "教材一覧";

// 科目の一覧。教材のスクリプトには「// @category 科目名」で科目を書く。
// slug は URL（ディレクトリ名）に使う英字の名前。一覧はこの表の順に並ぶ。
// chapters があると、科目の一覧ページを章の見出しで分け、教材を単元（// @unit）の順に並べる。
// 章は units に挙げた単元の教材をまとめる。drill: true の章には練習問題のページを並べる。
export const CATEGORIES = [
  { slug: "control", name: "制御工学" },
  {
    slug: "math2",
    name: "数学2",
    chapters: [
      { name: "点と直線", units: [1, 2, 3] },
      { name: "円と2次曲線", units: [5, 6, 7, 8, 9, 10] },
      { name: "不等式と領域", units: [11] },
      { name: "ベクトル", units: [12, 13, 14] },
      { name: "練習問題", drill: true },
    ],
  },
];

export const categoryByName = (name) => CATEGORIES.find((c) => c.name === name);
export const categoryBySlug = (slug) => CATEGORIES.find((c) => c.slug === slug);

const ASSETS_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const ASSET_FILES = ["site.css", "kousho.svg"];

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// 出力ディレクトリに assets/（スタイルと校章）を置く
export function copyAssets(outDir) {
  mkdirSync(join(outDir, "assets"), { recursive: true });
  for (const f of ASSET_FILES) copyFileSync(join(ASSETS_SRC, f), join(outDir, "assets", f));
}

// 出力ディレクトリに ketcindyjs/（CindyJS 本体と KaTeX）を置く
export function copyCindyJs(outDir) {
  const src = join(KETCINDY_SCRIPTS, "ketcindyjs");
  mkdirSync(join(outDir, "ketcindyjs"), { recursive: true });
  for (const f of ["Cindy.js", "Cindy.js.map", "CindyJS.css", "katex-plugin.js", "webfont.js"]) {
    if (existsSync(join(src, f))) copyFileSync(join(src, f), join(outDir, "ketcindyjs", f));
  }
  cpSync(join(src, "katex"), join(outDir, "ketcindyjs", "katex"), { recursive: true });
}

// 以下の root は、そのページから出力ディレクトリ直下への相対パス（直下のページは ""、科目の下は "../"）。

// <head> に入れる共通の要素
export const headCommon = (root = "") => `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${root}assets/kousho.svg">
<link rel="stylesheet" href="${root}assets/site.css">`;

export const crest = (root = "") => `<img class="crest" src="${root}assets/kousho.svg" alt="" aria-hidden="true">`;

// パンくずリスト。trail は [ラベル, href] の配列で、最後の要素は現在のページ（リンクにしない）。
export function breadcrumb(trail) {
  const items = trail.map(([label, href], i) =>
    i === trail.length - 1
      ? `    <li aria-current="page">${escapeHtml(label)}</li>`
      : `    <li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`,
  );
  return `<nav class="crumbs" aria-label="パンくずリスト">
  <ol>
${items.join("\n")}
  </ol>
</nav>`;
}

export function docHead(title, meta, root = "") {
  return `<header class="doc-head">
  <p class="eyebrow">${crest(root)}${SCHOOL}</p>
  <h1>${escapeHtml(title)}</h1>${meta ? `\n  <p class="doc-meta">${escapeHtml(meta)}</p>` : ""}
</header>`;
}

// back は戻り先のリンク [ラベル, href]（なければ出さない）
export function docFoot({ back, root = "" } = {}) {
  const backLink = back ? `\n  <p><a href="${escapeHtml(back[1])}">${escapeHtml(back[0])}へ戻る</a></p>` : "";
  return `<footer class="doc-foot">${backLink}
  <p>${crest(root)}${SCHOOL}</p>
</footer>`;
}

export const pageTitle = (title) => `${title} | ${SCHOOL}`;

// 教材ページの情報（単元など）を一覧ページへ渡す <meta>。make-index.mjs が読む。
// info は { unit, unitName, order, kind } のうち値のあるものだけを書く。
export function pageMeta(info) {
  return Object.entries(info)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `<meta name="ket-${k}" content="${escapeHtml(v)}">`)
    .join("\n");
}

export function readPageMeta(html) {
  const info = {};
  for (const m of html.matchAll(/<meta name="ket-([a-zA-Z]+)" content="([^"]*)">/g)) info[m[1]] = m[2];
  return info;
}

// 単元のタグ（例: 「単元7 楕円の式」）
export const unitTag = (unit, unitName) =>
  unit ? `<span class="unit-tag">単元${escapeHtml(unit)}${unitName ? ` ${escapeHtml(unitName)}` : ""}</span>` : "";

// 前後の教材へのリンク。make-index.mjs が <!--pager--> と <!--/pager--> の間を書き換える。
export const PAGER_START = "<!--pager-->";
export const PAGER_END = "<!--/pager-->";
export const pagerSlot = () => `${PAGER_START}${PAGER_END}`;
// noun は「教材」「練習」などのページの呼び方
export function pager(prev, next, noun = "教材") {
  if (!prev && !next) return "";
  const link = (p, rel, label) =>
    p
      ? `<a class="pager-${rel}" rel="${rel}" href="${escapeHtml(encodeURI(p.file))}">` +
        `<span class="pager-label">${label}</span><span class="pager-title">${escapeHtml(p.title)}</span></a>`
      : `<span class="pager-${rel}"></span>`;
  return `<nav class="pager" aria-label="前後の${noun}">
  ${link(prev, "prev", `前の${noun}`)}
  ${link(next, "next", `次の${noun}`)}
</nav>`;
}
