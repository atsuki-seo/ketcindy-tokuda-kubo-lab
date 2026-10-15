// 練習問題ページの画面。tools/drill-build.mjs がページに埋め込む（Drill は tools/drill/core.mjs の中身）。
// 問題の型を選ぶ → 数値をランダムに変えた問題が出る → 答えを入力して答え合わせ
// → 正誤と解き方を表示し、グラフに正解（実線）と入力した答え（破線）を重ねて描く → 次の問題。
// 正解数はページを開いている間だけ数え、保存も送信もしない。
// グラフは CindyJS で描く。図形の座標をこのファイルで画面の座標に直し、CindyScript の変数 Shapes に渡す。
/* global Drill, DRILL, cdy */
(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };
  var state = { problem: null, form: null, counted: false, right: 0, total: 0, lastInput: null };

  function randomSeed() {
    try {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    } catch (e) {
      return Math.floor(Math.random() * 4294967296);
    }
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- 入力欄 ----------

  function numInput(label) {
    var i = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": label });
    i.addEventListener("focus", function () {
      state.lastInput = i;
    });
    i.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        check();
      }
    });
    return i;
  }

  function addText(row, t) {
    if (t) row.appendChild(el("span", {}, t));
  }

  function buildAnswer(p) {
    var box = $("answer");
    box.textContent = "";
    var row = el("div", { class: "answer-row" });
    box.appendChild(row);
    var k = p.input.kind;
    if (k === "num") {
      addText(row, p.input.label);
      row.appendChild(numInput(p.input.label));
    } else if (k === "point") {
      addText(row, p.input.label + " (");
      row.appendChild(numInput("1つ目の成分"));
      addText(row, ",");
      row.appendChild(numInput("2つ目の成分"));
      addText(row, ")");
    } else if (k === "points2") {
      addText(row, "(");
      row.appendChild(numInput("1つ目の点の x 座標"));
      addText(row, ",");
      row.appendChild(numInput("1つ目の点の y 座標"));
      addText(row, ")、(");
      row.appendChild(numInput("2つ目の点の x 座標"));
      addText(row, ",");
      row.appendChild(numInput("2つ目の点の y 座標"));
      addText(row, ")");
    } else if (k === "circle") {
      addText(row, "中心 (");
      row.appendChild(numInput("中心の x 座標"));
      addText(row, ",");
      row.appendChild(numInput("中心の y 座標"));
      addText(row, ")　半径");
      row.appendChild(numInput("半径"));
    } else if (k === "lincomb") {
      addText(row, "c =");
      row.appendChild(numInput("a の係数"));
      addText(row, "a +");
      row.appendChild(numInput("b の係数"));
      addText(row, "b");
    } else if (k === "line") {
      // 直線は「y = □x + □」「□x + □y + □ = 0」「x = □」などから形を選べる
      var sel = el("select", { "aria-label": "直線の式の形" });
      p.input.forms.forEach(function (f) {
        var o = el("option", { value: f }, Drill.LINE_FORMS[f].label);
        sel.appendChild(o);
      });
      state.form = p.input.form;
      sel.value = state.form;
      sel.addEventListener("change", function () {
        state.form = sel.value;
        buildLineRow(lineRow);
      });
      var formRow = el("div", { class: "answer-row" });
      formRow.appendChild(el("span", {}, "式の形"));
      formRow.appendChild(sel);
      box.insertBefore(formRow, row);
      var lineRow = row;
      buildLineRow(lineRow);
    }
  }

  function buildLineRow(row) {
    row.textContent = "";
    var parts = Drill.LINE_FORMS[state.form].parts;
    for (var i = 0; i < parts.length; i++) {
      addText(row, parts[i]);
      if (i < parts.length - 1) row.appendChild(numInput("係数 " + (i + 1)));
    }
  }

  function inputValues() {
    return Array.prototype.map.call(document.querySelectorAll("#answer input"), function (i) {
      return i.value;
    });
  }

  // ---------- グラフ（CindyJS） ----------

  // 色: 0 与えられた図形 / 1 正解 / 2 入力した答え / 3 方眼 / 4 軸・補助線
  var COLOR = { given: 0, ans: 1, input: 2, grid: 3, aux: 4 };
  // キャンバスの座標系（ページの visibleRect と同じ）
  var VIEW = { w: 20, h: 15 };

  function niceStep(span) {
    var raw = span / 10;
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var r = raw / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
  }

  function bounds(shapes) {
    var xs = [0];
    var ys = [0];
    var add = function (q) {
      if (q && isFinite(q[0]) && isFinite(q[1])) {
        xs.push(q[0]);
        ys.push(q[1]);
      }
    };
    shapes.forEach(function (s) {
      if (s.t === "pt") add(s.p);
      if (s.t === "seg" || s.t === "arrow") {
        add(s.a);
        add(s.b);
      }
      if (s.t === "circle" && isFinite(s.r) && s.r > 0 && s.r < 50) {
        add([s.center[0] - s.r, s.center[1] - s.r]);
        add([s.center[0] + s.r, s.center[1] + s.r]);
      }
      if (s.t === "curve") s.pts.forEach(function (q) {
        if (Math.abs(q[0]) < 8 && Math.abs(q[1]) < 8) add(q);
      });
    });
    var x0 = Math.min.apply(null, xs);
    var x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys);
    var y1 = Math.max.apply(null, ys);
    // 小さすぎるときは ±3 まで広げ、少し余白を付けて、キャンバスの縦横比にそろえる
    x0 = Math.min(x0, -3) - 1;
    x1 = Math.max(x1, 3) + 1;
    y0 = Math.min(y0, -3) - 1;
    y1 = Math.max(y1, 3) + 1;
    var cx = (x0 + x1) / 2;
    var cy = (y0 + y1) / 2;
    var scale = Math.max((x1 - x0) / VIEW.w, (y1 - y0) / VIEW.h);
    return { cx: cx, cy: cy, scale: scale, x0: cx - (VIEW.w / 2) * scale, x1: cx + (VIEW.w / 2) * scale, y0: cy - (VIEW.h / 2) * scale, y1: cy + (VIEW.h / 2) * scale };
  }

  // 直線 ax + by + c = 0 を表示範囲で切り取った線分
  function clipLine(line, b) {
    var A = line.A, B = line.B, C = line.C;
    var pts = [];
    if (Math.abs(B) > 1e-12) {
      [b.x0, b.x1].forEach(function (x) {
        pts.push([x, -(A * x + C) / B]);
      });
    } else if (Math.abs(A) > 1e-12) {
      [b.y0, b.y1].forEach(function (y) {
        pts.push([-(B * y + C) / A, y]);
      });
    }
    return pts.length === 2 ? pts : null;
  }

  function render(shapes) {
    var b = bounds(shapes);
    var map = function (q) {
      return [(q[0] - b.cx) / b.scale, (q[1] - b.cy) / b.scale];
    };
    var out = [];
    var num = function (v) {
      return (Math.round(v * 1e4) / 1e4).toString();
    };
    var P = function (q) {
      var m = map(q);
      return "[" + num(m[0]) + "," + num(m[1]) + "]";
    };
    // CindyJS の connect は破線（dashing）に対応していないので、破線はキャンバスの座標で短い線分に分けて描く
    var solid = function (mpts, col, width) {
      out.push('["L",[' + mpts.map(function (m) {
        return "[" + num(m[0]) + "," + num(m[1]) + "]";
      }).join(",") + "]," + col + "," + width + "]");
    };
    var poly = function (pts, col, dash, width) {
      var m = pts.map(map);
      if (!dash) return solid(m, col, width);
      var DASH = 0.3;
      var GAP = 0.2;
      var on = true;
      var left = DASH;
      var cur = [m[0]];
      for (var i = 1; i < m.length; i++) {
        var a = m[i - 1];
        var b = m[i];
        var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        var pos = 0;
        while (len - pos > left) {
          pos += left;
          var q = [a[0] + ((b[0] - a[0]) * pos) / len, a[1] + ((b[1] - a[1]) * pos) / len];
          if (on) {
            cur.push(q);
            solid(cur, col, width);
          } else cur = [q];
          on = !on;
          left = on ? DASH : GAP;
        }
        left -= len - pos;
        if (on) cur.push(b);
      }
      if (on && cur.length > 1) solid(cur, col, width);
    };
    var text = function (q, s, col, dx, dy) {
      var m = map(q);
      out.push('["T",[' + num(m[0] + (dx || 0)) + "," + num(m[1] + (dy || 0)) + '],"' + s + '",' + col + "]");
    };
    // 方眼と軸、目盛り
    var step = niceStep(Math.max(b.x1 - b.x0, b.y1 - b.y0));
    for (var x = Math.ceil(b.x0 / step) * step; x <= b.x1; x += step) {
      poly([[x, b.y0], [x, b.y1]], COLOR.grid, false, 1);
      if (Math.abs(x) > 1e-9) text([x, 0], num(x).replace("-", "−"), COLOR.aux, -0.2, -0.55);
    }
    for (var y = Math.ceil(b.y0 / step) * step; y <= b.y1; y += step) {
      poly([[b.x0, y], [b.x1, y]], COLOR.grid, false, 1);
      if (Math.abs(y) > 1e-9) text([0, y], num(y).replace("-", "−"), COLOR.aux, -0.6, -0.15);
    }
    poly([[b.x0, 0], [b.x1, 0]], COLOR.aux, false, 1.5);
    poly([[0, b.y0], [0, b.y1]], COLOR.aux, false, 1.5);
    text([0, 0], "O", COLOR.aux, -0.5, -0.55);
    text([b.x1, 0], "x", COLOR.aux, -0.4, 0.25);
    text([0, b.y1], "y", COLOR.aux, 0.2, -0.5);
    // 図形（あとに書いたものが上に重なるよう、与えられた図形 → 正解 → 入力の順）
    var order = { aux: 0, given: 1, ans: 2, input: 3 };
    shapes
      .slice()
      .sort(function (s1, s2) {
        return (order[s1.c] || 0) - (order[s2.c] || 0);
      })
      .forEach(function (s) {
        var col = COLOR[s.c] === undefined ? 0 : COLOR[s.c];
        var w = s.c === "aux" ? 1 : 2;
        if (s.t === "seg") poly([s.a, s.b], col, s.dash, w);
        if (s.t === "line") {
          var seg = clipLine(s.line, b);
          if (seg) poly(seg, col, s.dash, w);
          if (seg && s.label) text(seg[1], s.label, col, -0.6, 0.3);
        }
        if (s.t === "circle" && isFinite(s.r) && s.r > 0) {
          var pts = [];
          for (var i = 0; i <= 96; i++) {
            var t = (2 * Math.PI * i) / 96;
            pts.push([s.center[0] + s.r * Math.cos(t), s.center[1] + s.r * Math.sin(t)]);
          }
          poly(pts, col, s.dash, w);
        }
        if (s.t === "curve") poly(s.pts, col, s.dash, w);
        if (s.t === "arrow") {
          out.push('["A",' + P(s.a) + "," + P(s.b) + "," + col + "," + (s.dash ? 1 : 0) + "]");
          if (s.label) text(s.b, s.label, col, 0.2, 0.2);
        }
        if (s.t === "pt") {
          out.push('["P",' + P(s.p) + "," + col + "," + (s.c === "input" ? 1 : 0) + "]");
          if (s.label) text(s.p, s.label, col, 0.25, 0.25);
        }
      });
    try {
      cdy.evokeCS("Shapes=[" + out.join(",") + "];");
    } catch (e) {
      // CindyJS の準備がまだのときは、読み込み後に描き直す
    }
  }

  // ---------- 問題・答え合わせ ----------

  function newProblem(seed) {
    var type = $("drill-type").value;
    if (type === "random") type = DRILL.types[Math.floor(Math.random() * DRILL.types.length)];
    var level = $("drill-level").value;
    setProblem(Drill.makeProblem(type, level, seed === undefined ? randomSeed() : seed));
  }

  function setProblem(p) {
    state.problem = p;
    state.counted = false;
    $("q-type").textContent = p.typeName + "（" + Drill.LEVELS[p.level].name + "）";
    $("question").textContent = p.text;
    buildAnswer(p);
    $("result").textContent = "";
    $("legend").hidden = true;
    render(p.figure(null));
  }

  function check() {
    var p = state.problem;
    var res = Drill.judge(p, inputValues(), state.form);
    var box = $("result");
    box.textContent = "";
    if (res.errors.length) {
      var v = el("p", { class: "verdict ng" }, "読めない入力があります");
      box.appendChild(v);
      res.errors.forEach(function (e) {
        box.appendChild(el("p", {}, e));
      });
      return res;
    }
    if (!state.counted) {
      state.counted = true;
      state.total++;
      if (res.ok) state.right++;
      $("score").textContent = "正解 " + state.right + " / " + state.total + " 問";
    }
    box.appendChild(
      el("p", { class: "verdict " + (res.ok ? "ok" : "ng") }, res.ok ? "正解です" : "違います（" + res.wrong.join("・") + "）"),
    );
    res.hints.forEach(function (h) {
      box.appendChild(el("p", {}, h + "。"));
    });
    box.appendChild(el("p", {}, "正解: " + p.answerText));
    box.appendChild(el("p", {}, "解き方"));
    var ol = el("ol", { class: "steps" });
    p.steps.forEach(function (s) {
      ol.appendChild(el("li", {}, s));
    });
    box.appendChild(ol);
    if (p.alt && p.alt.length) {
      box.appendChild(el("p", {}, "別解"));
      var ul = el("ul", { class: "steps" });
      p.alt.forEach(function (s) {
        ul.appendChild(el("li", {}, s));
      });
      box.appendChild(ul);
    }
    $("legend").hidden = false;
    render(p.figure(res.figureInput));
    return res;
  }

  function insertSqrt() {
    var i = state.lastInput || document.querySelector("#answer input");
    if (!i) return;
    var a = i.selectionStart === null ? i.value.length : i.selectionStart;
    var z = i.selectionEnd === null ? i.value.length : i.selectionEnd;
    i.value = i.value.slice(0, a) + "√" + i.value.slice(z);
    i.focus();
    i.setSelectionRange(a + 1, a + 1);
  }

  // CI 用の自己テスト: 型・段階ごとに正しい答えを入力して正解になるか、値をずらすと不正解になるかを確かめ、
  // 結果を CindyScript の変数 DrillSelfTest（1 なら成功）に入れる。tools/ketjs-run.mjs の --assert で読む。
  window.drillSelfTest = function () {
    var bad = [];
    var n = 0;
    ["basic", "exam"].forEach(function (level) {
      $("drill-level").value = level;
      DRILL.types.forEach(function (type) {
        for (var seed = 1; seed <= 10; seed++) {
          setProblem(Drill.makeProblem(type, level, seed));
          var c = Drill.correctInputs(state.problem);
          if (c.form) {
            state.form = c.form;
            buildLineRow(document.querySelectorAll("#answer .answer-row")[1]);
            document.querySelector("#answer select").value = c.form;
          }
          var inputs = document.querySelectorAll("#answer input");
          if (inputs.length !== c.values.length) bad.push(type + "/" + level + "/" + seed + ": 入力欄の数");
          Array.prototype.forEach.call(inputs, function (i, k) {
            i.value = c.values[k];
          });
          if (!check().ok) bad.push(type + "/" + level + "/" + seed + ": 正しい答えが不正解");
          inputs[0].value = inputs[0].value + "1";
          if (check().ok) bad.push(type + "/" + level + "/" + seed + ": 違う答えが正解");
          n++;
        }
      });
    });
    var score = state.total === n;
    if (!score) bad.push("正解数の数え方: " + state.total + " / " + n);
    console.log(bad.length ? "drill self-test NG\n" + bad.join("\n") : "drill self-test OK (" + n + " 問)");
    cdy.evokeCS("DrillSelfTest=" + (bad.length ? 0 : 1) + ";");
  };

  // ---------- はじめ ----------

  window.addEventListener("load", function () {
    var sel = $("drill-type");
    DRILL.types.forEach(function (t) {
      sel.appendChild(el("option", { value: t }, Drill.TYPES[t].name));
    });
    sel.addEventListener("change", function () {
      newProblem();
    });
    $("drill-level").addEventListener("change", function () {
      newProblem();
    });
    $("btn-check").addEventListener("click", check);
    $("btn-next").addEventListener("click", function () {
      newProblem();
    });
    $("btn-sqrt").addEventListener("mousedown", function (ev) {
      ev.preventDefault(); // 入力欄のフォーカスを外さない
    });
    $("btn-sqrt").addEventListener("click", insertSqrt);
    newProblem();
    // CindyJS の準備ができたあとにもう一度描く
    setTimeout(function () {
      render(state.problem.figure(null));
    }, 300);
  });
})();
