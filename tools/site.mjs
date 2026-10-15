// 公開ページ（教材ページ・一覧ページ）に共通する部品。
// ketjs-build.mjs と make-index.mjs の両方から使う。
//
// ページは「科目 → 教材」の階層に並ぶ。
//   index.html              教材一覧（科目の一覧）
//   <科目>/index.html       科目ごとの教材の一覧
//   <科目>/<教材>.html      教材ページ
// assets/ と ketcindyjs/ は出力ディレクトリ直下に 1 つだけ置き、各ページからは相対パスで参照する。
// リンクもすべて相対パスなので、GitHub Pages でも、ローカルで build/html を直接開いても同じようにたどれる。

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHOOL = "弓削商船高等専門学校";
export const INDEX_TITLE = "教材一覧";

// 科目の一覧。教材のスクリプトには「// @category 科目名」で科目を書く。
// slug は URL（ディレクトリ名）に使う英字の名前。一覧はこの表の順に並ぶ。
export const CATEGORIES = [{ slug: "control", name: "制御工学" }];

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
