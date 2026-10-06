#!/usr/bin/env node
// 出力ディレクトリ内の HTML（index.html 以外）へのリンク一覧を index.html として書き出す。
// 見出しは各ページの <h1>（なければ <title>、それもなければファイル名）から取る。
// 使い方: node tools/make-index.mjs [出力ディレクトリ(既定 build/html)]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INDEX_TITLE, copyAssets, docFoot, docHead, escapeHtml, headCommon, pageTitle } from "./site.mjs";

const dir = process.argv[2] ?? "build/html";
const unescapeHtml = (s) =>
  s.replace(/&(amp|lt|gt|quot);/g, (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[n]);

const pages = readdirSync(dir)
  .filter((f) => f.endsWith(".html") && f !== "index.html")
  .sort()
  .map((f) => {
    const src = readFileSync(join(dir, f), "utf8");
    const h1 = src.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1];
    const t = src.match(/<title>([^<]*)<\/title>/)?.[1]?.split(" | ")[0];
    return { file: f, title: unescapeHtml(h1 ?? t ?? f.replace(/\.html$/, "")) };
  });

const items = pages
  .map(
    (p) =>
      `    <li><a class="idx-link" href="${escapeHtml(encodeURI(p.file))}">` +
      `<span class="idx-title">${escapeHtml(p.title)}</span></a></li>`,
  )
  .join("\n");

const listing = pages.length
  ? `<section>
  <h2><span class="num">◆</span>教材</h2>
  <ul class="idx-list">
${items}
  </ul>
</section>`
  : `<section><p>公開中の教材はありません。</p></section>`;

copyAssets(dir);
writeFileSync(
  join(dir, "index.html"),
  `<!DOCTYPE html>
<html lang="ja">
<head>
${headCommon()}
<title>${escapeHtml(pageTitle(INDEX_TITLE))}</title>
</head>
<body>
<div class="wrap">

${docHead(INDEX_TITLE, `KeTCindy で作成した HTML 教材 ／ 全${pages.length}件`)}

<main>
${listing}
</main>

${docFoot()}

</div>
</body>
</html>
`,
);
console.log(`index.html: ${pages.length} 件のリンクを生成`);
