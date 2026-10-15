// 練習問題の中身: 数の扱い（分数と √）、入力の読み取り、問題の生成、判定、解き方、グラフの図形。
// ブラウザ（tools/drill-build.mjs がページに埋め込む）と Node（tools/drill-check.mjs の検証）の両方で使う。
// DOM や CindyJS には触れない。
//
// 問題はきれいな答えを先に決めて数値を逆算し、成り立たない組み合わせは引き直す（plans/math2-web-materials.md）。
// 答えが分数になる問題は、問題を先に決めて答えを分数のまま計算する。

// ---------- 難しさ（数値の範囲はここだけで決める） ----------

// basic: 答えが整数になる問題だけ。exam: 過去問と同じ水準（座標や係数は ±7 程度、分数の答えあり、√ の中は 2 桁まで）
export const LEVELS = {
  basic: { name: "基本", range: 5, fraction: false, maxRadicand: 99 },
  exam: { name: "試験", range: 7, fraction: true, maxRadicand: 99 },
};

// ---------- 乱数（シードを固定すると同じ問題が出る） ----------

export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  return {
    next,
    int,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    chance: (p) => next() < p,
    nonzero: (a, b) => {
      for (;;) {
        const v = int(a, b);
        if (v !== 0) return v;
      }
    },
  };
}

// 条件を満たすまで作り直す（make が null を返したら引き直し）
function retry(make, limit = 5000) {
  for (let i = 0; i < limit; i++) {
    const v = make();
    if (v) return v;
  }
  throw new Error("問題を作れませんでした");
}

// ---------- 分数 ----------

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

