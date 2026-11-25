#!/usr/bin/env node
/**
 * 站内链接与资源检查：扫描所有生成的 HTML，确认内部链接都有落点。
 * 用法：node scripts/check-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.tmp', '.trash', 'content', 'site', 'theme', 'studio', 'scripts']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.nojekyll') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full);
    } else if (entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
}
walk(ROOT);

const exists = (file) => {
  try {
    return fs.existsSync(file) && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

const resolveTarget = (pathname, fromFile) => {
  const clean = pathname.split('#')[0].split('?')[0];
  if (!clean) return fromFile;
  let full;
  if (clean.startsWith('/')) full = path.join(ROOT, decodeURIComponent(clean));
  else full = path.resolve(path.dirname(fromFile), decodeURIComponent(clean));
  if (full.endsWith('/')) full = path.join(full, 'index.html');
  if (exists(full)) return full;
  if (exists(`${full}.html`)) return `${full}.html`;
  if (exists(path.join(full, 'index.html'))) return path.join(full, 'index.html');
  return null;
};

const broken = [];
const checked = new Set();
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const pageUrl = `/${path.relative(ROOT, file).replace(/index\.html$/, '')}`;
  const attrs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const raw of attrs) {
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('data:')) continue;
    if (/^https?:\/\//i.test(raw)) continue;
    if (raw.startsWith('javascript:')) {
      broken.push({ page: pageUrl, target: raw, reason: 'javascript: URL' });
      continue;
    }
    const key = `${pageUrl} -> ${raw}`;
    if (checked.has(key)) continue;
    checked.add(key);
    if (!resolveTarget(raw, file)) broken.push({ page: pageUrl, target: raw, reason: '目标不存在' });
  }
}

// 检查 feed / sitemap 里引用的页面
for (const file of ['atom.xml', 'sitemap.xml']) {
  const full = path.join(ROOT, file);
  if (!exists(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  for (const match of text.matchAll(/<loc>(https:\/\/shannonmyang\.github\.io[^<]*)<\/loc>/g)) {
    const urlPath = new URL(match[1]).pathname;
    if (!resolveTarget(urlPath, full)) broken.push({ page: `/${file}`, target: urlPath, reason: 'sitemap 目标不存在' });
  }
}

const unique = [...new Map(broken.map((item) => [`${item.page}|${item.target}`, item])).values()];
fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.tmp/link-report.json'), JSON.stringify({ pages: files.length, links: checked.size, broken: unique }, null, 2));

if (unique.length) {
  console.error(`发现 ${unique.length} 个失效链接（共检查 ${checked.size} 个）：`);
  for (const item of unique.slice(0, 40)) console.error(`  ${item.page} → ${item.target}（${item.reason}）`);
  process.exitCode = 1;
} else {
  console.log(`链接检查通过：${files.length} 个页面，${checked.size} 个内部链接。`);
}
