#!/usr/bin/env node
/** 本地开发：构建 + 静态预览 + 文件监听自动重建。 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildSite } from './lib/publish.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = process.env.PORT || '4173';
const WATCH = ['content', 'theme', 'site'];
let building = false;
let pending = false;

function build(label = '') {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  const started = Date.now();
  const result = buildSite();
  building = false;
  if (result.ok) {
    console.log(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] 构建完成${label ? `（${label}）` : ''} · ${Date.now() - started} ms`);
  } else {
    console.error(result.output);
  }
  if (pending) {
    pending = false;
    build('合并变更');
  }
}

build('首次构建');

const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', PORT], {
  cwd: ROOT,
  stdio: 'inherit',
});

let timer = null;
for (const dir of WATCH) {
  const target = path.join(ROOT, dir);
  if (!fs.existsSync(target)) continue;
  fs.watch(target, { recursive: true }, (_event, file) => {
    if (file && (file.includes('node_modules') || file.startsWith('.'))) return;
    clearTimeout(timer);
    timer = setTimeout(() => build(file || dir), 250);
  });
}

console.log('\n开发预览已启动 · 监听 content/ theme/ site/ 的改动 · Ctrl+C 退出\n');

const shutdown = () => {
  server.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