// 分数 n/d（約分済み、d > 0）
export function frac(n, d = 1) {
  if (d === 0) throw new Error("0 で割りました");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const F = (v) => (typeof v === "number" ? frac(v) : v);
export const fadd = (a, b) => ((a = F(a)), (b = F(b)), frac(a.n * b.d + b.n * a.d, a.d * b.d));
export const fsub = (a, b) => ((a = F(a)), (b = F(b)), frac(a.n * b.d - b.n * a.d, a.d * b.d));
export const fmul = (a, b) => ((a = F(a)), (b = F(b)), frac(a.n * b.n, a.d * b.d));
export const fdiv = (a, b) => ((a = F(a)), (b = F(b)), frac(a.n * b.d, a.d * b.n));
export const fneg = (a) => ((a = F(a)), frac(-a.n, a.d));
export const fval = (a) => ((a = F(a)), a.n / a.d);
export const fisInt = (a) => F(a).d === 1;

// ---------- √ を含む数 c√r（c は分数、r は平方因子を含まない正の整数） ----------

export function surd(c, r = 1) {
  c = F(c);
  if (r === 0 || c.n === 0) return { c: frac(0), r: 1 };
  let out = 1;
  let rest = r;
  for (let k = 2; k * k <= rest; k++) {
    while (rest % (k * k) === 0) {
      rest /= k * k;
      out *= k;
    }
  }
  return { c: fmul(c, out), r: rest };
}
export const sqrtOf = (k) => surd(1, k); // √k
export const sval = (s) => fval(s.c) * Math.sqrt(s.r);
const S = (v) => (v && v.c ? v : surd(v)); // 数・分数・surd のどれでも surd にする

// ---------- 表示（数学の書き方。負の符号は U+2212） ----------

const MINUS = "−";
export function fmtFrac(a) {
  a = F(a);
  const sign = a.n < 0 ? MINUS : "";
  return sign + (a.d === 1 ? `${Math.abs(a.n)}` : `${Math.abs(a.n)}/${a.d}`);
}
export function fmtNum(v) {
  const s = S(v);
  if (s.r === 1) return fmtFrac(s.c);
  const sign = s.c.n < 0 ? MINUS : "";
  const k = Math.abs(s.c.n);
  return sign + (k === 1 ? "" : `${k}`) + `√${s.r}` + (s.c.d === 1 ? "" : `/${s.c.d}`);
}
// 負の数はかっこで囲む（代入の式に使う）
export const paren = (v) => (sval(S(v)) < 0 ? `(${fmtNum(v)})` : fmtNum(v));
export const fmtPoint = (p) => `(${fmtNum(p[0])}, ${fmtNum(p[1])})`;

// 係数と文字の項を並べた式（例: [[2,"x"],[-1,"y"],[3,""]] → "2x − y + 3"）。係数 0 の項は書かない。
export function fmtPoly(terms) {
  let out = "";
  for (const [coef, name] of terms) {
    const c = F(coef);
    if (c.n === 0) continue;
    const neg = c.n < 0;
    const abs = frac(Math.abs(c.n), c.d);
    let body;
    if (!name) body = fmtFrac(abs);
    else if (abs.n === 1 && abs.d === 1) body = name;
    else if (abs.d === 1) body = `${abs.n}${name}`;
    else body = `(${fmtFrac(abs)})${name}`;
    out += out ? (neg ? ` ${MINUS} ` : " + ") + body : (neg ? MINUS : "") + body;
  }
  return out || "0";
}

// 式の続きとして書く項（例: [[-4,"x"],[6,"y"]] → " − 4x + 6y"）。全部 0 なら空文字
export function fmtTail(terms) {
  const s = fmtPoly(terms);
  if (s === "0") return "";
  return s.startsWith(MINUS) ? ` ${MINUS} ${s.slice(1)}` : ` + ${s}`;
}

// ---------- 入力の読み取り ----------

// 整数・分数・√ の組み合わせだけを読む（例: 3、-2、3/2、√40、2√10、-√3/2、1/√5）。
// 戻り値 { value, text, hint } または { error }。hint は簡単にできるときの一言。
export function parseNum(raw) {
  const t = String(raw ?? "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−－ー–—‐]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/[／÷]/g, "/")
    .replace(/sqrt/gi, "√")
    .replace(/[\s()（）]/g, "");
  if (!t) return { error: "数が入っていません" };
  const part = "(\\d+)?(?:√(\\d+))?";
  const m = t.match(new RegExp(`^([+-])?${part}(?:/${part})?$`));
  if (!m || (!m[2] && !m[3]) || (t.includes("/") && !m[4] && !m[5])) {
    return { error: `「${raw}」は読めません（整数・分数・√ の組み合わせで入力します）` };
  }
  const sign = m[1] === "-" ? -1 : 1;
  const [ni, nr, di, dr] = [m[2], m[3], m[4], m[5]].map((v) => (v === undefined ? undefined : Number(v)));
  if (di === 0 || dr === 0) return { error: "0 で割ることはできません" };
  const numInt = ni ?? 1;
  const numRad = nr ?? 1;
  const denInt = di ?? 1;
  const denRad = dr ?? 1;
  const value = (sign * numInt * Math.sqrt(numRad)) / (denInt * Math.sqrt(denRad));
  // 正しい値として受け付けたうえで、簡単にできるときは一言添える
  const hints = [];
  const simpleNum = surd(numInt, numRad);
  if (nr !== undefined && simpleNum.r !== numRad && simpleNum.r !== 0) {
    hints.push(`√${numRad} は ${fmtNum(sqrtOf(numRad))} と簡単にできます`);
  }
  if (dr !== undefined && dr !== 1) {
    hints.push("分母の √ をなくす（分母を有理化する）こともできます");
  } else if (t.includes("/") && gcd(numInt, denInt) > 1) {
    hints.push(`${numInt}/${denInt} は ${fmtFrac(frac(numInt, denInt))} と約分できます`);
  } else if (t.includes("/") && denInt === 1) {
    hints.push("分母が 1 なら分数にしなくてよいです");
  }
  return { value, text: t, hint: hints.join("。") };
}

const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// ---------- 直線 ax + by + c = 0 ----------

// 係数を整数にそろえ、最大公約数で割り、x の係数（0 なら y の係数）を正にする
export function lineInt(A, B, C) {
  const fs = [F(A), F(B), F(C)];
  const l = fs.reduce((m, f) => (m * f.d) / gcd(m, f.d), 1);
  let v = fs.map((f) => (f.n * l) / f.d);
  const g = v.reduce((m, x) => gcd(m, x), 0) || 1;
  v = v.map((x) => x / g);
  if (v[0] < 0 || (v[0] === 0 && v[1] < 0)) v = v.map((x) => -x || 0);
  return { A: v[0], B: v[1], C: v[2] };
}

// 直線の入力欄の形。fields は □ の数、toLine は入力した数から [A, B, C] を作る
export const LINE_FORMS = {
  slope: { label: "y = □x + □", parts: ["y =", "x +", ""], toLine: ([m, n]) => [m, -1, n] },
  general: { label: "□x + □y + □ = 0", parts: ["", "x +", "y +", "= 0"], toLine: ([a, b, c]) => [a, b, c] },
  tangent: { label: "□x + □y = □", parts: ["", "x +", "y =", ""], toLine: ([a, b, r]) => [a, b, -r] },
  vertical: { label: "x = □", parts: ["x =", ""], toLine: ([k]) => [1, 0, -k] },
};
const formFields = (form) => LINE_FORMS[form].parts.length - 1;

// 正しい直線を、指定した形で入力するときの文字列（検証と自己テストに使う）
function lineInputs(line, form) {
  const { A, B, C } = line;
  if (form === "slope") return B === 0 ? null : [fmtFrac(frac(-A, B)), fmtFrac(frac(-C, B))];
  if (form === "general") return [A, B, C].map((v) => fmtFrac(v));
  if (form === "tangent") return [A, B, -C].map((v) => fmtFrac(v));
  if (form === "vertical") return B !== 0 || A === 0 ? null : [fmtFrac(frac(-C, A))];
  return null;
}

// 直線を、ふだんの書き方で表す
export function fmtLine(line, form = "general") {
  const { A, B, C } = line;
  if (B === 0) return `x = ${fmtFrac(frac(-C, A))}`;
  if (form === "slope" || A === 0) {
    const m = frac(-A, B);
    const n = frac(-C, B);
    return `y = ${fmtPoly([[m, "x"], [n, ""]])}`;
  }
  if (form === "tangent") return `${fmtPoly([[A, "x"], [B, "y"]])} = ${fmtFrac(-C)}`;
  return `${fmtPoly([[A, "x"], [B, "y"], [C, ""]])} = 0`;
}

// ---------- 小さな道具 ----------

const between = (v, a, b) => v >= a && v <= b;
const inRange = (p, R) => p.every((v) => Math.abs(fval(v)) <= R);
const pt = (p) => p.map(fval);
// 「x − 3」「x + 2」「x」のように、変数から数を引いた式
const minus = (name, v) => {
  const f = F(v);
  if (f.n === 0) return name;
  return f.n > 0 ? `${name} ${MINUS} ${fmtFrac(f)}` : `${name} + ${fmtFrac(fneg(f))}`;
};
// 1次方程式 ca·a + cb·b = rhs を、係数の最大公約数で割り、先頭の係数を正にして書く
const linEq = (ca, cb, rhs) => {
  let g = gcd(gcd(ca, cb), rhs) || 1;
  if (ca < 0 || (ca === 0 && cb < 0)) g = -g;
  return `${fmtPoly([[ca / g, "a"], [cb / g, "b"]])} = ${fmtFrac(rhs / g)}`;
};
// m(x − x₁) の形（m = 1 なら x − x₁、m = −1 なら −(x − x₁)）
const times = (m, inner) => {
  const f = F(m);
  if (f.n === f.d) return inner;
  if (f.n === -f.d) return `${MINUS}(${inner})`;
  return fmtPoly([[f, `(${inner})`]]);
};
// (x − a)² の形（a = 0 なら x²）
const square = (name, a) => (F(a).n === 0 ? `${name}²` : `(${minus(name, a)})²`);
const pythag = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [5, 12],
  [12, 5],
];
const isSquare = (k) => Number.isInteger(Math.sqrt(k));

// ---------- 問題の型 ----------
//
// 各型の make(rng, level) は次のオブジェクトを返す。
//   text      問題文
//   input     入力欄: { kind: "num" | "point" | "points2" | "line" | "circle" | "lincomb", label?, forms?, form? }
//   answer    正解（判定に使う）
//   answerText 正解を文字で
//   inputs    正解をそのまま入力したときの文字列（line のときは { form: 文字列[] }）。自己テストと検証に使う
//   steps     解き方（プリントの解答例の行を型にし、数値だけを入れ替えたもの）
//   alt       別解（あれば）
//   figure(input) グラフに描く図形（input は判定前なら null、判定後は読み取った値）
//   verify()  答えが問題の条件を満たすか（CI の検証用）

export const TYPES = {};

// 2点間の距離
TYPES.distance = {
  name: "2点間の距離",
  make(rng, level) {
    const L = LEVELS[level];
    const R = L.range;
    return retry(() => {
      let dx;
      let dy;
      if (level === "basic") {
        if (rng.chance(0.2)) [dx, dy] = rng.chance(0.5) ? [rng.nonzero(-6, 6), 0] : [0, rng.nonzero(-6, 6)];
        else [dx, dy] = rng.pick(pythag).map((v) => v * rng.sign());
      } else {
        dx = rng.int(-2 * R, 2 * R);
        dy = rng.int(-2 * R, 2 * R);
      }
      const d2 = dx * dx + dy * dy;
      if (d2 === 0 || d2 > L.maxRadicand + (level === "basic" ? 100 : 0)) return null;
      if (level === "exam" && isSquare(d2) && !rng.chance(0.15)) return null;
      const A = [rng.int(-R, R), rng.int(-R, R)];
      const B = [A[0] + dx, A[1] + dy];
      if (!inRange(B, R)) return null;
      const d = sqrtOf(d2);
      const steps = [
        `AB = √((x₂ ${MINUS} x₁)² + (y₂ ${MINUS} y₁)²)`,
        `= √((${B[0]} ${MINUS} ${paren(A[0])})² + (${B[1]} ${MINUS} ${paren(A[1])})²)`,
        `= √(${dx * dx} + ${dy * dy}) = √${d2}`,
      ];
      if (fmtNum(d) !== `√${d2}`) steps.push(`= ${fmtNum(d)}`);
      return {
        text: `2点 A${fmtPoint(A)}、B${fmtPoint(B)} の間の距離 AB を求めよ。`,
        input: { kind: "num", label: "AB =" },
        answer: d,
        answerText: `AB = ${fmtNum(d)}`,
        inputs: [fmtNum(d)],
        steps,
        figure: (inp) => [
          { t: "seg", a: [A[0], A[1]], b: [B[0], A[1]], c: "aux", dash: true },
          { t: "seg", a: [B[0], A[1]], b: B, c: "aux", dash: true },
          { t: "seg", a: A, b: B, c: "given" },
          { t: "pt", p: A, c: "given", label: "A" },
          { t: "pt", p: B, c: "given", label: "B" },
          ...(inp ? [{ t: "circle", center: A, r: inp, c: "input", dash: true }] : []),
        ],
        verify: () => near(sval(d) ** 2, dx * dx + dy * dy),
      };
    });
  },
};

// 内分点・中点
TYPES.division = {
  name: "内分点・中点",
  make(rng, level) {
    const R = LEVELS[level].range;
    return retry(() => {
      const mid = rng.chance(0.25);
      const m = mid ? 1 : rng.int(1, level === "basic" ? 3 : 5);
      const n = mid ? 1 : rng.int(1, level === "basic" ? 3 : 5);
      if (!mid && m === n) return null;
      let A;
      let B;
      if (level === "basic") {
        // 答え P と向き v を先に決め、A = P − m v、B = P + n v
        const P = [rng.int(-3, 3), rng.int(-3, 3)];
        const v = [rng.int(-2, 2), rng.int(-2, 2)];
        if (!v[0] && !v[1]) return null;
        A = [P[0] - m * v[0], P[1] - m * v[1]];
        B = [P[0] + n * v[0], P[1] + n * v[1]];
      } else {
        A = [rng.int(-R, R), rng.int(-R, R)];
        B = [rng.int(-R, R), rng.int(-R, R)];
      }
      if (!inRange(A, R) || !inRange(B, R) || (A[0] === B[0] && A[1] === B[1])) return null;
      const P = [0, 1].map((i) => frac(n * A[i] + m * B[i], m + n));
      if (level === "exam" && P.every(fisInt) && !rng.chance(0.3)) return null;
      const name = mid ? "M" : "P";
      const steps = mid
        ? [
            `${name} = ((x₁ + x₂)/2, (y₁ + y₂)/2)`,
            `= ((${A[0]} + ${paren(B[0])})/2, (${A[1]} + ${paren(B[1])})/2)`,
            `= ${fmtPoint(P)}`,
          ]
        : [
            `${name} = ((n·x₁ + m·x₂)/(m + n), (n·y₁ + m·y₂)/(m + n))（m = ${m}、n = ${n}）`,
            `= ((${n}×${paren(A[0])} + ${m}×${paren(B[0])})/${m + n}, (${n}×${paren(A[1])} + ${m}×${paren(B[1])})/${m + n})`,
            `= ${fmtPoint(P)}`,
          ];
      return {
        text: mid
          ? `2点 A${fmtPoint(A)}、B${fmtPoint(B)} を結ぶ線分 AB の中点 M の座標を求めよ。`
          : `2点 A${fmtPoint(A)}、B${fmtPoint(B)} を結ぶ線分 AB を ${m}:${n} に内分する点 P の座標を求めよ。`,
        input: { kind: "point", label: `${name} =` },
        answer: P,
        answerText: `${name}${fmtPoint(P)}`,
        inputs: P.map(fmtNum),
        steps,
        figure: (inp) => [
          { t: "seg", a: A, b: B, c: "given" },
          { t: "pt", p: A, c: "given", label: "A" },
          { t: "pt", p: B, c: "given", label: "B" },
          ...(inp ? [{ t: "pt", p: pt(P), c: "ans", label: name }, { t: "pt", p: inp, c: "input" }] : []),
        ],
        verify: () =>
          [0, 1].every((i) => near(n * (fval(P[i]) - A[i]), m * (B[i] - fval(P[i])))),
      };
    });
  },
};

// 傾きと1点を通る直線
TYPES.linePointSlope = {
  name: "傾きと1点を通る直線",
  make(rng, level) {
    const R = LEVELS[level].range;
    return retry(() => {
      const p = [rng.int(-R, R), rng.int(-R, R)];
      if (rng.chance(0.15)) {
        // y 軸に平行な直線
        const line = lineInt(1, 0, -p[0]);
        return {
          text: `y 軸に平行で、点 ${fmtPoint(p)} を通る直線の式を求めよ。`,
          input: { kind: "line", forms: ["vertical", "slope", "general"], form: "vertical" },
          answer: line,
          answerText: fmtLine(line),
          inputs: { vertical: lineInputs(line, "vertical"), general: lineInputs(line, "general") },
          steps: [`y 軸に平行な直線は x = k の形。点 ${fmtPoint(p)} を通るので x = ${p[0]}`],
          figure: (inp) => lineFigure([{ t: "pt", p, c: "given" }], line, inp),
          verify: () => line.A * p[0] + line.B * p[1] + line.C === 0 && line.B === 0,
        };
      }
      let m;
      if (level === "basic") m = frac(rng.nonzero(-3, 3));
      else {
        const q = rng.int(1, 4);
        m = frac(rng.nonzero(-5, 5), q);
        if (q > 1 && m.d === 1) return null;
      }
      const n = fsub(p[1], fmul(m, p[0]));
      const line = lineInt(m, -1, n);
      return {
        text: `傾きが ${fmtFrac(m)} で、点 ${fmtPoint(p)} を通る直線の式を求めよ。`,
        input: { kind: "line", forms: ["slope", "general", "vertical"], form: "slope" },
        answer: line,
        answerText: fmtLine(line, "slope"),
        inputs: { slope: lineInputs(line, "slope"), general: lineInputs(line, "general") },
        steps: [
          `y ${MINUS} y₁ = m(x ${MINUS} x₁) に代入する。`,
          `${minus("y", p[1])} = ${times(m, minus("x", p[0]))}`,
          fmtLine(line, "slope"),
        ],
        figure: (inp) => lineFigure([{ t: "pt", p, c: "given" }], line, inp),
        verify: () => line.A * p[0] + line.B * p[1] + line.C === 0 && near(-line.A / line.B, fval(m)),
      };
    });
  },
};

// 2点を通る直線
TYPES.lineTwoPoints = {
  name: "2点を通る直線",
  make(rng, level) {
    const R = LEVELS[level].range;
    return retry(() => {
      const kind = rng.next();
      let p1;
      let p2;
      if (kind < 0.12) {
        const x = rng.int(-R, R);
        p1 = [x, rng.int(-R, R)];
        p2 = [x, rng.int(-R, R)];
      } else if (kind < 0.24) {
        const y = rng.int(-R, R);
        p1 = [rng.int(-R, R), y];
        p2 = [rng.int(-R, R), y];
      } else if (level === "basic") {
        // 傾き m と切片 n を先に決め、x₁ ≠ x₂ を選んで yᵢ = m xᵢ + n
        const m = rng.nonzero(-3, 3);
        const n = rng.int(-4, 4);
        const x1 = rng.int(-3, 3);
        const x2 = rng.int(-3, 3);
        p1 = [x1, m * x1 + n];
        p2 = [x2, m * x2 + n];
      } else {
        p1 = [rng.int(-R, R), rng.int(-R, R)];
        p2 = [rng.int(-R, R), rng.int(-R, R)];
      }
      if ((p1[0] === p2[0] && p1[1] === p2[1]) || !inRange(p1, R + 3) || !inRange(p2, R + 3)) return null;
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const line = lineInt(dy, -dx, dx * p1[1] - dy * p1[0]);
      const base = {
        text: `2点 ${fmtPoint(p1)}、${fmtPoint(p2)} を通る直線の式を求めよ。`,
        answer: line,
        figure: (inp) =>
          lineFigure(
            [
              { t: "pt", p: p1, c: "given" },
              { t: "pt", p: p2, c: "given" },
            ],
            line,
            inp,
          ),
        verify: () => [p1, p2].every((p) => line.A * p[0] + line.B * p[1] + line.C === 0),
      };
      if (dx === 0) {
        return {
          ...base,
          input: { kind: "line", forms: ["vertical", "slope", "general"], form: "slope" },
          answerText: fmtLine(line),
          inputs: { vertical: lineInputs(line, "vertical"), general: lineInputs(line, "general") },
          steps: [`2点の x 座標がどちらも ${p1[0]} なので、y 軸に平行な直線 x = ${p1[0]}`],
        };
      }
      const m = frac(dy, dx);
      if (level === "exam" && m.d === 1 && dy !== 0 && !rng.chance(0.3)) return null;
      if (dy === 0) {
        return {
          ...base,
          input: { kind: "line", forms: ["slope", "general", "vertical"], form: "slope" },
          answerText: fmtLine(line, "slope"),
          inputs: { slope: lineInputs(line, "slope"), general: lineInputs(line, "general") },
          steps: [`2点の y 座標がどちらも ${p1[1]} なので、傾き 0（x 軸に平行）の直線 y = ${p1[1]}`],
        };
      }
      return {
        ...base,
        input: { kind: "line", forms: ["slope", "general", "vertical"], form: "slope" },
        answerText: fmtLine(line, "slope"),
        inputs: { slope: lineInputs(line, "slope"), general: lineInputs(line, "general") },
        steps: [
          `傾き m = (y₂ ${MINUS} y₁)/(x₂ ${MINUS} x₁) = (${p2[1]} ${MINUS} ${paren(p1[1])})/(${p2[0]} ${MINUS} ${paren(p1[0])}) = ${fmtFrac(m)}`,
          `公式 (I) y ${MINUS} y₁ = m(x ${MINUS} x₁) に代入する: ${minus("y", p1[1])} = ${times(m, minus("x", p1[0]))}`,
          fmtLine(line, "slope"),
        ],
        alt: [
          `公式 (II) y ${MINUS} y₁ = (y₂ ${MINUS} y₁)/(x₂ ${MINUS} x₁)·(x ${MINUS} x₁) に、2点の座標をそのまま代入してもよい。`,
        ],
      };
    });
  },
};

// 平行・垂直な直線
TYPES.lineParallelPerp = {
  name: "平行・垂直な直線",
  make(rng, level) {
    const R = LEVELS[level].range;
    return retry(() => {
      const a = rng.int(1, level === "basic" ? 3 : 5);
      const b = level === "basic" ? rng.pick([-1, 1]) : rng.nonzero(-5, 5);
      const c = rng.int(-9, 9);
      if (gcd(gcd(a, b), c) !== 1) return null;
      const given = lineInt(a, b, c);
      const P = [rng.int(-R, R), rng.int(-R, R)];
      if (given.A * P[0] + given.B * P[1] + given.C === 0) return null;
      const par = rng.chance(0.5);
      const [A, B] = par ? [given.A, given.B] : [given.B, -given.A];
      const k = -(A * P[0] + B * P[1]);
      const line = lineInt(A, B, k);
      const slope = frac(-given.A, given.B);
      const word = par ? "平行" : "垂直";
      return {
        text: `点 P${fmtPoint(P)} を通り、直線 ${fmtLine(given)} に${word}な直線の式を求めよ。`,
        input: { kind: "line", forms: ["general", "slope", "vertical"], form: "general" },
        answer: line,
        answerText: `${fmtLine(line)}（${fmtLine(line, "slope")} でもよい）`,
        inputs: { general: lineInputs(line, "general"), slope: lineInputs(line, "slope") },
        steps: [
          `直線 ${fmtLine(given)} の傾きは ${fmtFrac(slope)}`,
          par
            ? `平行な直線は傾きが等しいので ${fmtPoly([[A, "x"], [B, "y"]])} + k = 0 とおける。`
            : `垂直な直線は傾きの積が ${MINUS}1 なので ${fmtPoly([[A, "x"], [B, "y"]])} + k = 0 とおける（x と y の係数を入れ替え、片方の符号を変える）。`,
          `点 P を代入: ${paren(A)}×${paren(P[0])} + ${paren(B)}×${paren(P[1])} + k = 0 より k = ${k}`,
          `${fmtLine(lineInt(A, B, k))}`,
        ],
        figure: (inp) =>
          lineFigure(
            [
              { t: "line", line: given, c: "aux" },
              { t: "pt", p: P, c: "given", label: "P" },
            ],
            line,
            inp,
          ),
        verify: () => {
          const onP = line.A * P[0] + line.B * P[1] + line.C === 0;
          const rel = par
            ? line.A * given.B - line.B * given.A === 0
            : line.A * given.A + line.B * given.B === 0;
          return onP && rel;
        },
      };
    });
  },
};

// 直線に関して対称な点
TYPES.symmetricPoint = {
  name: "直線に関して対称な点",
  make(rng, level) {
    const R = LEVELS[level].range;
    return retry(() => {
      // P と Q を先に決め、ℓ を PQ の垂直二等分線にする
      const P = [rng.int(-R, R), rng.int(-R, R)];
      let u;
      let v;
      if (level === "basic") {
        const k = rng.nonzero(-4, 4);
        [u, v] = rng.pick([
          [k, 0],
          [0, k],
          [k, k],
          [k, -k],
        ]);
      } else {
        u = rng.int(-6, 6);
        v = rng.int(-6, 6);
        if (u === 0 || v === 0 || Math.abs(u) === Math.abs(v)) return null;
      }
      if (!u && !v) return null;
      const Q = [P[0] + u, P[1] + v];
      if (!inRange(Q, R)) return null;
      const line = lineInt(2 * u, 2 * v, -(u * (P[0] + Q[0]) + v * (P[1] + Q[1])));
      const { A, B, C } = line;
      if (Math.max(Math.abs(A), Math.abs(B), Math.abs(C)) > 20) return null;
      // 解1: ① PQ ⊥ ℓ、② 中点が ℓ 上
      const eq1 =
        B === 0
          ? `ℓ は y 軸に平行なので、PQ は x 軸に平行: b = ${P[1]} … ①`
          : A === 0
            ? `ℓ は x 軸に平行なので、PQ は y 軸に平行: a = ${P[0]} … ①`
            : `ℓ の傾きは ${fmtFrac(frac(-A, B))}。PQ ⊥ ℓ より PQ の傾きは ${fmtFrac(frac(B, A))}: (${minus("b", P[1])})/(${minus("a", P[0])}) = ${fmtFrac(frac(B, A))}。整理して ${linEq(B, -A, B * P[0] - A * P[1])} … ①`;
      const eq2 = `線分 PQ の中点 ((${minus("a", -P[0])})/2, (${minus("b", -P[1])})/2) が ℓ の上にあるので、代入して整理すると ${linEq(A, B, -2 * C - A * P[0] - B * P[1])} … ②`;
      const Rm = [frac(P[0] + Q[0], 2), frac(P[1] + Q[1], 2)];
      return {
        text: `直線 ℓ: ${fmtLine(line)} に関して、点 P${fmtPoint(P)} と対称な点 Q の座標を求めよ。`,
        input: { kind: "point", label: "Q =" },
        answer: Q.map((x) => frac(x)),
        answerText: `Q${fmtPoint(Q)}`,
        inputs: Q.map((x) => fmtNum(x)),
        steps: [`求める点を Q(a, b) とする。`, eq1, eq2, `①、② を解いて a = ${Q[0]}、b = ${Q[1]}。Q${fmtPoint(Q)}`],
        alt: [
          `P を通り ℓ に垂直な直線と ℓ の交点 R${fmtPoint(Rm)} が PQ の中点なので、Q = 2R ${MINUS} P = ${fmtPoint(Q)}`,
        ],
        figure: (inp) => [
          { t: "line", line, c: "given", label: "ℓ" },
          { t: "pt", p: P, c: "given", label: "P" },
          ...(inp
            ? [
                { t: "seg", a: P, b: Q, c: "ans", dash: true },
                { t: "pt", p: Q, c: "ans", label: "Q" },
                { t: "pt", p: inp, c: "input" },
              ]
            : []),
        ],
        verify: () => {
          const M = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          const onL = near(A * M[0] + B * M[1] + C, 0);
          const perp = near(B * (Q[0] - P[0]) - A * (Q[1] - P[1]), 0);
          return onL && perp;
        },
      };
    });
  },
};

// 円の中心と半径
TYPES.circleCenterRadius = {
  name: "円の中心と半径",
  make(rng, level) {
    return retry(() => {
      const a = rng.int(-5, 5);
      const b = rng.int(-5, 5);
      let r2;
      if (level === "basic") r2 = rng.int(1, 7) ** 2;
      else {
        r2 = rng.int(2, 50);
        if (isSquare(r2) && !rng.chance(0.3)) return null;
      }
      const n = a * a + b * b - r2;
      const r = sqrtOf(r2);
      // 定数項を右辺に移した書き方（過去問の形）も混ぜる
      const rhs = rng.chance(0.4) && n !== 0;
      const eq = rhs
        ? `x² + y²${fmtTail([[-2 * a, "x"], [-2 * b, "y"]])} = ${fmtFrac(-n)}`
        : `x² + y²${fmtTail([[-2 * a, "x"], [-2 * b, "y"], [n, ""]])} = 0`;
      return {
        text: `円 ${eq} の中心の座標と半径を求めよ。`,
        input: { kind: "circle" },
        answer: { center: [frac(a), frac(b)], r },
        answerText: `中心 ${fmtPoint([a, b])}、半径 ${fmtNum(r)}`,
        inputs: [fmtFrac(a), fmtFrac(b), fmtNum(r)],
        steps: [
          `x、y それぞれで平方完成する。`,
          `${a ? `(x²${fmtTail([[-2 * a, "x"]])})` : "x²"} + ${b ? `(y²${fmtTail([[-2 * b, "y"]])})` : "y²"} = ${fmtFrac(-n)}`,
          `${square("x", a)} + ${square("y", b)} = ${fmtFrac(-n)}${a ? ` + ${a * a}` : ""}${b ? ` + ${b * b}` : ""} = ${r2}`,
          `中心 ${fmtPoint([a, b])}、半径 √${r2}${fmtNum(r) !== `√${r2}` ? ` = ${fmtNum(r)}` : ""}`,
        ],
        figure: (inp) => [
          ...(inp
            ? [
                { t: "circle", center: [a, b], r: sval(r), c: "ans" },
                { t: "pt", p: [a, b], c: "ans" },
                ...(inp.r > 0 ? [{ t: "circle", center: inp.center, r: inp.r, c: "input", dash: true }] : []),
                { t: "pt", p: inp.center, c: "input" },
              ]
            : []),
        ],
        verify: () => near(fval(fadd(a * a + b * b, -r2)), n) && near(sval(r) ** 2, r2),
      };
    });
  },
};

// 円上の点における接線
const latticeOnCircle = (r2) => {
  const out = [];
  const r = Math.floor(Math.sqrt(r2));
  for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) if (x * x + y * y === r2) out.push([x, y]);
  return out;
};
TYPES.circleTangent = {
  name: "円上の点における接線",
  make(rng, level) {
    return retry(() => {
      const r2 = level === "basic" ? rng.pick([4, 9, 16, 25, 25, 25]) : rng.pick([2, 5, 8, 10, 13, 17, 18, 20, 25, 26, 29]);
      const pts = latticeOnCircle(r2);
      const P = rng.pick(pts);
      const line = lineInt(P[0], P[1], -r2);
      return {
        text: `円 x² + y² = ${r2} の上の点 P${fmtPoint(P)} における接線の式を求めよ。`,
        input: { kind: "line", forms: ["tangent", "slope", "general", "vertical"], form: "tangent" },
        answer: line,
        answerText: `${fmtPoly([[P[0], "x"], [P[1], "y"]])} = ${r2}` + (line.A === 0 || line.B === 0 ? `（${fmtLine(line, "slope")}）` : ""),
        inputs: { tangent: [P[0], P[1], r2].map((v) => fmtFrac(v)), general: lineInputs(line, "general") },
        steps: [
          `円 x² + y² = r² の上の点 (x₁, y₁) における接線は x₁x + y₁y = r²`,
          `x₁ = ${P[0]}、y₁ = ${P[1]}、r² = ${r2} を代入して ${fmtPoly([[P[0], "x"], [P[1], "y"]])} = ${r2}`,
          ...(line.A === 0 || line.B === 0 ? [`整理すると ${fmtLine(line, "slope")}`] : []),
        ],
        figure: (inp) =>
          lineFigure(
            [
              { t: "circle", center: [0, 0], r: Math.sqrt(r2), c: "given" },
              { t: "pt", p: P, c: "given", label: "P" },
            ],
            line,
            inp,
          ),
        verify: () => P[0] ** 2 + P[1] ** 2 === r2 && line.A * P[0] + line.B * P[1] + line.C === 0 && line.A * P[1] - line.B * P[0] === 0,
      };
    });
  },
};

