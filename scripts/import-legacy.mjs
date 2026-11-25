#!/usr/bin/env node
/**
 * 一次性迁移脚本：把旧 Gridea 构建产物（HTML）还原成 Markdown 源文件。
 *
 * 数据来源：
 *   - api-content/index.html  —— 全部文章清单（标题 / 链接）
 *   - index.html + page/N/*.html —— 卡片摘要、封面
 *   - post/<slug>/index.html  —— 正文 HTML、日期、标签
 *   - atom.xml                —— 部分文章的精确发布时间
 *
 * 产物：content/posts/<slug>.md、content/pages/about.md
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFile(path.join(ROOT, p), 'utf8');

const td = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});
td.use(gfm);
td.keep(['iframe', 'video', 'audio', 'source', 'details', 'summary', 'kbd']);

const SITE = 'https://shannonmyang.github.io';

function decodeEntities(s = '') {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(s = '') {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function yamlString(v) {
  return JSON.stringify(String(v));
}

function writeFrontmatter(fields, body) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(yamlString).join(', ')}]`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + body.trim() + '\n';
}

function cleanMarkdown(md) {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/<!--\s*more\s*-->/gi, '')
    .replace(/https?:\/\/shannonmyang\.github\.io\/post-images\//g, '/post-images/')
    .replace(/https?:\/\/shannonmyang\.github\.io\/images\//g, '/images/')
    .replace(/https?:\/\/shannonmyang\.github\.io\/post\//g, '/post/')
    // turndown 有时会把中文里的 <br> 变成裸换行，这里保持单换行
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 从卡片摘要中抽取 excerpt（旧站点已做过截断） */
async function loadCardMeta() {
  const files = ['index.html', 'page/2/index.html', 'page/3/index.html', 'page/4/index.html'];
  const map = new Map();
  for (const file of files) {
    let html;
    try {
      html = await read(file);
    } catch {
      continue;
    }
    const articles = html.match(/<article class="default[\s\S]*?<\/article>/g) || [];
    for (const art of articles) {
      const link = art.match(/href="[^"]*?\/post\/([^/"]+)\//);
      if (!link) continue;
      const slug = link[1];
      const excerptMatch = art.match(/<div class="post-excerpt">([\s\S]*?)<\/div>/);
      const coverMatch = art.match(/background-image:\s*url\('([^']+)'\)/);
      const tags = [...art.matchAll(/class="ctag[^"]*"[^>]*>([^<]+)</g)].map((m) => decodeEntities(m[1].trim()));
      map.set(slug, {
        excerpt: excerptMatch ? stripTags(excerptMatch[1]).replace(/^【?阅读全文】?/, '').trim() : '',
        cover: coverMatch ? coverMatch[1].replace(`${SITE}/`, '/') : '',
        tags,
      });
    }
  }
  return map;
}

/** atom.xml 里有精确时间 */
async function loadAtomTimes() {
  let xml;
  try {
    xml = await read('atom.xml');
  } catch {
    return new Map();
  }
  const map = new Map();
  for (const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g) || []) {
    const id = entry.match(/<id>([^<]+)<\/id>/)?.[1] || '';
    const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1];
    const slug = id.match(/\/post\/([^/]+)\//)?.[1];
    if (slug && updated) map.set(slug, updated);
  }
  return map;
}

function extractArticle(html) {
  const startMarker = '<div class="text">';
  const start = html.indexOf(startMarker);
  if (start < 0) return '';
  const from = start + startMarker.length;
  const end = html.indexOf('<div class="clear">', from);
  return html.slice(from, end > 0 ? end : undefined);
}

function estimateExcerpt(markdown, limit = 220) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

async function main() {
  const indexJson = JSON.parse(await read('api-content/index.html'));
  const list = indexJson.posts;
  const cards = await loadCardMeta();
  const times = await loadAtomTimes();

  await fs.mkdir(path.join(ROOT, 'content/posts'), { recursive: true });
  await fs.mkdir(path.join(ROOT, 'content/pages'), { recursive: true });

  const report = [];
  for (const item of list) {
    const match = item.link.match(/\/post\/([^/]+)\//);
    if (!match) continue;
    const slug = match[1];
    const html = await read(`post/${slug}/index.html`);
    const title = stripTags(html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/)?.[1] || item.title);
    const dateAttr = html.match(/<time[^>]*datetime="([^"]+)"/)?.[1] || '';
    const date = times.get(slug) || `${dateAttr}T12:00:00+08:00`;
    const tags = [...html.matchAll(/<div class="tags[^"]*">([\s\S]*?)<\/div>/g)]
      .flatMap((m) => [...m[1].matchAll(/class="ctag[^"]*"[^>]*>([^<]+)</g)].map((x) => decodeEntities(x[1].trim())))
      .filter(Boolean);
    const card = cards.get(slug) || {};
    const rawCover =
      card.cover ||
      html.match(/class="featured-image[^"]*"[^>]*background-image:\s*url\('([^']+)'\)/)?.[1]?.replace(`${SITE}/`, '/') ||
      '';
    // 默认封面是一张被 12 篇文章共用的占位图，交给新版面自动生成排版封面
    const cover = rawCover.includes('custom-featureImage') ? '' : rawCover;
    const markdown = cleanMarkdown(td.turndown(extractArticle(html)));
    const excerpt = (card.excerpt || estimateExcerpt(markdown)).replace(/\s+/g, ' ').trim();

    const fields = {
      title,
      slug,
      date,
      kind: 'post',
      tags: [...new Set(tags)],
      cover,
      excerpt,
      legacy: true,
    };
    const out = path.join(ROOT, 'content/posts', `${slug}.md`);
    await fs.writeFile(out, writeFrontmatter(fields, markdown), 'utf8');
    report.push({ slug, title, chars: markdown.length, date, tags: fields.tags, cover: Boolean(cover) });
  }

  // 关于页
  const aboutHtml = await read('post/about/index.html');
  const aboutMd = cleanMarkdown(td.turndown(extractArticle(aboutHtml)));
  await fs.writeFile(
    path.join(ROOT, 'content/pages/about.md'),
    writeFrontmatter(
      {
        title: '关于',
        slug: 'about',
        kind: 'page',
        excerpt: '关于本站与博主。',
      },
      aboutMd,
    ),
    'utf8',
  );

  // 给迁移报告留一份，方便核对
  await fs.writeFile(
    path.join(ROOT, '.tmp/legacy-import-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  ).catch(() => {});

  console.log(`迁移完成：${report.length} 篇文章 + 1 个关于页`);
  console.table(report.map((r) => ({ slug: r.slug, chars: r.chars, cover: r.cover, tags: r.tags.join(',') })));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
