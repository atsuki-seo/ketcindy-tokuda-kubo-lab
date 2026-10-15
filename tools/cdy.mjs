// Cinderella の .cdy（zip）の描画スクリプト（Draw の figures.cs）を読み書きする。
// 追加の npm パッケージを使わないよう、zip の中央ディレクトリを読んで zlib で展開・圧縮する。
// cdy はエントリのサイズを中央ディレクトリにだけ書いている（データディスクリプタ付き）ので、そちらのサイズを使う。
//
// 数学2の教材の cdy は、印刷用の図と Web 版の両用（README「印刷用の図と Web 版の両用の cdy」）。
// Cinderella がなくても、描画スクリプトを取り出して読んだり、編集して書き戻したりできる。
//   node tools/cdy.mjs extract src/math2/ellipse-focus.cdy > ellipse-focus.cs
//   node tools/cdy.mjs replace src/math2/ellipse-focus.cdy ellipse-focus.cs
// 書き戻すのは figures.cs だけで、作図（construction.cdy）などほかのエントリはそのまま残す。

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export const CDY_DRAW_SCRIPT = "private/de.cinderella/scripts/Draw/0/figures.cs";

// zip のエントリを [{ name, data }] で返す（entryName を指定するとそのエントリの中身だけ）
function readZip(path, entryName) {
  const buf = readFileSync(path);
  const entries = [];
  // 中央ディレクトリの終端（End of central directory）を末尾から探す
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${path} は zip（cdy）として読めません`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${path} の中央ディレクトリが壊れています`);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (entryName && name !== entryName) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    if (method !== 0 && method !== 8) throw new Error(`${path} の ${name} は未対応の圧縮方式（${method}）です`);
    const data = method === 0 ? raw : inflateRawSync(raw);
    if (entryName) return data;
    entries.push({ name, data });
  }
  if (entryName) throw new Error(`${path} に ${entryName} がありません`);
  return entries;
}

export const readZipEntry = (path, entryName) => readZip(path, entryName);
export const readCdyScript = (path) => readZipEntry(path, CDY_DRAW_SCRIPT).toString("utf8");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// エントリの並びを保ったまま、zip を書き直す（すべて deflate、ファイル名は UTF-8）
function writeZip(path, entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    locals.push(head, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    centrals.push(cen, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(path, Buffer.concat([...locals, ...centrals, end]));
}

export function replaceCdyScript(path, script) {
  const entries = readZip(path);
  const draw = entries.find((e) => e.name === CDY_DRAW_SCRIPT);
  if (!draw) throw new Error(`${path} に ${CDY_DRAW_SCRIPT} がありません`);
  draw.data = Buffer.from(script, "utf8");
  writeZip(path, entries);
}

// コマンドとして実行したとき
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, cdy, cs] = process.argv.slice(2);
  if (cmd === "extract" && cdy) process.stdout.write(readCdyScript(cdy));
  else if (cmd === "replace" && cdy && cs) {
    replaceCdyScript(cdy, readFileSync(cs, "utf8"));
    console.log(`${cdy} の描画スクリプトを ${cs} で置き換えました`);
  } else {
    console.error("usage: cdy.mjs extract <file.cdy>  |  cdy.mjs replace <file.cdy> <script.cs>");
    process.exit(2);
  }
}
