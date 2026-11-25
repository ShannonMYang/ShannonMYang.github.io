import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { parseYaml } from './frontmatter.mjs';
import {
  asDate,
  excerptFrom,
  hashString,
  readingMinutes,
  stripMarkdown,
  tagSlug,
  uniq,
} from './util.mjs';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const CONTENT_DIR = path.join(ROOT, 'content');

export async function loadSite() {
  const raw = await fs.readFile(path.join(CONTENT_DIR, 'site.yml'), 'utf8');
  return parseYaml(raw);
}

async function readDir(dir, kind) {
  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const items = [];
  for (const file of entries) {
    if (!file.endsWith('.md')) continue;
    const full = path.join(dir, file);
    const raw = await fs.readFile(full, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data || {};
    const slug = String(data.slug || file.replace(/\.md$/, '')).trim();
    const title = String(data.title || slug).trim();
    const date = asDate(data.date);
    const body = parsed.content.trim();
    const tags = uniq((Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).map((t) => String(t).trim()).filter(Boolean));
    const cover = typeof data.cover === 'string' ? data.cover.trim() : '';
    const item = {
      file,
      sourcePath: path.relative(ROOT, full),
      kind: data.kind || kind,
      slug,
      title,
      date,
      updated: data.updated ? asDate(data.updated) : date,
      tags,
      cover,
      excerpt: String(data.excerpt || '').trim() || excerptFrom(body),
      body,
      plain: stripMarkdown(body),
      readingMinutes: readingMinutes(body),
      accent: String(data.accent || '').trim(),
      issue: data.issue ? Number(data.issue) : null,
      issueUrl: data.issueUrl || '',
      repo: data.repo || '',
      comments: Number(data.comments || 0),
      featured: Boolean(data.featured),
      draft: Boolean(data.draft),
      legacy: Boolean(data.legacy),
      tone: hashString(`${slug}${title}`) % 6,
      glyph: firstGlyph(title),
      year: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(date),
    };
    if (!item.accent) {
      const palette = ['#8a5a3b', '#426b5e', '#7a5a86', '#a8763e', '#3e5c7a', '#7d4b46'];
      item.accent = palette[hashString(item.tags[0] || item.title) % palette.length];
    }
    item.url =
      item.kind === 'note'
        ? `/note/${encodeURIComponent(item.slug)}/`
        : item.kind === 'page'
          ? `/${encodeURIComponent(item.slug)}/`
          : `/post/${encodeURIComponent(item.slug)}/`;
    item.typeLabel = item.kind === 'note' ? '笔记' : '文章';
    items.push(item);
  }
  return items;
}

function firstGlyph(title) {
  const clean = title.replace(/^[\s'"“”‘’《》【】[\]()（）]+/, '').trim();
  return Array.from(clean)[0] || '木';
}

export async function loadContent() {
  const [posts, notes, pages] = await Promise.all([
    readDir(path.join(CONTENT_DIR, 'posts'), 'post'),
    readDir(path.join(CONTENT_DIR, 'notes'), 'note'),
    readDir(path.join(CONTENT_DIR, 'pages'), 'page'),
  ]);

  const all = [...posts, ...notes].filter((item) => !item.draft);
  all.sort((a, b) => b.date - a.date || a.title.localeCompare(b.title, 'zh-Hans-CN'));

  // 统一时间线里的上一篇 / 下一篇
  all.forEach((item, index) => {
    item.prev = all[index - 1] || null; // 更新时间更近的一篇
    item.next = all[index + 1] || null;
  });

  // 标签聚合（大小写/标点差异归并到同一个 slug）
  const tagMap = new Map();
  for (const item of all) {
    for (const name of item.tags) {
      const slug = tagSlug(name);
      if (!tagMap.has(slug)) {
        tagMap.set(slug, { name, slug, count: 0, items: [], kinds: new Set() });
      }
      const tag = tagMap.get(slug);
      tag.count += 1;
      tag.items.push(item);
      tag.kinds.add(item.kind);
      // 用出现频率最高的写法作为展示名
      if (name.length < tag.name.length) tag.name = name;
    }
  }
  const tags = [...tagMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));

  // 给每个标签分配一个稳定的、彼此区分度高的印泥色
  const TAG_PALETTE = [
    '#b23a2b', // 朱砂
    '#3f5a78', // 靛青
    '#4c6b4a', // 苔绿
    '#96652c', // 赭石
    '#6d4a62', // 紫檀
    '#3d6b67', // 青瓷
    '#8a4433', // 陶红
    '#4a5260', // 墨蓝
    '#6e5f2d', // 橄榄
    '#8f4650', // 胭脂
    '#5a6b3f', // 竹青
    '#7a4b2f', // 焦茶
  ];
  const usedColors = new Set();
  for (const tag of tags) {
    let index = hashString(tag.slug) % TAG_PALETTE.length;
    let guard = 0;
    while (usedColors.has(index) && guard < TAG_PALETTE.length) {
      index = (index + 1) % TAG_PALETTE.length;
      guard += 1;
    }
    usedColors.add(index);
    if (usedColors.size >= TAG_PALETTE.length) usedColors.clear();
    tag.color = TAG_PALETTE[index];
  }

  for (const item of all) {
    item.tagEntries = item.tags.map((name) => {
      const slug = tagSlug(name);
      return { name, slug, color: tagMap.get(slug)?.color || TAG_PALETTE[0] };
    });
  }

  for (const tag of tags) {
    tag.items.sort((a, b) => b.date - a.date);
    tag.latest = tag.items[0];
  }

  // 相关阅读：共同标签越多越靠前
  for (const item of all) {
    const own = new Set(item.tags.map(tagSlug));
    const scored = all
      .filter((other) => other !== item)
      .map((other) => {
        let score = 0;
        for (const tag of other.tags) if (own.has(tagSlug(tag))) score += 2;
        if (other.kind === item.kind) score += 0.4;
        // 年份接近的稍作加权
        score -= Math.min(3, Math.abs(other.date - item.date) / (1000 * 60 * 60 * 24 * 365 * 4));
        return { other, score };
      })
      .filter((entry) => entry.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.other);
    item.related = scored;
  }

  const dupes = new Map();
  for (const item of [...posts, ...notes]) {
    if (dupes.has(item.slug)) {
      throw new Error(`内容 slug 重复：「${item.slug}」出现在 ${dupes.get(item.slug)} 与 ${item.sourcePath}`);
    }
    dupes.set(item.slug, item.sourcePath);
  }

  const about = pages.find((page) => page.slug === 'about') || null;

  return {
    posts,
    notes,
    pages,
    about,
    all,
    tags,
    stats: {
      posts: all.filter((item) => item.kind === 'post').length,
      notes: all.filter((item) => item.kind === 'note').length,
      tags: tags.length,
      words: all.reduce((sum, item) => sum + item.plain.length, 0),
      latest: all[0] || null,
      firstYear: all.length ? Math.min(...all.map((item) => Number(item.year) || 9999)) : new Date().getFullYear(),
      lastYear: all.length ? Math.max(...all.map((item) => Number(item.year) || 0)) : new Date().getFullYear(),
    },
  };
}

export function findTag(tags, slug) {
  return tags.find((tag) => tag.slug === slug) || null;
}
