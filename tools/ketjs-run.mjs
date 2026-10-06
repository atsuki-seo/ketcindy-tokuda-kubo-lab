#!/usr/bin/env node
// 生成した KeTCindyJS の HTML をヘッドレス Chrome で開き、検証する。
//   - コンソール出力（println）と JS 例外を収集して表示
//   - スクリーンショットを保存
//   - --eval で CindyScript を実行して値を取り出せる（例: --eval 'Gain(1)'）
//
// 使い方: node tools/ketjs-run.mjs build/html/nyquist_g4.html [--shot build/shot.png] [--eval EXPR]... [--wait 3000]
// 環境変数: CHROME（既定 /Applications/Google Chrome.app/...）

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const evals = args.flatMap((a, i) => (a === "--eval" ? [args[i + 1]] : []));
const shot = opt("--shot") ?? "build/shot.png";
const wait = Number(opt("--wait") ?? 3000);
if (!file) {
  console.error("usage: ketjs-run.mjs <file.html> [--shot png] [--eval EXPR]... [--wait ms]");
  process.exit(2);
}

const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = mkdtempSync(join(tmpdir(), "ketjs-chrome-"));
const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--window-size=900,700",
    // CI などで追加のフラグが要る場合（例: CHROME_ARGS="--no-sandbox"）
    ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(/\s+/).filter(Boolean) : []),
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

const endpoint = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("Chrome の起動がタイムアウトしました")), 20000);
  let buf = "";
  proc.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) {
      clearTimeout(t);
      res(m[1]);
    }
  });
  proc.on("exit", (c) => rej(new Error(`Chrome が終了しました (code ${c})\n${buf}`)));
});

const port = new URL(endpoint).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    logs.push(`[console.${msg.params.type}] ${text}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    logs.push(`[exception] ${d.exception?.description ?? d.text}`);
  } else if (msg.method === "Log.entryAdded") {
    logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text} ${msg.params.entry.url ?? ""}`);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Page.navigate", { url: `file://${resolve(file)}` });
await new Promise((r) => setTimeout(r, wait));

// --eval は CindyScript を evokeCS で実行する。式の値は println 経由で受け取る。
//   例: --eval 'D.x=2;'（実行のみ） --eval '=Gain(1)'（先頭が = なら値を表示）
const results = [];
for (const expr of evals) {
  const show = expr.startsWith("=");
  const code = show ? `println("@@EVAL@@"+(${expr.slice(1)}));` : expr;
  const before = logs.length;
  await send("Runtime.evaluate", { expression: `cdy.evokeCS(${JSON.stringify(code)})`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 300));
  const hit = logs.slice(before).find((l) => l.includes("@@EVAL@@"));
  results.push([expr, show ? (hit ? hit.split("@@EVAL@@")[1] : "(値なし)") : "実行"]);
  if (hit) logs.splice(logs.indexOf(hit), 1);
}

// --assert '=式|期待値|許容誤差' : 数値が期待値に収まるか照合する（失敗で終了コード 1）
const assertFailures = [];
for (const spec of args.flatMap((a, i) => (a === "--assert" ? [args[i + 1]] : []))) {
  const [expr, expected, tol = "1e-6"] = spec.split("|");
  const code = `println("@@EVAL@@"+format((${expr.replace(/^=/, "")}),8));`;
  const before = logs.length;
  await send("Runtime.evaluate", { expression: `cdy.evokeCS(${JSON.stringify(code)})`, returnByValue: true });
  await new Promise((r) => setTimeout(r, 300));
  const hit = logs.slice(before).find((l) => l.includes("@@EVAL@@"));
  if (hit) logs.splice(logs.indexOf(hit), 1);
  const got = hit ? parseFloat(hit.split("@@EVAL@@")[1]) : NaN;
  const ok = Math.abs(got - Number(expected)) <= Number(tol);
  console.log(`assert ${ok ? "OK" : "NG"}: ${expr} = ${got} (期待 ${expected} ±${tol})`);
  if (!ok) assertFailures.push(spec);
}

const png = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(shot, Buffer.from(png.result.data, "base64"));

ws.close();
proc.kill();

// 同じ内容の繰り返しは件数にまとめる（スタック行は先頭の 1 行だけ見る）
const counts = new Map();
for (const l of logs) {
  const key = l.split("\n")[0];
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
console.log(`--- console / errors (${logs.length} 件, 種類 ${counts.size}) ---`);
for (const [k, n] of counts) console.log(n > 1 ? `${k}  (x${n})` : k);
for (const [e, v] of results) console.log(`eval ${e} => ${v}`);
console.log(`screenshot: ${shot}`);
// 終了コード: JS 例外 / assert 失敗で 1。console.error は KeTCindy 由来の既知の警告が混じるため表示のみ。
process.exit(logs.some((l) => l.startsWith("[exception]")) || assertFailures.length ? 1 : 0);