// 楕円・双曲線の2焦点
TYPES.conicFoci = {
  name: "楕円・双曲線の2焦点",
  make(rng, level) {
    return retry(() => {
      const ellipse = rng.chance(0.5);
      const flip = rng.chance(0.5); // 楕円: 縦長、双曲線: 右辺が −1
      let A;
      let B;
      let c2;
      if (level === "basic") {
        const c = rng.int(1, 5);
        c2 = c * c;
        if (ellipse) {
          const small = rng.int(1, 20);
          [A, B] = flip ? [small, small + c2] : [small + c2, small];
        } else {
          if (c2 < 2) return null;
          A = rng.int(1, c2 - 1);
          B = c2 - A;
        }
      } else {
        A = rng.int(2, 40);
        B = rng.int(2, 40);
        if (A === B) return null;
        if (ellipse) {
          if (flip !== B > A) return null;
          c2 = Math.abs(A - B);
        } else c2 = A + B;
        if (c2 > LEVELS.exam.maxRadicand) return null;
        if (isSquare(c2) && !rng.chance(0.3)) return null;
      }
      if (A > 50 || B > 50) return null;
      const c = sqrtOf(c2);
      const onY = ellipse ? B > A : flip;
      const foci = onY
        ? [
            [frac(0), c],
            [frac(0), surd(fneg(c.c), c.r)],
          ]
        : [
            [c, frac(0)],
            [surd(fneg(c.c), c.r), frac(0)],
          ];
      const eq = ellipse ? `x²/${A} + y²/${B} = 1` : `x²/${A} ${MINUS} y²/${B} = ${flip ? `${MINUS}1` : "1"}`;
      const kindText = ellipse
        ? `a² = ${A}、b² = ${B} で ${onY ? "b > a より縦長" : "a > b より横長"}の楕円。`
        : `a² = ${A}、b² = ${B} で、右辺が ${flip ? `${MINUS}1 より上下に` : "1 より左右に"}開く双曲線。`;
      const cText = ellipse
        ? `c = √(${onY ? "b² − a²" : "a² − b²"}) = √(${onY ? B : A} ${MINUS} ${onY ? A : B}) = √${c2}`
        : `c = √(a² + b²) = √(${A} + ${B}) = √${c2}`;
      const ans = (p) => `(${fmtNum(p[0])}, ${fmtNum(p[1])})`;
      const sa = Math.sqrt(A);
      const sb = Math.sqrt(B);
      return {
        text: `式 ${eq} が表す${ellipse ? "楕円" : "双曲線"}の2つの焦点の座標を求めよ。`,
        input: { kind: "points2" },
        answer: foci,
        answerText: `${ans(foci[0])}、${ans(foci[1])}`,
        inputs: foci.flat().map(fmtNum),
        steps: [
          kindText,
          `焦点は ${onY ? "(0, c)、(0, −c)" : "(c, 0)、(−c, 0)"}。${cText}${fmtNum(c) !== `√${c2}` ? ` = ${fmtNum(c)}` : ""}`,
          `焦点 ${ans(foci[0])}、${ans(foci[1])}`,
        ],
        figure: (inp) => [
          ellipse
            ? { t: "curve", pts: sample(0, 2 * Math.PI, (t) => [sa * Math.cos(t), sb * Math.sin(t)]), c: "given" }
            : hyperbola(sa, sb, flip),
          ...(ellipse ? [] : [hyperbola(sa, sb, flip, true)]),
          ...(inp
            ? [
                { t: "pt", p: foci[0].map((x) => sval(S(x))), c: "ans", label: "F₁" },
                { t: "pt", p: foci[1].map((x) => sval(S(x))), c: "ans", label: "F₂" },
                { t: "pt", p: inp[0], c: "input" },
                { t: "pt", p: inp[1], c: "input" },
              ]
            : []),
        ],
        verify: () => {
          const cc = sval(c) ** 2;
          return ellipse ? near(cc, Math.abs(A - B)) : near(cc, A + B);
        },
      };
    });
  },
};
const sample = (a, b, f, n = 120) => Array.from({ length: n + 1 }, (_, i) => f(a + ((b - a) * i) / n));
function hyperbola(a, b, up, second = false) {
  const s = second ? -1 : 1;
  const ch = (t) => (Math.exp(t) + Math.exp(-t)) / 2;
  const sh = (t) => (Math.exp(t) - Math.exp(-t)) / 2;
  return {
    t: "curve",
    pts: sample(-2.5, 2.5, (t) => (up ? [a * sh(t), s * b * ch(t)] : [s * a * ch(t), b * sh(t)])),
    c: "given",
  };
}

