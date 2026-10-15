#!/usr/bin/env node
// 練習問題のページを書き出す。
//
// ページの定義は JSON（例: src/math2/drill-point-line.json）に書く。
//   { "title": "練習: 点と直線", "category": "数学2", "order": 1,
//     "lead": "…", "types": ["distance", "division", …] }
// types は tools/drill/core.mjs の TYPES の名前。order は練習問題どうしの並び順。
//
// ボタンと入力欄は普通の HTML にし、グラフだけ CindyJS で描く（KeTJS の作図ツールはボタンに対応していないため）。
// 問題の生成・判定（tools/drill/core.mjs）と画面（tools/drill/ui.js）はページに埋め込むので、
// build/html を直接開いても（file://）動く。HTML の部品から CindyJS へは、cdy.evokeCS で変数 Shapes を渡す。
//
// 使い方: node tools/drill-build.mjs src/math2/drill-point-line.json [出力ディレクトリ(既定 build/html)]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TYPES } from "./drill/core.mjs";
import {
  CATEGORIES,
  INDEX_TITLE,
  breadcrumb,
  categoryByName,
  copyAssets,
  copyCindyJs,
  docFoot,
  docHead,
  escapeHtml,
  headCommon,
  pageMeta,
  pagerSlot,
  pageTitle,
} from "./site.mjs";

const [srcPath, outDir = "build/html"] = process.argv.slice(2);
if (!srcPath) {
  console.error("usage: drill-build.mjs <drill.json> [outDir]");
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(srcPath, "utf8"));
const category = categoryByName(spec.category);
if (!category) {
  console.error(`科目「${spec.category}」は tools/site.mjs の CATEGORIES にありません（${CATEGORIES.map((c) => c.name).join("、")}）。`);
  process.exit(2);
}
const unknown = (spec.types ?? []).filter((t) => !TYPES[t]);
if (!spec.types?.length || unknown.length) {
  console.error(`types が空か、tools/drill/core.mjs にない型があります: ${unknown.join(", ")}`);
  process.exit(2);
}

// core.mjs を、ページの中で Drill という名前で使えるようにする（export を外して 1 つの関数に包む）
const coreSrc = readFileSync(join(here, "drill", "core.mjs"), "utf8");
const exported = [...coreSrc.matchAll(/^export\s+(?:const|function|class|let)\s+([A-Za-z_]\w*)/gm)].map((m) => m[1]);
const coreJs = `var Drill = (function () {\n${coreSrc.replace(/^export\s+/gm, "")}\nreturn { ${exported.join(", ")} };\n})();`;
const uiJs = readFileSync(join(here, "drill", "ui.js"), "utf8");
// </script> が埋め込んだコードの中にあるとページが壊れるので、念のため確かめる
if (/<\/script/i.test(coreJs + uiJs)) throw new Error("埋め込むコードに </script> が含まれています");

const ROOT = "../";
const title = spec.title;
const CANVAS_W = 640;
const CANVAS_H = 480;

