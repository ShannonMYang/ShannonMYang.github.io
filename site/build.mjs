#!/usr/bin/env node
/**
 * 木鱼小店静态站点生成器。
 *
 * 输入：content/（Markdown）、theme/assets/（CSS/JS）、post-images/（图片）
 * 输出：仓库根目录（GitHub Pages 的 master 分支根目录），因此无需修改 Pages 设置。
 *
 * 流程：先渲染到 .tmp/dist，成功后再整体替换根目录里的受管产物，
 * 避免半成品覆盖线上文件。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadContent, loadSite, ROOT } from './lib/content.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import { atomFeed, robots, sitemap } from './lib/feed.mjs';
import { tagSlug, hashString } from './lib/util.mjs';
import {
  aboutPage,
  archivesPage,
  articlePage,
  homePage,
  notFoundPage,
  notesPage,
  searchIndex,
  tagsPage,
  tagPage,
} from './lib/templates.mjs';

const DIST = path.join(ROOT, '.tmp/dist');
const MANAGED = [
  'index.html',
  '404.html',
  'atom.xml',
  'sitemap.xml',
  'robots.txt',
  'search-index.json',
  '.nojekyll',
  'post',
  'note',
  'tag',
  'tags',
  'archives',
  'notes',
  'about',
  'page',
  'api-content',
  'api-info',
  'books',
  'friends',
  'movies',
  'styles',
  'media',
  'search',
  'assets',
];

const started = Date.now();

async function writeFile(relative, contents, version) {
  const file = path.join(DIST, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const text = version ? String(contents).replaceAll('__ASSET_VERSION__', version) : String(contents);
  await fs.writeFile(file, text, 'utf8');
  return Buffer.byteLength(text);
}

async function copyDir(from, to, filter = () => true) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (!filter(src, entry)) continue;
    if (entry.isDirectory()) {
      await copyDir(src, dest, filter);
    } else if (entry.isFile()) {
      await fs.copyFile(src, dest);
    }
  }
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function checkCovers(items) {
  for (const item of items) {
    if (!item.cover || !item.cover.startsWith('/')) continue;
    let rel = item.cover.slice(1);
    try {
      rel = decodeURIComponent(rel);
    } catch {
      /* keep raw */
    }
    if (!(await fileExists(path.join(ROOT, rel)))) {
      console.warn(`  ! 封面不存在，已改用排版封面：${item.cover}（${item.title}）`);
      item.cover = '';
    }
  }
}

function redirectPage(target) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>正在跳转…</title><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}">
<script>location.replace(${JSON.stringify(target)})</script></head>
<body><p>正在前往 <a href="${target}">${target}</a>…</p></body></html>`;
}

async function main() {
  const site = await loadSite();
  const content = await loadContent();
  console.log(`读取内容：${content.posts.length} 篇文章，${content.notes.length} 篇笔记，${content.tags.length} 个标签。`);

  await checkCovers(content.all);

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const rendered = new Map();
  for (const item of content.all) {
    const result = renderMarkdown(item.body, { title: item.title });
    item.html = result.html;
    rendered.set(item.slug, { ...result, hasMath: result.hasMath });
  }
  const aboutResult = content.about
    ? renderMarkdown(content.about.body, { title: content.about.title })
    : { html: '', toc: [], hasMath: false };

  // 主题资源与版本号
  const css = await fs.readFile(path.join(ROOT, 'theme/assets/site.css'), 'utf8');
  const js = await fs.readFile(path.join(ROOT, 'theme/assets/site.js'), 'utf8');
  const version = hashString(css + js).toString(16).slice(0, 8);
  await copyDir(path.join(ROOT, 'theme/assets'), path.join(DIST, 'assets'));
  await fs.mkdir(path.join(DIST, 'assets/katex/fonts'), { recursive: true });
  await fs.copyFile(path.join(ROOT, 'node_modules/katex/dist/katex.min.css'), path.join(DIST, 'assets/katex/katex.min.css'));
  await fs.mkdir(path.join(DIST, 'assets/katex/fonts'), { recursive: true });
  await copyDir(path.join(ROOT, 'node_modules/katex/dist/fonts'), path.join(DIST, 'assets/katex/fonts'));

  let bytes = 0;
  bytes += await writeFile('index.html', homePage({ site, content }), version);
  bytes += await writeFile('404.html', notFoundPage({ site }), version);
  bytes += await writeFile('archives/index.html', archivesPage({ site, content }), version);
  bytes += await writeFile('tags/index.html', tagsPage({ site, content }), version);
  bytes += await writeFile('notes/index.html', notesPage({ site, content }), version);
  if (content.about) {
    bytes += await writeFile('about/index.html', aboutPage({ site, content, page: content.about, html: aboutResult.html }), version);
  }
  for (const tag of content.tags) {
    bytes += await writeFile(path.join('tag', tag.slug, 'index.html'), tagPage({ site, content, tag }), version);
  }
  for (const item of content.all) {
    const dir = item.kind === 'note' ? 'note' : 'post';
    bytes += await writeFile(
      path.join(dir, item.slug, 'index.html'),
      articlePage({ site, item, content, toc: rendered.get(item.slug).toc, hasMath: rendered.get(item.slug).hasMath }),
      version,
    );
  }

  // 旧链接重定向：Gridea 的标签 id 与 /post/about/
  let legacyTags = {};
  try {
    legacyTags = JSON.parse(await fs.readFile(path.join(ROOT, 'content/legacy-tags.json'), 'utf8'));
  } catch {
    /* 没有旧数据就跳过 */
  }
  for (const [legacyId, name] of Object.entries(legacyTags)) {
    const slug = tagSlug(name);
    if (!content.tags.some((tag) => tag.slug === slug)) continue;
    bytes += await writeFile(path.join('tag', legacyId, 'index.html'), redirectPage(`/tag/${encodeURIComponent(slug)}/`));
  }
  bytes += await writeFile('post/about/index.html', redirectPage('/about/'));
  // 旧站点分页与搜索页
  for (const page of ['2', '3', '4']) {
    bytes += await writeFile(path.join('page', page, 'index.html'), redirectPage('/archives/'));
  }
  bytes += await writeFile('search/index.html', redirectPage('/'));

  bytes += await writeFile('search-index.json', JSON.stringify(searchIndex(content.all)));
  bytes += await writeFile('atom.xml', atomFeed({ site, items: content.all, rendered }));
  bytes += await writeFile('sitemap.xml', sitemap({ site, items: content.all, tags: content.tags }));
  bytes += await writeFile('robots.txt', robots(site));
  bytes += await writeFile('.nojekyll', '');

  // 用新产物整体替换受管路径（CNAME / images / post-images / 源码目录保持不动）
  for (const name of MANAGED) {
    await fs.rm(path.join(ROOT, name), { recursive: true, force: true });
  }
  for (const entry of await fs.readdir(DIST)) {
    await fs.rename(path.join(DIST, entry), path.join(ROOT, entry));
  }

  const ms = Date.now() - started;
  console.log(`构建完成：${content.all.length} 个内容页，${content.tags.length} 个标签页，${(bytes / 1024).toFixed(0)} KB HTML，用时 ${ms} ms。`);
  console.log(`资源版本：${version}；输出目录：${ROOT}`);
}

main().catch((err) => {
  console.error('\n构建失败：', err);
  process.exitCode = 1;
});
