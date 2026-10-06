#!/usr/bin/env node
// 出力ディレクトリ内の HTML（index.html 以外）へのリンク一覧を index.html として書き出す。
// 使い方: node tools/make-index.mjs [出力ディレクトリ(既定 build/html)]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "build/html";
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const pages = readdirSync(dir)
  .filter((f) => f.endsWith(".html") && f !== "index.html")
  .sort()
  .map((f) => {
    const title = readFileSync(join(dir, f), "utf8").match(/<title>([^<]*)<\/title>/)?.[1] ?? f;
    return { file: f, title };
  });

const items = pages
  .map((p) => `    <li><a href="${encodeURI(p.file)}">${escapeHtml(p.title)}</a></li>`)
  .join("\n");

writeFileSync(
  join(dir, "index.html"),
  `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ketcindy-tokuda-kubo-lab</title>
</head>
<body>
  <h1>ketcindy-tokuda-kubo-lab</h1>
  <p>KeTCindy で作成した教材の一覧です。</p>
  <ul>
${items}
  </ul>
</body>
</html>
`,
);
console.log(`index.html: ${pages.length} 件のリンクを生成`);