// グラフを描く CindyScript。Shapes の要素は次のどれか（座標はキャンバスの座標、ui.js の render が作る）
//   ["L", 点の列, 色, 太さ]  ["A", 始点, 終点, 色, 破線(0/1)]  ["P", 点, 色, 白抜き(0/1)]  ["T", 位置, 文字, 色]
// 破線の折れ線は ui.js が短い線分に分けて渡す（connect が dashing に対応していないため）
const csdraw = `Cols=[[0.12,0.12,0.12],[0.82,0.13,0.1],[0.1,0.36,0.85],[0.86,0.86,0.86],[0.45,0.45,0.45]];
forall(Shapes, s=#;
  if(s_1=="L", connect(s_2, color->Cols_(s_3+1), size->s_4));
  if(s_1=="A",
    if(s_5==1, draw(s_2, s_3, color->Cols_(s_4+1), size->2, arrow->true, dashing->6), draw(s_2, s_3, color->Cols_(s_4+1), size->2, arrow->true));
  );
  if(s_1=="P",
    draw(s_2, color->Cols_(s_3+1), size->6);
    if(s_4==1, draw(s_2, color->[1,1,1], size->3));
  );
  if(s_1=="T", drawtext(s_2, s_3, color->Cols_(s_4+1), size->13));
);`;

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
${headCommon(ROOT)}
<title>${escapeHtml(pageTitle(title))}</title>
${pageMeta({ order: spec.order, kind: "drill" })}
<link rel="stylesheet" href="${ROOT}ketcindyjs/CindyJS.css">
<script type="text/javascript" src="${ROOT}ketcindyjs/Cindy.js"></script>
<script id="csinit" type="text/x-cindyscript">
Shapes=[];
</script>
<script id="csdraw" type="text/x-cindyscript">
${csdraw}
</script>
<script type="text/javascript">
var cdy = CindyJS({
  scripts: "cs*",
  defaultAppearance: { fontFamily: "sans-serif", lineSize: 1, pointSize: 5.0, textsize: 13.0 },
  geometry: [],
  ports: [{
    id: "CSCanvas",
    fill: "parent",
    transform: [{visibleRect: [-10, 7.5, 10, -7.5]}],
    background: "rgb(252,252,252)"
  }],
  csconsole: false
});
var DRILL = ${JSON.stringify({ types: spec.types })};
${coreJs}
${uiJs}
</script>
</head>
<body>
<div class="wrap">

${breadcrumb([[INDEX_TITLE, `${ROOT}index.html`], [category.name, "index.html"], [title]])}

${docHead(title, category.name, ROOT)}

<main class="drill">${spec.lead ? `\n  <p class="lead">${escapeHtml(spec.lead)}</p>` : ""}
  <div class="controls">
    <label>問題の型 <select id="drill-type"><option value="random">すべての型からランダム</option></select></label>
    <label>難しさ <select id="drill-level"><option value="basic">基本（答えが整数）</option><option value="exam">試験（分数・√ を含む）</option></select></label>
    <span class="score" id="score" aria-live="polite">正解 0 / 0 問</span>
  </div>

  <section class="page-part" aria-labelledby="q-type">
    <h2 id="q-type">問題</h2>
    <p class="question" id="question"></p>
    <div id="answer"></div>
    <div class="buttons">
      <button type="button" id="btn-sqrt" aria-label="√ を入力する">√</button>
      <button type="button" class="primary" id="btn-check">答え合わせ</button>
      <button type="button" id="btn-next">次の問題</button>
    </div>
    <div class="result" id="result" aria-live="polite"></div>
  </section>

  <div class="stage stage-static" style="--stage-max: ${CANVAS_W}px; --stage-ratio: ${CANVAS_W} / ${CANVAS_H};">
    <div id="CSCanvas"></div>
  </div>
  <p class="legend" id="legend" hidden>赤の実線: 正解 ／ 青の破線・白抜きの点: 入力した答え</p>

  <section class="page-part">
    <h2>入力のしかた</h2>
    <ol>
      <li>整数・分数・√ を組み合わせて入力する（例: 3、−2、3/2、2√5、−√3/2）。√ は「√」ボタンでも入れられる。</li>
      <li>値が等しければ正解にする（√40 と 2√10、6/4 と 3/2 はどちらも正解）。簡単にできるときは一言添える。</li>
      <li>直線の式は「式の形」を選んでから係数を入れる。係数が比例していれば（同じ直線なら）正解にする。</li>
      <li>正解数はこのページを開いている間だけ数え、保存も送信もしない。</li>
    </ol>
  </section>

  ${pagerSlot()}
</main>

${docFoot({ back: [`${category.name}の${INDEX_TITLE}`, "index.html"], root: ROOT })}

</div>
</body>
</html>
`;

copyAssets(outDir);
copyCindyJs(outDir);
mkdirSync(join(outDir, category.slug), { recursive: true });
const outFile = join(outDir, category.slug, basename(srcPath).replace(/\.json$/, "") + ".html");
writeFileSync(outFile, html);
console.log(`生成: ${outFile}（${spec.types.length} 型）`);