// 単位ベクトル
TYPES.unitVector = {
  name: "単位ベクトル",
  make(rng, level) {
    return retry(() => {
      let a;
      if (level === "basic") a = rng.pick(pythag).map((v) => v * rng.sign());
      else a = [rng.int(-7, 7), rng.int(-7, 7)];
      const k = a[0] ** 2 + a[1] ** 2;
      if (k === 0 || (level === "exam" && isSquare(k) && !rng.chance(0.2))) return null;
      if (level === "basic" && !isSquare(k)) return null;
      const same = rng.chance(0.7);
      const s = same ? 1 : -1;
      const len = sqrtOf(k);
      // a₁/√k = a₁√k/k（分母を有理化した形）
      const e = a.map((x) => surd(frac(s * x, k), k));
      return {
        text: `ベクトル a = ${fmtPoint(a)} と${same ? "同じ" : "逆"}向きの単位ベクトル e を成分で求めよ。`,
        input: { kind: "point", label: "e =" },
        answer: e,
        answerText: `e = ${fmtPoint(e)}`,
        inputs: e.map(fmtNum),
        steps: [
          `|a| = √(${paren(a[0])}² + ${paren(a[1])}²) = √${k}${fmtNum(len) !== `√${k}` ? ` = ${fmtNum(len)}` : ""}`,
          `${same ? "" : MINUS}a/|a| = ${same ? "" : MINUS}(${paren(a[0])}/${isSquare(k) ? fmtNum(len) : `(${fmtNum(len)})`}, ${paren(a[1])}/${isSquare(k) ? fmtNum(len) : `(${fmtNum(len)})`}) = ${fmtPoint(e)}`,
          ...(isSquare(k) ? [] : ["（分母の √ をなくした形。1/√5 のような形でも正解にする）"]),
        ],
        figure: (inp) => [
          { t: "circle", center: [0, 0], r: 1, c: "aux", dash: true },
          { t: "arrow", a: [0, 0], b: a, c: "given", label: "a" },
          ...(inp
            ? [
                { t: "arrow", a: [0, 0], b: e.map(sval), c: "ans", label: "e" },
                { t: "arrow", a: [0, 0], b: inp, c: "input", dash: true },
              ]
            : []),
        ],
        verify: () => near(sval(e[0]) ** 2 + sval(e[1]) ** 2, 1) && near(sval(e[0]) * a[1] - sval(e[1]) * a[0], 0) && sval(e[0]) * a[0] + sval(e[1]) * a[1] > 0 === same,
      };
    });
  },
};

