import { escapeHtml, toDateTimeAttr } from './util.mjs';

function cdataSafe(value = '') {
  return String(value)
    // XML 1.0 不允许的控制字符
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 生成 Atom Feed。
 * @param {{site: object, items: Array, entries: Array<{item: object, html: string}>}} options
 */
export function atomFeed({ site, items, rendered, limit = 30 }) {
  const selected = items.slice(0, limit);
  const updated = selected[0]?.updated || selected[0]?.date || new Date();
  const entries = selected
    .map((item) => {
      const html = rendered.get(item.slug)?.html || '';
      return `  <entry>
    <title>${cdataSafe(item.title)}</title>
    <link href="${escapeHtml(site.url + item.url)}"/>
    <id>${escapeHtml(site.url + item.url)}</id>
    <published>${toDateTimeAttr(item.date)}</published>
    <updated>${toDateTimeAttr(item.updated)}</updated>
    <author><name>${cdataSafe(site.author?.name || site.title)}</name></author>
${item.tags.map((tag) => `    <category term="${escapeHtml(tag)}"/>`).join('\n')}
    <summary type="html">${cdataSafe(item.excerpt)}</summary>
    <content type="html">${cdataSafe(html)}</content>
  </entry>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
  <title>${cdataSafe(site.title)}</title>
  <subtitle>${cdataSafe(site.description || '')}</subtitle>
  <id>${escapeHtml(site.url)}/</id>
  <link href="${escapeHtml(site.url)}/atom.xml" rel="self" type="application/atom+xml"/>
  <link href="${escapeHtml(site.url)}/" rel="alternate" type="text/html"/>
  <updated>${toDateTimeAttr(updated)}</updated>
  <generator uri="https://github.com/ShannonMYang/ShannonMYang.github.io">tuhe-shop</generator>
  <author><name>${cdataSafe(site.author?.name || site.title)}</name></author>
  <rights>© ${site.since || 2018}–${new Date().getFullYear()} ${cdataSafe(site.author?.name || site.title)}</rights>
${entries}
</feed>
`;
}

export function sitemap({ site, items, tags }) {
  const urls = [
    { loc: '/', lastmod: items[0]?.updated },
    { loc: '/notes/', lastmod: items.find((i) => i.kind === 'note')?.updated },
    { loc: '/archives/', lastmod: items[0]?.updated },
    { loc: '/tags/', lastmod: items[0]?.updated },
    { loc: '/about/' },
    ...tags.map((tag) => ({ loc: `/tag/${encodeURIComponent(tag.slug)}/`, lastmod: tag.latest?.updated })),
    ...items.map((item) => ({ loc: item.url, lastmod: item.updated })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${escapeHtml(site.url + entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${toDateTimeAttr(entry.lastmod)}</lastmod>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

export function robots(site) {
  return `User-agent: *
Allow: /
Disallow: /content/
Disallow: /site/
Disallow: /studio/
Disallow: /scripts/
Disallow: /node_modules/
Disallow: /.tmp/

Sitemap: ${site.url}/sitemap.xml
`;
}
