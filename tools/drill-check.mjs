#!/usr/bin/env node
// 練習問題の生成と判定を、シードを固定して大量に確かめる（CI で実行する）。
//   - 答えが問題の条件を満たすか（2点が直線の上にあるか、PQ の中点が ℓ の上にあり PQ ⊥ ℓ か、ma + nb = c か など）
//   - 正しい答えを入力すると正解になり、値を 1 ずらすと不正解になるか（直線は入力できるすべての形で）
//   - 表示した数を入力欄に入れ直すと同じ値になるか
//   - 基本は答えが整数だけか（単位ベクトルを除く）、√ の中は 2 桁までか、問題文の数が大きすぎないか
// 使い方: node tools/drill-check.mjs [問題数(既定 300)]

import {
  LEVELS,
  LINE_FORMS,
  TYPES,
  correctInputs,
  judge,
  makeProblem,
  parseNum,
} from "./drill/core.mjs";

const N = Number(process.argv[2] ?? 300);
// 基本でも分数になる型（単位ベクトルは成分が |a| で割った数になる）
const BASIC_FRACTION_OK = new Set(["unitVector"]);
const failures = [];
const fail = (p, msg) => failures.push(`[${p.type}/${p.level} seed=${p.seed}] ${msg}\n    ${p.text}`);

const bump = (s) => {
  const v = parseNum(s).value;
  return String(Math.round((v + 1) * 1e6) / 1e6);
};

let count = 0;
for (const type of Object.keys(TYPES)) {
  for (const level of Object.keys(LEVELS)) {
    for (let seed = 1; seed <= N; seed++) {
      const p = makeProblem(type, level, seed);
      count++;
      if (!p.verify()) fail(p, "答えが問題の条件を満たさない");
      const { form, values } = correctInputs(p);
      if (!values) {
        fail(p, "正しい答えを入力できる形がない");
        continue;
      }
      if (!judge(p, values, form).ok) fail(p, `正しい答え ${values.join(", ")} が不正解になる`);
      // 直線は、答えを書ける形すべてで確かめる
      if (p.input.kind === "line") {
        for (const f of Object.keys(LINE_FORMS)) {
          if (p.inputs[f] && !judge(p, p.inputs[f], f).ok) fail(p, `${f} の形の正しい答えが不正解になる`);
        }
      }
      // 値を 1 ずらすと不正解（直線は定数項、ほかは最初の欄）
      const wrong = [...values];
      const at = p.input.kind === "line" ? wrong.length - 1 : 0;
      wrong[at] = bump(wrong[at]);
      if (judge(p, wrong, form).ok) fail(p, `間違った答え ${wrong.join(", ")} が正解になる`);
      // 表示した数を読み直すと同じ値
      for (const v of values) {
        const r = parseNum(v);
        if (r.error) fail(p, `答えの表示 ${v} を読めない`);
        if (r.hint) fail(p, `答えの表示 ${v} がまだ簡単にできる（${r.hint}）`);
      }
      // 水準: 基本は整数の答え、√ の中は 2 桁まで、問題文の数は 2 桁まで
      if (level === "basic" && !BASIC_FRACTION_OK.has(type) && values.some((v) => /[/√]/.test(v))) {
        fail(p, `基本なのに答えが整数でない（${values.join(", ")}）`);
      }
      for (const m of `${p.answerText} ${values.join(" ")}`.matchAll(/√(\d+)/g)) {
        if (Number(m[1]) > LEVELS[level].maxRadicand) fail(p, `√ の中が大きすぎる（√${m[1]}）`);
      }
      for (const m of p.text.matchAll(/\d+/g)) {
        if (Number(m[0]) > 50) fail(p, `問題文の数が大きすぎる（${m[0]}）`);
      }
      // 図形（判定前・判定後）が作れる
      try {
        p.figure(null);
        p.figure(judge(p, values, form).figureInput);
      } catch (e) {
        fail(p, `図形を作れない: ${e.message}`);
      }
    }
  }
}

if (failures.length) {
  console.error(failures.slice(0, 30).join("\n"));
  console.error(`NG: ${failures.length} 件（${count} 問中）`);
  process.exit(1);
}
console.log(`OK: ${Object.keys(TYPES).length} 型 × ${Object.keys(LEVELS).length} 段階 × ${N} 問 = ${count} 問`);
