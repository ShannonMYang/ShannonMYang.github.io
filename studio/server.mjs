#!/usr/bin/env node
/**
 * 木鱼书店 · 写作台（本地服务）
 *
 *   npm run studio        → http://127.0.0.1:4400
 *
 * 只绑定 127.0.0.1，数据直接写入仓库里的 Markdown 文件；
 * 「发布」= 构建静态站点 + git commit + git push。
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import matter from 'gray-matter';
import { stringifyFrontmatter } from '../site/lib/frontmatter.mjs';
import { renderMarkdown } from '../site/lib/markdown.mjs';
import { asDate, dateInputValue, formatDate } from '../site/lib/util.mjs';
import { loadContent, loadSite, ROOT } from '../site/lib/content.mjs';
import { buildSite, gitInfo, publishSite } from '../scripts/lib/publish.mjs';

const UI_DIR = path.join(ROOT, 'studio/ui');
const CONTENT_DIR = path.join(ROOT, 'content');
const UPLOAD_DIR = path.join(ROOT, 'post-images');
const TRASH_DIR = path.join(ROOT, '.trash');
const PORT_FILE = path.join(ROOT, '.tmp/studio-port');
const OPEN_BROWSER = !process.argv.includes('--no-open');
const LOG_REQUESTS = process.env.STUDIO_LOG === '1';
const portArgIndex = process.argv.indexOf('--port');
const PREFERRED_PORT = Number(process.env.STUDIO_PORT || (portArgIndex > -1 ? process.argv[portArgIndex + 1] : 0)) || 4400;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

let currentPort = PREFERRED_PORT;
let currentPreviewPort = PREFERRED_PORT + 1;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function fail(res, status, message) {
  json(res, status, { ok: false, error: message });
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    timeout: options.timeout || 120000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return { ok: result.status === 0, status: result.status, output };
}

function safeContentPath(rel) {
  if (!rel || typeof rel !== 'string') throw new Error('缺少文件路径');
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(CONTENT_DIR + path.sep)) throw new Error('不允许访问该路径');
  if (!full.endsWith('.md')) throw new Error('只支持 Markdown 文件');
  return full;
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function uniqueSlug(base, dir) {
  const clean = base || `post-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36).slice(-4)}`;
  let slug = clean;
  let n = 1;
  while (fs.existsSync(path.join(dir, `${slug}.md`))) {
    n += 1;
    slug = `${clean}-${n}`;
  }
  return slug;
}

async function listItems() {
  const [content, site] = await Promise.all([loadContent(), loadSite()]);
  const items = [...content.posts, ...content.notes, ...content.pages].sort((a, b) => b.date - a.date);
  return {
    site: { title: site.title, wordmark: site.wordmark, notesRepo: site.notes?.repo },
    items: items.map((item) => ({
      path: item.sourcePath,
      title: item.title,
      slug: item.slug,
      kind: item.kind,
      date: item.date.toISOString(),
      dateLabel: formatDate(item.date),
      tags: item.tags,
      draft: item.draft,
      excerpt: item.excerpt,
      url: item.url,
      issue: item.issue,
      issueUrl: item.issueUrl,
      readingMinutes: item.readingMinutes,
    })),
    counts: {
      posts: content.posts.length,
      notes: content.notes.length,
      pages: content.pages.length,
      drafts: content.posts.filter((p) => p.draft).length,
    },
    git: gitInfo(),
  };
}

function itemDetail(relPath) {
  const full = safeContentPath(relPath);
  if (!fs.existsSync(full)) throw new Error('文章不存在');
  const raw = fs.readFileSync(full, 'utf8');
  const parsed = matter(raw);
  const isNote = full.includes(`${path.sep}notes${path.sep}`);
  const date = asDate(parsed.data.date);
  return {
    path: path.relative(ROOT, full),
    kind: parsed.data.kind || (isNote ? 'note' : full.includes(`${path.sep}pages${path.sep}`) ? 'page' : 'post'),
    readOnly: isNote,
    fields: {
      title: parsed.data.title || '',
      slug: parsed.data.slug || path.basename(full, '.md'),
      date: dateInputValue(date),
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
      cover: parsed.data.cover || '',
      excerpt: parsed.data.excerpt || '',
      draft: Boolean(parsed.data.draft),
      issue: parsed.data.issue || null,
      issueUrl: parsed.data.issueUrl || '',
      repo: parsed.data.repo || '',
    },
    body: parsed.content.replace(/^\n+/, ''),
    raw,
  };
}

async function refreshItems() {
  return listItems();
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (!sameOrigin(req)) return fail(res, 403, '拒绝跨站请求');

  if (pathname === '/api/state' && method === 'GET') {
    const data = await listItems();
    return json(res, 200, {
      ok: true,
      ...data,
      port: currentPort,
      previewPort: currentPreviewPort,
      previewUrl: `http://127.0.0.1:${currentPreviewPort}/`,
      node: process.version,
      root: ROOT,
    });
  }

  if (pathname === '/api/item' && method === 'GET') {
    try {
      const rel = url.searchParams.get('path');
      return json(res, 200, { ok: true, item: itemDetail(rel) });
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }

  if (pathname === '/api/item' && method === 'POST') {
    try {
      const payload = await readBody(req);
      if (payload.action === 'create') {
        const kind = payload.kind === 'page' ? 'page' : 'post';
        const dir = path.join(CONTENT_DIR, kind === 'page' ? 'pages' : 'posts');
        await fsp.mkdir(dir, { recursive: true });
        const now = new Date();
        const slug = uniqueSlug(payload.slug || slugify(payload.title || ''), dir);
        const title = payload.title || '未命名文章';
        const fields = {
          title,
          slug,
          date: `${dateInputValue(now)}T12:00:00+08:00`,
          kind,
          tags: [],
          cover: '',
          excerpt: '',
          draft: true,
        };
        const full = path.join(dir, `${slug}.md`);
        await fsp.writeFile(full, stringifyFrontmatter(fields, `\n在这里开始写。\n`), 'utf8');
        return json(res, 200, { ok: true, path: path.relative(ROOT, full), item: itemDetail(path.relative(ROOT, full)) });
      }
      return fail(res, 400, '未知操作');
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }

  if (pathname === '/api/item' && (method === 'PUT' || method === 'DELETE')) {
    try {
      const payload = await readBody(req);
      const rel = payload.path;
      const full = safeContentPath(rel);
      if (!fs.existsSync(full)) throw new Error('文章不存在');
      if (rel.includes(`${path.sep}notes${path.sep}`)) throw new Error('GitHub 笔记是只读的，请到原 Issue 编辑');

      if (method === 'DELETE') {
        await fsp.mkdir(TRASH_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const target = path.join(TRASH_DIR, `${stamp}-${path.basename(full)}`);
        await fsp.rename(full, target);
        return json(res, 200, { ok: true, trashed: path.relative(ROOT, target) });
      }

      const existing = matter(await fsp.readFile(full, 'utf8'));
      const fields = payload.fields || {};
      const currentSlug = existing.data.slug || path.basename(full, '.md');
      let nextSlug = String(fields.slug || currentSlug).trim();
      if (!/^[a-z0-9][a-z0-9_-]{0,90}$/.test(nextSlug)) {
        throw new Error('slug 只能包含小写字母、数字、- 和 _，且不能以符号开头');
      }
      const dir = path.dirname(full);
      let targetFile = full;
      if (nextSlug !== currentSlug) {
        const candidate = path.join(dir, `${nextSlug}.md`);
        if (fs.existsSync(candidate)) throw new Error(`slug「${nextSlug}」已存在`);
        targetFile = candidate;
      }

      let dateIso = existing.data.date;
      if (fields.date) {
        const oldDate = dateInputValue(asDate(existing.data.date));
        dateIso =
          fields.date !== oldDate
            ? `${fields.date}T12:00:00+08:00`
            : existing.data.date instanceof Date || typeof existing.data.date === 'string'
              ? existing.data.date
              : `${fields.date}T12:00:00+08:00`;
      }

      const merged = {
        ...existing.data,
        title: String(fields.title || existing.data.title || '').trim() || '未命名文章',
        slug: nextSlug,
        date: dateIso,
        tags: Array.isArray(fields.tags) ? fields.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        cover: String(fields.cover || '').trim(),
        excerpt: String(fields.excerpt || '').trim(),
        draft: Boolean(fields.draft),
      };
      if (merged.kind === 'page') {
        delete merged.date;
      }

      const body = String(payload.body ?? existing.content).replace(/^\n+/, '');
      await fsp.writeFile(targetFile, stringifyFrontmatter(merged, body), 'utf8');
      if (targetFile !== full) await fsp.rm(full, { force: true });
      return json(res, 200, { ok: true, path: path.relative(ROOT, targetFile), item: itemDetail(path.relative(ROOT, targetFile)) });
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }

  if (pathname === '/api/preview' && method === 'POST') {
    try {
      const payload = await readBody(req);
      const result = renderMarkdown(String(payload.markdown || ''), { title: String(payload.title || '') });
      return json(res, 200, { ok: true, html: result.html, toc: result.toc, hasMath: result.hasMath });
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }

  if (pathname === '/api/upload' && method === 'POST') {
    try {
      const payload = await readBody(req);
      const match = String(payload.dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|gif|webp|svg\+xml));base64,(.+)$/);
      if (!match) throw new Error('只支持图片文件');
      const mime = match[1];
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[mime] || 'png';
      const buffer = Buffer.from(match[3], 'base64');
      if (buffer.length > 15 * 1024 * 1024) throw new Error('图片不能超过 15 MB');
      const base = path
        .basename(String(payload.filename || 'image'))
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
        .slice(0, 40) || 'image';
      const fileName = `${base}-${Date.now().toString(36)}.${ext}`;
      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
      await fsp.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
      return json(res, 200, { ok: true, url: `/post-images/${fileName}` });
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }

  if (pathname === '/api/build' && method === 'POST') {
    const result = buildSite();
    return json(res, result.ok ? 200 : 500, { ok: result.ok, log: result.output });
  }

  if (pathname === '/api/publish' && method === 'POST') {
    const payload = await readBody(req);
    const result = publishSite({ message: String(payload.message || ''), push: payload.push !== false });
    return json(res, result.ok ? 200 : 500, result);
  }

  if (pathname === '/api/sync' && method === 'POST') {
    const sync = run(process.execPath, ['scripts/sync-issues.mjs'], { timeout: 10 * 60 * 1000 });
    if (!sync.ok) return json(res, 500, { ok: false, step: '同步 Issues', log: sync.output });
    const build = run(process.execPath, ['site/build.mjs'], { timeout: 120000 });
    return json(res, build.ok ? 200 : 500, {
      ok: build.ok,
      log: `${sync.output}\n\n$ 重新构建\n${build.output}`,
      step: build.ok ? undefined : '重新构建',
    });
  }

  return fail(res, 404, 'API 不存在');
}

/* ------------------------------------------------------------------ */
/* static files                                                        */
/* ------------------------------------------------------------------ */

