// 公開ページ（教材ページ・index.html）に共通する部品。
// ketjs-build.mjs と make-index.mjs の両方から使う。
//
// ページはすべて出力ディレクトリ直下に並ぶので、リンクは "index.html" のような相対パスにしている。
// GitHub Pages でも、ローカルで build/html/*.html を直接開いても同じようにたどれる。

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHOOL = "弓削商船高等専門学校";
export const INDEX_TITLE = "教材一覧";

const ASSETS_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const ASSET_FILES = ["site.css", "kousho.svg"];

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// 出力ディレクトリに assets/（スタイルと校章）を置く
export function copyAssets(outDir) {
  mkdirSync(join(outDir, "assets"), { recursive: true });
  for (const f of ASSET_FILES) copyFileSync(join(ASSETS_SRC, f), join(outDir, "assets", f));
}

// <head> に入れる共通の要素
export const headCommon = () => `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="assets/kousho.svg">
<link rel="stylesheet" href="assets/site.css">`;

export const crest = () => `<img class="crest" src="assets/kousho.svg" alt="" aria-hidden="true">`;

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

export function docHead(title, meta) {
  return `<header class="doc-head">
  <p class="eyebrow">${crest()}${SCHOOL}</p>
  <h1>${escapeHtml(title)}</h1>${meta ? `\n  <p class="doc-meta">${escapeHtml(meta)}</p>` : ""}
</header>`;
}

export function docFoot({ backToIndex = false } = {}) {
  return `<footer class="doc-foot">${backToIndex ? `\n  <p><a href="index.html">${INDEX_TITLE}へ戻る</a></p>` : ""}
  <p>${crest()}${SCHOOL}</p>
</footer>`;
}

export const pageTitle = (title) => `${title} | ${SCHOOL}`;