// 垂直・平行になる x
TYPES.perpParallelX = {
  name: "垂直・平行になる x",
  make(rng, level) {
    return retry(() => {
      const a = [rng.nonzero(-5, 5), rng.nonzero(-5, 5)];
      const known = rng.nonzero(-6, 6);
      const xFirst = rng.chance(0.6); // b = (x, known) か (known, x) か
      const perp = rng.chance(0.5);
      // b = (x, k): ⊥ a₁x + a₂k = 0、∥ a₁k − a₂x = 0 / b = (k, x): ⊥ a₁k + a₂x = 0、∥ a₁x − a₂k = 0
      let x;
      if (xFirst) x = perp ? frac(-a[1] * known, a[0]) : frac(a[0] * known, a[1]);
      else x = perp ? frac(-a[0] * known, a[1]) : frac(a[1] * known, a[0]);
      if (level === "basic" && !fisInt(x)) return null;
      if (level === "exam" && fisInt(x) && !rng.chance(0.4)) return null;
      if (Math.abs(fval(x)) > 15) return null;
      const bText = xFirst ? `(x, ${known})` : `(${known}, x)`;
      const b = xFirst ? [x, frac(known)] : [frac(known), x];
      const bv = (xx) => (xFirst ? [xx, known] : [known, xx]);
      const eq = perp
        ? xFirst
          ? `${a[0]}x + ${paren(a[1])}×${paren(known)} = 0`
          : `${a[0]}×${paren(known)} + ${paren(a[1])}x = 0`
        : xFirst
          ? `${a[0]}×${paren(known)} ${MINUS} ${paren(a[1])}x = 0`
          : `${a[0]}x ${MINUS} ${paren(a[1])}×${paren(known)} = 0`;
      return {
        text: `ベクトル a = ${fmtPoint(a)}、b = ${bText} について、a ${perp ? "⊥" : "∥"} b（${perp ? "垂直" : "平行"}）となる x の値を求めよ。`,
        input: { kind: "num", label: "x =" },
        answer: surd(x),
        answerText: `x = ${fmtFrac(x)}`,
        inputs: [fmtFrac(x)],
        steps: [
          perp ? "a ⊥ b ⟺ a·b = a₁b₁ + a₂b₂ = 0" : "a ∥ b ⟺ a₁b₂ − a₂b₁ = 0",
          `${eq}`,
          `x = ${fmtFrac(x)}`,
        ],
        figure: (inp) => [
          { t: "arrow", a: [0, 0], b: a, c: "given", label: "a" },
          ...(inp !== null && inp !== undefined
            ? [
                { t: "arrow", a: [0, 0], b: pt(b), c: "ans", label: "b" },
                { t: "arrow", a: [0, 0], b: bv(inp), c: "input", dash: true },
              ]
            : []),
        ],
        verify: () => {
          const bb = pt(b);
          return perp ? near(a[0] * bb[0] + a[1] * bb[1], 0) : near(a[0] * bb[1] - a[1] * bb[0], 0);
        },
      };
    });
  },
};

