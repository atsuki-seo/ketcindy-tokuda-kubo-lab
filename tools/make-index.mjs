#!/usr/bin/env node
// 出力ディレクトリの教材ページから、一覧ページを書き出す。
//   index.html          教材一覧（科目ごとの件数つきの一覧）
//   <科目>/index.html   科目ごとの教材の一覧
// 科目は出力ディレクトリ直下のディレクトリ名（tools/site.mjs の CATEGORIES の slug）から決め、表の順に並べる。
// 教材の見出しは各ページの <h1>（なければ <title>、それもなければファイル名）から取る。
// 使い方: node tools/make-index.mjs [出力ディレクトリ(既定 build/html)]

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORIES,
  INDEX_TITLE,
  breadcrumb,
  categoryBySlug,
  copyAssets,
  docFoot,
  docHead,
  escapeHtml,
  headCommon,
  pageTitle,
} from "./site.mjs";

const dir = process.argv[2] ?? "build/html";
const unescapeHtml = (s) =>
  s.replace(/&(amp|lt|gt|quot);/g, (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[n]);

function readPages(catDir) {
  return readdirSync(catDir)
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .sort()
    .map((f) => {
      const src = readFileSync(join(catDir, f), "utf8");
      const h1 = src.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1];
      const t = src.match(/<title>([^<]*)<\/title>/)?.[1]?.split(" | ")[0];
      return { file: f, title: unescapeHtml(h1 ?? t ?? f.replace(/\.html$/, "")) };
    });
}

// 科目ごとの教材。教材のない科目は一覧に出さない。
const categories = CATEGORIES.filter((c) => existsSync(join(dir, c.slug)))
  .map((c) => ({ ...c, pages: readPages(join(dir, c.slug)) }))
  .filter((c) => c.pages.length);
for (const d of readdirSync(dir, { withFileTypes: true })) {
  if (d.isDirectory() && !["assets", "ketcindyjs"].includes(d.name) && !categoryBySlug(d.name)) {
    console.warn(`警告: ${join(dir, d.name)} は CATEGORIES にない科目なので一覧に載せません`);
  }
}
const total = categories.reduce((n, c) => n + c.pages.length, 0);

const item = (href, title, sub) =>
  `    <li><a class="idx-link" href="${escapeHtml(encodeURI(href))}">` +
  `<span class="idx-title">${escapeHtml(title)}</span>` +
  (sub ? `<span class="idx-sub">${escapeHtml(sub)}</span>` : "") +
  `</a></li>`;

const section = (heading, items) => `<section>
  <h2><span class="num">◆</span>${heading}</h2>
  <ul class="idx-list">
${items.join("\n")}
  </ul>
</section>`;

function page({ title, root, crumbs, head, main, foot }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
${headCommon(root)}
<title>${escapeHtml(pageTitle(title))}</title>
</head>
<body>
<div class="wrap">
${crumbs ? `\n${crumbs}\n` : ""}
${head}

<main>
${main}
</main>

${foot}

</div>
</body>
</html>
`;
}

copyAssets(dir);

writeFileSync(
  join(dir, "index.html"),
  page({
    title: INDEX_TITLE,
    root: "",
    head: docHead(INDEX_TITLE, `KeTCindy で作成した HTML 教材 ／ 全${categories.length}科目・${total}件`),
    main: categories.length
      ? section(
          "科目",
          categories.map((c) => item(`${c.slug}/`, c.name, `${c.pages.length}件`)),
        )
      : `<section><p>公開中の教材はありません。</p></section>`,
    foot: docFoot(),
  }),
);
console.log(`index.html: ${categories.length} 科目`);

for (const c of categories) {
  writeFileSync(
    join(dir, c.slug, "index.html"),
    page({
      title: `${c.name} ${INDEX_TITLE}`,
      root: "../",
      crumbs: breadcrumb([[INDEX_TITLE, "../index.html"], [c.name]]),
      head: docHead(c.name, `全${c.pages.length}件`, "../"),
      main: section(
        "教材",
        c.pages.map((p) => item(p.file, p.title)),
      ),
      foot: docFoot({ back: [INDEX_TITLE, "../index.html"], root: "../" }),
    }),
  );
  console.log(`${c.slug}/index.html: ${c.pages.length} 件のリンクを生成`);
}
