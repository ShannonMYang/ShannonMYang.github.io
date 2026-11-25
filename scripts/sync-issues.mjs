#!/usr/bin/env node
/**
 * 把 GitHub Issues 同步成站内笔记。
 *
 * 用法：
 *   npm run sync:issues                 # 公开仓库，无 token 也能跑（60 次/小时）
 *   GITHUB_TOKEN=ghp_xxx npm run sync:issues
 *   node scripts/sync-issues.mjs --no-images   # 不下载 Issue 内图片
 *
 * 设计：
 *   - 每篇 issue 生成 content/notes/gh-<number>.md
 *   - 正文里的外链图片自动下载到 post-images/issues/，避免图床失效
 *   - 与已迁移的旧文章标题重复的 issue 会跳过（保留有封面的旧文章）
 *   - 同步后旧笔记文件会按 issues 清单自动清理
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns';

// 本机/部分网络的 IPv6 到 GitHub API 会返回 504，优先 IPv4
dns.setDefaultResultOrder('ipv4first');
import { parseYaml, stringifyFrontmatter } from '../site/lib/frontmatter.mjs';
import { excerptFrom, stripMarkdown, uniq } from '../site/lib/util.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const NOTES_DIR = path.join(ROOT, 'content/notes');
const POSTS_DIR = path.join(ROOT, 'content/posts');
const IMAGE_DIR = path.join(ROOT, 'post-images/issues');
const args = new Set(process.argv.slice(2));
const DOWNLOAD_IMAGES = !args.has('--no-images');
const SITE_ORIGIN = 'https://shannonmyang.github.io';

async function readYamlFile(file) {
  const text = await fs.readFile(file, 'utf8');
  return parseYaml(text);
}

function normalizeTitle(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/[\s\-_—–·・.。,，:：;；!！?？()（）[\]【】"“”'’`/\\|]+/g, '');
}

function bigrams(text) {
  const t = normalizeTitle(text);
  const set = new Set();
  for (let i = 0; i < t.length - 1; i += 1) set.add(t.slice(i, i + 2));
  return set;
}

function similarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return shared / Math.max(1, Math.min(A.size, B.size));
}

async function github(pathname, token, attempt = 1) {
  const url = pathname.startsWith('http') ? pathname : `https://api.github.com${pathname}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'tuhe-shop-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
    const wait = Math.min(30000, Math.max(1000, reset - Date.now()));
    if (attempt <= 2) {
      console.warn(`GitHub API 限流，${Math.round(wait / 1000)} 秒后重试…`);
      await new Promise((r) => setTimeout(r, wait));
      return github(pathname, token, attempt + 1);
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  }
  return res;
}

async function fetchAllIssues(repo, token) {
  const issues = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await github(`/repos/${repo}/issues?state=all&per_page=100&page=${page}&sort=created&direction=asc`, token);
    const batch = await res.json();
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  return issues.filter((issue) => !issue.pull_request);
}

function extensionFor(url, contentType = '') {
  const clean = url.split('?')[0].split('#')[0];
  const ext = path.extname(clean).toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|avif)$/.test(ext)) return ext.replace('jpeg', 'jpg');
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('png')) return '.png';
  return '.jpg';
}

async function downloadImage(url, baseName, token, seen) {
  if (seen.has(url)) return seen.get(url);
  if (!DOWNLOAD_IMAGES) return url;
  if (url.startsWith(SITE_ORIGIN)) return url.replace(SITE_ORIGIN, '');
  if (url.startsWith('/')) return url;

  // GitHub 附件在私有/限流时需要 token
  const headers = { 'User-Agent': 'tuhe-shop-sync' };
  if (token && url.includes('github')) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { headers, redirect: 'follow' });
  } catch (err) {
    console.warn(`  图片下载失败（保留原链接）：${url} — ${err.message}`);
    return url;
  }
  if (!res.ok) {
    console.warn(`  图片下载失败（保留原链接）：${url} — HTTP ${res.status}`);
    return url;
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    console.warn(`  跳过非图片资源：${url} (${contentType})`);
    return url;
  }
  const length = Number(res.headers.get('content-length') || 0);
  if (length > 20 * 1024 * 1024) {
    console.warn(`  跳过超大图片：${url}`);
    return url;
  }
  const ext = extensionFor(url, contentType);
  const fileName = `${baseName}${ext}`;
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(IMAGE_DIR, fileName), buffer);
  const local = `/post-images/issues/${fileName}`;
  seen.set(url, local);
  return local;
}

function imageUrlsIn(markdown) {
  const urls = [];
  for (const m of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) urls.push(m[1]);
  for (const m of markdown.matchAll(/<img[^>]+src="([^"]+)"/g)) urls.push(m[1]);
  return uniq(urls);
}

async function processImages(markdown, issueNumber, token) {
  const seen = new Map();
  const urls = imageUrlsIn(markdown);
  let index = 0;
  for (const url of urls) {
    index += 1;
    const local = await downloadImage(url, `gh-${issueNumber}-${index}`, token, seen);
    if (local !== url) {
      markdown = markdown.split(url).join(local);
    }
  }
  return markdown;
}

function githubHtmlToMarkdown(markdown) {
  return markdown
    .replace(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, '![]($1)')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function loadExistingTitles() {
  const titles = [];
  for (const dir of [POSTS_DIR, NOTES_DIR]) {
    let files = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const raw = await fs.readFile(path.join(dir, file), 'utf8');
      const title = raw.match(/^title:\s*"?([^"\n]+)"?/m)?.[1] || '';
      const slug = file.replace(/\.md$/, '');
      const isNote = dir === NOTES_DIR;
      titles.push({ title, slug, isNote });
    }
  }
  return titles;
}

async function main() {
  const config = await readYamlFile(path.join(ROOT, 'content/site.yml'));
  const repo = config.notes?.repo || 'ShannonMYang/MyPersonalBlog';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (!token) console.log('提示：未设置 GITHUB_TOKEN，使用匿名额度（60 次/小时）。');

  console.log(`拉取 ${repo} 的 Issues…`);
  const issues = await fetchAllIssues(repo, token);
  console.log(`共 ${issues.length} 个 issue。`);

  await fs.mkdir(NOTES_DIR, { recursive: true });
  const existing = await loadExistingTitles();
  const postTitles = existing.filter((item) => !item.isNote);

  const written = [];
  const skipped = [];
  for (const issue of issues) {
    const title = (issue.title || '').trim();
    const body = (issue.body || '').trim();
    if (!title || !body) {
      skipped.push({ number: issue.number, reason: '空内容', title });
      continue;
    }
    const match = postTitles.find((p) => similarity(p.title, title) >= 0.9);
    if (match) {
      skipped.push({ number: issue.number, reason: `与旧文章《${match.title}》重复`, title });
      continue;
    }

    const labels = issue.labels || [];
    const tags = uniq(labels.map((l) => l.name).filter(Boolean));
    const accent = labels.find((l) => /^[0-9a-f]{6}$/i.test(l.color || ''))?.color || '';
    const slug = `gh-${issue.number}`;

    let markdown = githubHtmlToMarkdown(body);
    if (DOWNLOAD_IMAGES) markdown = await processImages(markdown, issue.number, token);

    const fields = {
      title,
      slug,
      date: issue.created_at,
      updated: issue.updated_at,
      kind: 'note',
      tags,
      accent: accent ? `#${accent}` : '#8a7a63',
      issue: issue.number,
      issueUrl: issue.html_url,
      repo,
      comments: issue.comments || 0,
      excerpt: excerptFrom(markdown, 200),
      source: 'github',
    };
    await fs.writeFile(path.join(NOTES_DIR, `${slug}.md`), stringifyFrontmatter(fields, markdown), 'utf8');
    written.push({ number: issue.number, slug, title, images: imageUrlsIn(markdown).length });
    process.stdout.write(`  ✓ #${issue.number} ${title.slice(0, 36)}\n`);
  }

  // 清理已不存在的 issue 对应的笔记
  const keep = new Set(written.map((w) => `${w.slug}.md`));
  for (const file of await fs.readdir(NOTES_DIR)) {
    if (!file.endsWith('.md')) continue;
    if (!keep.has(file)) {
      await fs.rm(path.join(NOTES_DIR, file));
      console.log(`  清理无主笔记：${file}`);
    }
  }

  const report = {
    syncedAt: new Date().toISOString(),
    repo,
    total: issues.length,
    written: written.length,
    skipped,
  };
  await fs.mkdir(path.join(ROOT, '.tmp'), { recursive: true });
  await fs.writeFile(path.join(ROOT, '.tmp/issues-sync-report.json'), JSON.stringify(report, null, 2));

  console.log(`\n完成：写入 ${written.length} 篇笔记，跳过 ${skipped.length} 篇。`);
  for (const s of skipped) console.log(`  - 跳过 #${s.number}（${s.reason}）`);
  if (!written.length) console.log('没有新内容，站点无需重新构建。');
}

main().catch((err) => {
  console.error('\n同步失败：', err.message);
  process.exit(1);
});