const BLOCKED_PREFIXES = ['/content/', '/studio/', '/site/', '/scripts/', '/node_modules/', '/.git/', '/.tmp/', '/.trash/'];

function sendFile(res, file) {
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('未找到文件');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

function servePreview(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
    return;
  }
  let rel = pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    const notFound = path.join(ROOT, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(notFound).pipe(res);
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

async function main() {
  const studioServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (LOG_REQUESTS) console.log(`${req.method} ${url.pathname}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end('Method Not Allowed');
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return sendFile(res, path.join(UI_DIR, 'index.html'));
      }
      if (url.pathname === '/theme/site.css') {
        return sendFile(res, path.join(ROOT, 'theme/assets/site.css'));
      }
      if (url.pathname === '/theme/favicon.svg') {
        return sendFile(res, path.join(ROOT, 'theme/assets/favicon.svg'));
      }
      if (url.pathname.startsWith('/post-images/') || url.pathname.startsWith('/images/')) {
        return sendFile(res, path.join(ROOT, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')));
      }
      const uiFile = path.join(UI_DIR, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
      if (uiFile.startsWith(UI_DIR) && fs.existsSync(uiFile) && fs.statSync(uiFile).isFile()) {
        return sendFile(res, uiFile);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
    } catch (err) {
      console.error(err);
      if (!res.headersSent) fail(res, 500, err.message);
      else res.end();
    }
  });

  const previewServer = http.createServer(servePreview);

  const listen = (server, port, label) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(port);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    });

  let port = PREFERRED_PORT;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await listen(studioServer, port, 'studio');
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      port += 1;
    }
  }
  currentPort = port;

  let previewPort = port + 1;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await listen(previewServer, previewPort, 'preview');
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      previewPort += 1;
    }
  }
  currentPreviewPort = previewPort;

  await fsp.mkdir(path.dirname(PORT_FILE), { recursive: true });
  await fsp.writeFile(PORT_FILE, String(port), 'utf8');
  await fsp.writeFile(path.join(ROOT, '.tmp/preview-port'), String(previewPort), 'utf8');

  const url = `http://127.0.0.1:${port}/`;
  console.log(`\n  木鱼书店 · 写作台`);
  console.log(`  ${url}`);
  console.log(`  站点预览  http://127.0.0.1:${previewPort}/`);
  console.log(`  仓库目录  ${ROOT}\n`);

  if (OPEN_BROWSER && process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  }

  const shutdown = () => {
    try {
      fs.rmSync(PORT_FILE, { force: true });
      fs.rmSync(path.join(ROOT, '.tmp/preview-port'), { force: true });
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('启动失败：', err);
  process.exit(1);
});
