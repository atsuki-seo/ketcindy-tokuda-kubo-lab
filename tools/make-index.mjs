#!/usr/bin/env node
// 出力ディレクトリの教材ページから、一覧ページを書き出す。
//   index.html          教材一覧（科目ごとの件数つきの一覧）
//   <科目>/index.html   科目ごとの教材の一覧
// 科目は出力ディレクトリ直下のディレクトリ名（tools/site.mjs の CATEGORIES の slug）から決め、表の順に並べる。
// 教材の見出しは各ページの <h1>（なければ <title>、それもなければファイル名）から取る。
// 科目に章（chapters）があるときは、章の見出しで分け、教材を単元（<meta name="ket-unit">）の順に並べる。
// あわせて各ページの <!--pager--> に前後の教材へのリンクを書き込む（教材は教材どうし、練習問題は練習問題どうし）。
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
  PAGER_END,
  PAGER_START,
  pager,
  pageTitle,
  readPageMeta,
  unitTag,
} from "./site.mjs";

const dir = process.argv[2] ?? "build/html";
const unescapeHtml = (s) =>
  s.replace(/&(amp|lt|gt|quot);/g, (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[n]);

// 単元の順（単元のないページは後ろ）→ 同じ単元の中は @order の順 → ファイル名の順
const byUnit = (a, b) =>
  (a.unit ?? Infinity) - (b.unit ?? Infinity) || a.order - b.order || a.file.localeCompare(b.file);

function readPages(catDir) {
  return readdirSync(catDir)
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => {
      const src = readFileSync(join(catDir, f), "utf8");
      const h1 = src.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1];
      const t = src.match(/<title>([^<]*)<\/title>/)?.[1]?.split(" | ")[0];
      const meta = readPageMeta(src);
      return {
        file: f,
        title: unescapeHtml(h1 ?? t ?? f.replace(/\.html$/, "")),
        unit: meta.unit ? Number(meta.unit) : undefined,
        unitName: meta.unitName ? unescapeHtml(meta.unitName) : undefined,
        order: Number(meta.order ?? 0),
        drill: meta.kind === "drill",
      };
    })
    .sort(byUnit);
}

// 前後の教材へのリンクを各ページに書き込む（何度実行しても同じ結果になる）
function writePagers(catDir, pages, noun) {
  pages.forEach((p, i) => {
    const file = join(catDir, p.file);
    const src = readFileSync(file, "utf8");
    const a = src.indexOf(PAGER_START);
    const b = src.indexOf(PAGER_END);
    if (a < 0 || b < a) return;
    const nav = pager(pages[i - 1], pages[i + 1], noun);
    writeFileSync(file, src.slice(0, a + PAGER_START.length) + (nav ? `\n${nav}\n` : "") + src.slice(b));
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

const item = (href, title, sub, tagHtml = "") =>
  `    <li><a class="idx-link" href="${escapeHtml(encodeURI(href))}">` +
  tagHtml +
  `<span class="idx-title">${escapeHtml(title)}</span>` +
  (sub ? `<span class="idx-sub">${escapeHtml(sub)}</span>` : "") +
  `</a></li>`;

const section = (heading, items) => `<section>
  <h2><span class="num">◆</span>${escapeHtml(heading)}</h2>
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

// 章ごとの教材。章のない科目は「教材」の 1 つにまとめる。
function chapterSections(c) {
  if (!c.chapters) return [section("教材", c.pages.map((p) => item(p.file, p.title)))];
  const used = new Set();
  const out = [];
  for (const ch of c.chapters) {
    const pages = c.pages.filter((p) => (ch.drill ? p.drill : !p.drill && ch.units?.includes(p.unit)));
    pages.forEach((p) => used.add(p));
    if (pages.length) out.push(section(ch.name, pages.map((p) => item(p.file, p.title, "", unitTag(p.unit)))));
  }
  const rest = c.pages.filter((p) => !used.has(p));
  if (rest.length) out.push(section("その他", rest.map((p) => item(p.file, p.title, "", unitTag(p.unit)))));
  return out;
}

for (const c of categories) {
  writePagers(join(dir, c.slug), c.pages.filter((p) => !p.drill), "教材");
  writePagers(join(dir, c.slug), c.pages.filter((p) => p.drill), "練習");
  writeFileSync(
    join(dir, c.slug, "index.html"),
    page({
      title: `${c.name} ${INDEX_TITLE}`,
      root: "../",
      crumbs: breadcrumb([[INDEX_TITLE, "../index.html"], [c.name]]),
      head: docHead(c.name, `全${c.pages.length}件`, "../"),
      main: chapterSections(c).join("\n\n"),
      foot: docFoot({ back: [INDEX_TITLE, "../index.html"], root: "../" }),
    }),
  );
  console.log(`${c.slug}/index.html: ${c.pages.length} 件のリンクを生成`);
}