// 線形結合
TYPES.linearCombination = {
  name: "線形結合",
  make(rng, level) {
    return retry(() => {
      const a = [rng.int(-4, 4), rng.int(-4, 4)];
      const b = [rng.int(-4, 4), rng.int(-4, 4)];
      const det = a[0] * b[1] - a[1] * b[0];
      if (det === 0) return null;
      let m;
      let n;
      let c;
      if (level === "basic") {
        // 係数 m, n を先に決め、c = ma + nb
        m = frac(rng.nonzero(-3, 3));
        n = frac(rng.nonzero(-3, 3));
        c = [0, 1].map((i) => fval(m) * a[i] + fval(n) * b[i]);
        if (!inRange(c, 9)) return null;
      } else {
        if (Math.abs(det) > 6) return null;
        c = [rng.int(-7, 7), rng.int(-7, 7)];
        // クラメルの公式で m, n を分数のまま求める
        m = frac(c[0] * b[1] - c[1] * b[0], det);
        n = frac(a[0] * c[1] - a[1] * c[0], det);
        if (m.n === 0 || n.n === 0 || (fisInt(m) && fisInt(n) && !rng.chance(0.3))) return null;
      }
      return {
        text: `ベクトル a = ${fmtPoint(a)}、b = ${fmtPoint(b)}、c = ${fmtPoint(c)} について、c を a と b の線形結合で表せ。`,
        input: { kind: "lincomb" },
        answer: [m, n],
        answerText: `c = ${fmtPoly([[m, "a"], [n, "b"]])}`,
        inputs: [fmtFrac(m), fmtFrac(n)],
        steps: [
          `c = ma + nb とおくと ${fmtPoint(c)} = m${fmtPoint(a)} + n${fmtPoint(b)}`,
          `成分を比べて ${fmtPoly([[a[0], "m"], [b[0], "n"]])} = ${c[0]}、${fmtPoly([[a[1], "m"], [b[1], "n"]])} = ${c[1]}`,
          `これを解いて m = ${fmtFrac(m)}、n = ${fmtFrac(n)}`,
          `c = ${fmtPoly([[m, "a"], [n, "b"]])}`,
        ],
        figure: (inp) => {
          const ma = a.map((v) => fval(m) * v);
          const nb = b.map((v) => fval(n) * v);
          return [
            { t: "arrow", a: [0, 0], b: a, c: "given", label: "a" },
            { t: "arrow", a: [0, 0], b, c: "given", label: "b" },
            { t: "arrow", a: [0, 0], b: c, c: "given", label: "c" },
            ...(inp
              ? [
                  { t: "seg", a: [0, 0], b: ma, c: "ans" },
                  { t: "seg", a: ma, b: c, c: "ans" },
                  { t: "seg", a: [0, 0], b: nb, c: "ans" },
                  { t: "seg", a: nb, b: c, c: "ans" },
                  { t: "arrow", a: [0, 0], b: [0, 1].map((i) => inp[0] * a[i] + inp[1] * b[i]), c: "input", dash: true },
                ]
              : []),
          ];
        },
        verify: () => [0, 1].every((i) => near(fval(m) * a[i] + fval(n) * b[i], c[i])),
      };
    });
  },
};

// 直線の問題の図: 与えられた図形、正解の直線（判定後）、入力した直線（判定後）
function lineFigure(given, line, inp) {
  return [
    ...given,
    ...(inp ? [{ t: "line", line, c: "ans" }, ...(inp.A || inp.B ? [{ t: "line", line: inp, c: "input", dash: true }] : [])] : []),
  ];
}

// ---------- 問題を作る・答え合わせをする ----------

// 文中の「-3」のような負の数の符号を、数学の書き方（U+2212）にそろえる
const fixMinus = (t) => t.replace(/(^|[\s(（=,、:×+/])-(?=[\d√])/g, `$1${MINUS}`);

export function makeProblem(type, level, seed) {
  const rng = makeRng(seed);
  const p = TYPES[type].make(rng, level);
  return {
    ...p,
    text: fixMinus(p.text),
    answerText: fixMinus(p.answerText),
    steps: p.steps.map(fixMinus),
    alt: p.alt?.map(fixMinus),
    type,
    level,
    seed,
    typeName: TYPES[type].name,
  };
}

// 入力欄の数（直線は形ごと）
export function inputFieldCount(p, form) {
  switch (p.input.kind) {
    case "num":
      return 1;
    case "point":
    case "lincomb":
      return 2;
    case "circle":
      return 3;
    case "points2":
      return 4;
    case "line":
      return formFields(form ?? p.input.form);
  }
  return 0;
}

// 答え合わせ。values は入力欄の文字列、form は直線の形。
// 戻り値 { ok, errors: [読めない入力], wrong: [違う部分], hints: [一言], figureInput: グラフに描く入力の値 }
export function judge(p, values, form) {
  const parsed = values.map(parseNum);
  const errors = parsed.filter((x) => x.error).map((x) => x.error);
  if (errors.length) return { ok: false, errors, wrong: [], hints: [], figureInput: null };
  const v = parsed.map((x) => x.value);
  const hints = [...new Set(parsed.map((x) => x.hint).filter(Boolean))];
  const wrong = [];
  let figureInput = null;
  switch (p.input.kind) {
    case "num": {
      if (!near(v[0], sval(p.answer))) wrong.push("値");
      figureInput = v[0];
      break;
    }
    case "point": {
      const ans = p.answer.map((x) => sval(S(x)));
      if (!near(v[0], ans[0])) wrong.push("x 座標（1つ目の成分）");
      if (!near(v[1], ans[1])) wrong.push("y 座標（2つ目の成分）");
      figureInput = [v[0], v[1]];
      break;
    }
    case "points2": {
      const ans = p.answer.map((q) => q.map((x) => sval(S(x))));
      const same = (q, r) => near(q[0], r[0]) && near(q[1], r[1]);
      const a = [v[0], v[1]];
      const b = [v[2], v[3]];
      if (!((same(a, ans[0]) && same(b, ans[1])) || (same(a, ans[1]) && same(b, ans[0])))) {
        const hit = [a, b].filter((q) => ans.some((r) => same(q, r))).length;
        wrong.push(hit === 1 ? "焦点の片方" : "焦点");
      }
      figureInput = [a, b];
      break;
    }
    case "circle": {
      const [a, b] = p.answer.center.map(fval);
      if (!near(v[0], a) || !near(v[1], b)) wrong.push("中心");
      if (!near(v[2], sval(p.answer.r))) wrong.push("半径");
      figureInput = { center: [v[0], v[1]], r: v[2] };
      break;
    }
    case "lincomb": {
      if (!near(v[0], fval(p.answer[0]))) wrong.push("a の係数");
      if (!near(v[1], fval(p.answer[1]))) wrong.push("b の係数");
      figureInput = [v[0], v[1]];
      break;
    }
    case "line": {
      const [A, B, C] = LINE_FORMS[form].toLine(v);
      const { A: A0, B: B0, C: C0 } = p.answer;
      // 係数が比例していれば同じ直線
      const prop = near(A * B0, B * A0) && near(A * C0, C * A0) && near(B * C0, C * B0);
      if (!(A || B) || !prop) wrong.push("直線の式");
      figureInput = { A, B, C };
      break;
    }
  }
  return { ok: wrong.length === 0, errors: [], wrong, hints, figureInput };
}

// 正しい答えの入力（自己テスト・検証用）。直線は答えを入れられる形のうち最初のもの
export function correctInputs(p) {
  if (p.input.kind !== "line") return { form: undefined, values: p.inputs };
  const form = p.input.forms.find((f) => p.inputs[f]);
  return { form, values: p.inputs[form] };
}
