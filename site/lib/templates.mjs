import { escapeAttr, escapeHtml, formatDate, formatDateLong, tagSlug, toDateTimeAttr } from './util.mjs';

const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.2-3.2"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"></path></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"></path></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.6v-2c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.3-1.6-1.3-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.2 1.2-3-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10.5 10.5 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.2 1.8 1.2 3 0 4.3-2.6 5.2-5.1 5.5.4.3.8 1 .8 2.1v3.1c0 .4.2.7.8.6A11.3 11.3 0 0 0 12 .7Z"></path></svg>',
  rss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1.4" fill="currentColor" stroke="none"></circle></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-.8.8"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l.8-.8"></path></svg>',
};

const CARD_RATIOS = ['3 / 4', '1 / 1', '4 / 5', '5 / 4', '4 / 3', '3 / 4'];
const TYPO_RATIOS = ['4 / 5', '1 / 1', '3 / 4', '4 / 5', '5 / 4', '1 / 1'];

function navLink(site, active) {
  return (site.navigation || [])
    .map((entry) => {
      const isActive = isActiveNav(entry.url, active);
      return `<a class="nav__link${isActive ? ' is-active' : ''}" href="${escapeAttr(entry.url)}"${isActive ? ' aria-current="page"' : ''}>${escapeHtml(entry.title)}</a>`;
    })
    .join('');
}

function isActiveNav(url, active) {
  if (!active) return false;
  if (url === '/') return active === '/';
  if (url === '/tags/') return active.startsWith('/tag/') || active.startsWith('/tags/');
  return active.startsWith(url);
}

function tagUrl(tag) {
  return `/tag/${encodeURIComponent(tag.slug)}/`;
}

export function tagPill(tag, extraClass = '') {
  return `<a class="tag-pill ${extraClass}" href="${escapeAttr(tagUrl(tag))}">${escapeHtml(tag.name)}</a>`;
}

function brand(site) {
  return `<a class="brand" href="/">
    <span class="brand__seal" aria-hidden="true">木</span>
    <span class="brand__text"><strong>${escapeHtml(site.wordmark || site.title)}</strong><small>${escapeHtml(site.latin || '')}</small></span>
  </a>`;
}

function head({ site, title, description, path, type = 'website', image, extraHead = '', bodyClass = '' }) {
  const fullTitle = title ? `${title} · ${site.title}` : `${site.title} · ${site.tagline}`;
  const desc = description || site.description || '';
  const canonical = `${site.url}${path}`;
  const ogImage = image ? new URL(image, site.url).toString() : `${site.url}/assets/og-default.png`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js');try{const t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark';}catch(e){}</script>
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeAttr(desc)}">
<meta name="author" content="${escapeAttr(site.author?.name || site.title)}">
<link rel="canonical" href="${escapeAttr(canonical)}">
<meta name="theme-color" content="#f4efe6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15120e" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="${escapeAttr(site.title)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escapeAttr(fullTitle)}">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:image" content="${escapeAttr(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(fullTitle)}">
<meta name="twitter:description" content="${escapeAttr(desc)}">
<meta name="twitter:image" content="${escapeAttr(ogImage)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="alternate" type="application/atom+xml" title="${escapeAttr(site.title)}" href="/atom.xml">
<link rel="stylesheet" href="/assets/site.css?v=__ASSET_VERSION__">
${extraHead}
</head>
<body class="${escapeAttr(bodyClass)}">
<a class="skip-link" href="#main">跳到主要内容</a>
<div class="site-shell">
<header class="site-header" id="site-header">
  <div class="site-header__inner">
    ${brand(site)}
    <nav class="nav" id="site-nav" aria-label="主导航">${navLink(site, path)}</nav>
    <div class="header-actions">
      <button class="icon-btn" type="button" data-open-search aria-label="搜索 ⌘K">${ICONS.search}<span class="icon-btn__text">搜索</span><kbd aria-hidden="true">⌘K</kbd></button>
      <button class="icon-btn icon-btn--theme" type="button" data-toggle-theme aria-label="切换深浅色">
        <span class="theme-icon theme-icon--light">${ICONS.moon}</span><span class="theme-icon theme-icon--dark">${ICONS.sun}</span>
      </button>
      <a class="icon-btn icon-btn--github" href="${escapeAttr(site.author?.github || '#')}" target="_blank" rel="noopener noreferrer" aria-label="GitHub">${ICONS.github}</a>
      <button class="icon-btn icon-btn--menu" type="button" data-toggle-menu aria-label="打开菜单" aria-expanded="false" aria-controls="site-nav">${ICONS.menu}</button>
    </div>
  </div>
</header>
`;
}

function footer(site, stats) {
  const year = new Date().getFullYear();
  return `</div>
<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <span class="brand__seal brand__seal--small" aria-hidden="true">木</span>
      <div><strong>${escapeHtml(site.wordmark || site.title)}</strong><p>${escapeHtml(site.tagline)}</p></div>
    </div>
    <p class="site-footer__line">${stats ? `${stats.posts} 篇文章 · ${stats.notes} 篇笔记 · ${stats.tags} 个标签` : ''}<br>© ${site.since || 2018}–${year} ${escapeHtml(site.author?.name || site.title)}</p>
    <nav class="site-footer__links" aria-label="页脚导航">
      <a href="/archives/">归档</a><a href="/tags/">标签</a><a href="/atom.xml">RSS</a>
      <a href="${escapeAttr(site.author?.github || '#')}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://github.com/ShannonMYang/ShannonMYang.github.io" target="_blank" rel="noopener noreferrer">源仓库</a>
    </nav>
  </div>
  <p class="site-footer__colophon">${escapeHtml(site.footer?.note || '')}</p>
</footer>
<div class="search-modal" id="search-modal" hidden>
  <div class="search-modal__backdrop" data-close-search></div>
  <div class="search-modal__panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
    <h2 class="sr-only" id="search-title">搜索站内内容</h2>
    <div class="search-modal__head">
      <span class="search-modal__icon">${ICONS.search}</span>
      <input id="search-input" class="search-modal__input" type="search" placeholder="搜索文章、笔记、标签…" autocomplete="off" enterkeyhint="search">
      <button class="icon-btn icon-btn--sm" type="button" data-close-search aria-label="关闭搜索">${ICONS.close}</button>
    </div>
    <div class="search-modal__body" id="search-results" aria-live="polite"></div>
    <div class="search-modal__foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>
  </div>
</div>
<button class="to-top" type="button" data-to-top aria-label="回到顶部">↑</button>
<script src="/assets/site.js?v=__ASSET_VERSION__" defer></script>
</body>
</html>`;
}

function hero(site, stats) {
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="hero__grid">
    <div class="hero__intro">
      <p class="hero__eyebrow"><span class="hero__dot"></span>${escapeHtml(site.hero?.eyebrow || '')}</p>
      <h1 class="hero__title" id="hero-title">${escapeHtml(site.wordmark || site.title)}<span class="hero__period">。</span></h1>
      <p class="hero__desc">${escapeHtml(site.hero?.description || site.description)}</p>
      <div class="hero__stats" aria-label="站点统计">
        <span class="hero__stat"><strong>${stats.posts + stats.notes}</strong><em>篇内容</em></span>
        <span class="hero__stat"><strong>${stats.tags}</strong><em>个标签</em></span>
        <span class="hero__stat"><strong>${stats.firstYear}–${stats.lastYear}</strong><em>持续记录</em></span>
      </div>
      <div class="hero__actions">
        <a class="btn btn--primary" href="#all">开始阅读 ${ICONS.arrow}</a>
        <a class="btn btn--ghost" href="/notes/">笔记库</a>
      </div>
    </div>
    <div class="hero__art">
      <div class="hero__book">
        <span class="hero__book-line">${escapeHtml(site.hero?.vertical || '')}</span>
        <span class="hero__book-mark">木鱼</span>
        <span class="hero__book-caption">${escapeHtml(site.hero?.motto || '')}</span>
      </div>
      <span class="hero__stamp">${ICONS.link}</span>
    </div>
  </div>
</section>`;
}

function filterBar(stats, tags) {
  const topTags = tags.slice(0, 10);
  return `<section class="filters" id="filters" aria-label="内容筛选">
  <div class="filters__row filters__row--top">
    <div class="segmented" role="group" aria-label="内容类型">
      <button class="segmented__btn is-active" type="button" data-type="all">全部 <span>${stats.posts + stats.notes}</span></button>
      <button class="segmented__btn" type="button" data-type="post">文章 <span>${stats.posts}</span></button>
      <button class="segmented__btn" type="button" data-type="note">笔记 <span>${stats.notes}</span></button>
    </div>
    <div class="filters__tools">
      <label class="grid-search">
        <span class="grid-search__icon">${ICONS.search}</span>
        <input class="grid-search__input" id="grid-search" type="search" placeholder="筛选标题、摘要…" autocomplete="off" aria-label="在当前页面筛选内容">
      </label>
      <button class="text-btn filters__clear" type="button" data-clear-filters hidden>清除筛选 ×</button>
    </div>
  </div>
  <div class="filters__row filters__row--tags">
    <span class="filters__label">标签</span>
    <div class="chips" role="group" aria-label="按标签筛选">
      ${topTags
        .map(
          (tag) =>
            `<button class="chip" type="button" data-tag="${escapeAttr(tag.slug)}">${escapeHtml(tag.name)}<span>${tag.count}</span></button>`,
        )
        .join('')}
      <a class="chip chip--more" href="/tags/">全部标签 ${ICONS.arrow}</a>
    </div>
  </div>
  <p class="filters__status" id="filters-status" aria-live="polite"></p>
</section>`;
}

export function card(item, index = 0) {
  const isNote = item.kind === 'note';
  const hasCover = Boolean(item.cover);
  const ratio = hasCover ? CARD_RATIOS[item.tone % CARD_RATIOS.length] : TYPO_RATIOS[item.tone % TYPO_RATIOS.length];
  const tags = item.tags.slice(0, 2);
  const searchText = `${item.title} ${item.excerpt} ${item.tags.join(' ')}`.toLowerCase();
  const tagSlugs = item.tags.map((t) => tagSlug(t)).join('|');
  const glyph = isNote && item.issue ? `#${item.issue}` : item.glyph;
  const issueBadge = isNote ? `<span class="card__issue">${escapeHtml(item.tags[0] || '笔记')}</span>` : '';
  return `<article class="card${isNote ? ' card--note' : ''}" data-kind="${item.kind}" data-tags="${escapeAttr(tagSlugs)}" data-search="${escapeAttr(searchText)}" style="--i:${Math.min(index, 24)};--accent:${escapeAttr(item.accent || '#9c6b3c')}">
  <a class="card__media ${hasCover ? 'card__media--image' : 'card__media--typo'}" href="${escapeAttr(item.url)}" tabindex="-1" aria-hidden="true" style="--ratio:${ratio}">
    ${
      hasCover
        ? `<img src="${escapeAttr(item.cover)}" alt="" loading="lazy" decoding="async">`
        : `<span class="card__glyph${isNote ? ' card__glyph--num' : ''}">${escapeHtml(glyph)}</span><span class="card__typo-line">${escapeHtml(item.tags[0] || (isNote ? 'NOTE' : 'ESSAY'))}</span>`
    }
    <span class="card__badge">${isNote ? '笔记' : '文章'}</span>
    ${issueBadge}
  </a>
  <div class="card__body">
    <div class="card__kicker">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('<i>·</i>')}</div>
    <h2 class="card__title"><a href="${escapeAttr(item.url)}">${escapeHtml(item.title)}</a></h2>
    <p class="card__excerpt">${escapeHtml(item.excerpt)}</p>
    <div class="card__meta">
      <time datetime="${toDateTimeAttr(item.date)}">${formatDate(item.date)}</time>
      <span class="card__dot">·</span>
      <span>${item.readingMinutes} 分钟</span>
      <span class="card__go" aria-hidden="true">${ICONS.arrow}</span>
    </div>
  </div>
</article>`;
}

export function masonry(items) {
  return `<div class="masonry" id="content-grid" data-masonry>
${items.map((item, index) => card(item, index)).join('\n')}
</div>
<div class="empty-state" id="empty-state" hidden>
  <p class="empty-state__mark">空</p>
  <p>没有找到符合条件的内容。</p>
  <button class="btn btn--ghost" type="button" data-clear-filters>清除筛选</button>
</div>`;
}

export function homePage({ site, content }) {
  const { stats, tags, all } = content;
  const body = `${hero(site, stats)}
<main id="main">
  <section class="content-section" id="all" aria-labelledby="all-title">
    <div class="section-head">
      <div>
        <p class="section-eyebrow">ALL NOTES & ESSAYS</p>
        <h2 class="section-title" id="all-title">全部内容<span>${all.length}</span></h2>
      </div>
      <p class="section-note">按时间倒序 · 瀑布流排布</p>
    </div>
    ${filterBar(stats, tags)}
    ${masonry(all)}
  </section>
</main>`;
  return head({ site, title: '', description: site.description, path: '/', bodyClass: 'page-home' }) + body + footer(site, stats);
}

export function articlePage({ site, item, content, toc, hasMath }) {
  const author = site.author || {};
  const isNote = item.kind === 'note';
  const editUrl = `https://github.com/ShannonMYang/ShannonMYang.github.io/edit/master/${item.sourcePath}`;
  const tagPills = item.tags
    .map((name) => {
      const tag = content.tags.find((t) => t.slug === tagSlug(name) || t.name === name);
      return tag ? tagPill(tag) : `<span class="tag-pill">${escapeHtml(name)}</span>`;
    })
    .join('');

  const noteBanner = isNote
    ? `<aside class="note-source">
    <div class="note-source__main">
      <span class="note-source__mark">#${item.issue}</span>
      <div><p class="note-source__title">这是一篇来自 GitHub Issues 的笔记</p><p class="note-source__text">原文、修订与讨论都在 <a href="${escapeAttr(item.issueUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)} #${item.issue}</a>，这里只做归档与阅读优化。</p></div>
    </div>
    <div class="note-source__meta">${item.tags.map((t) => `<span class="label-chip" style="--label-accent:${escapeAttr(item.accent)}">${escapeHtml(t)}</span>`).join('')}<a class="note-source__link" href="${escapeAttr(item.issueUrl)}" target="_blank" rel="noopener noreferrer">在 GitHub 查看讨论 →</a></div>
  </aside>`
    : '';

  const cover = item.cover
    ? `<figure class="article__cover"><img src="${escapeAttr(item.cover)}" alt="${escapeAttr(item.title)} 的封面图" loading="eager" decoding="async"></figure>`
    : '';

  const tocHtml = toc.length
    ? `<aside class="toc" aria-label="本文目录">
      <div class="toc__inner">
        <p class="toc__title">本文目录</p>
        <ol class="toc__list">${toc
          .map(
            (entry) =>
              `<li class="toc__item toc__item--h${entry.level}"><a href="#${escapeAttr(entry.id)}">${escapeHtml(entry.title)}</a></li>`,
          )
          .join('')}</ol>
        <a class="toc__top" href="#top">回到顶部 ↑</a>
      </div>
    </aside>`
    : '';

  const navItem = (target, dir) =>
    target
      ? `<a class="postnav__item postnav__item--${dir}" href="${escapeAttr(target.url)}"><span class="postnav__label">${dir === 'prev' ? '← 上一篇' : '下一篇 →'}</span><span class="postnav__title">${escapeHtml(target.title)}</span><span class="postnav__meta">${formatDate(target.date)} · ${target.typeLabel}</span></a>`
      : `<span class="postnav__item postnav__item--empty postnav__item--${dir}"><span class="postnav__label">${dir === 'prev' ? '← 上一篇' : '下一篇 →'}</span><span class="postnav__title">已经到头了</span></span>`;

  const related = item.related?.length
    ? `<section class="related" aria-labelledby="related-title">
      <div class="related__head"><h2 id="related-title">继续阅读</h2><a href="/archives/">全部归档 →</a></div>
      <div class="related__grid">${item.related
        .map(
          (post) => `<a class="mini-card" href="${escapeAttr(post.url)}">
            <span class="mini-card__kind">${post.typeLabel}</span>
            <span class="mini-card__title">${escapeHtml(post.title)}</span>
            <span class="mini-card__meta">${formatDate(post.date)} · ${post.readingMinutes} 分钟</span>
          </a>`,
        )
        .join('')}</div>
    </section>`
    : '';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: item.title,
    datePublished: toDateTimeAttr(item.date),
    dateModified: toDateTimeAttr(item.updated),
    author: { '@type': 'Person', name: author.name },
    image: item.cover ? new URL(item.cover, site.url).toString() : undefined,
    description: item.excerpt,
    mainEntityOfPage: `${site.url}${item.url}`,
  });

  const body = `<div class="reading-progress" aria-hidden="true"><span id="reading-progress"></span></div>
<span id="top" aria-hidden="true"></span>
<main id="main" class="article-main">
  <article class="article">
    <header class="article__head">
      <nav class="article__crumbs" aria-label="面包屑"><a href="/">首页</a><span>/</span>${isNote ? '<a href="/notes/">笔记库</a>' : '<a href="/archives/">文章</a>'}<span>/</span><span aria-current="page">${escapeHtml(item.typeLabel)}</span></nav>
      <div class="article__kicker"><span class="kind-tag kind-tag--${item.kind}">${item.typeLabel}</span><time datetime="${toDateTimeAttr(item.date)}">${formatDateLong(item.date)}</time><span class="article__kicker-dot">·</span><span>约 ${item.readingMinutes} 分钟</span>${item.updated && item.updated - item.date > 86400000 ? `<span class="article__kicker-dot">·</span><span>更新于 ${formatDate(item.updated)}</span>` : ''}</div>
      <h1 class="article__title">${escapeHtml(item.title)}</h1>
      ${item.excerpt ? `<p class="article__lead">${escapeHtml(item.excerpt)}</p>` : ''}
      <div class="article__meta">
        <span class="article__author"><img class="avatar" src="${escapeAttr(author.avatar || '/images/avatar.png')}" alt="" loading="lazy">${escapeHtml(author.name || '')}</span>
        <span class="article__meta-sep">/</span>
        <div class="article__tags">${tagPills}</div>
        <a class="article__edit" href="${escapeAttr(editUrl)}" target="_blank" rel="noopener noreferrer">${ICONS.link} 编辑此页</a>
      </div>
    </header>
    ${cover}
    ${noteBanner}
    <div class="article__layout">
      <div class="prose" id="article-content">${item.html}</div>
      ${tocHtml}
    </div>
    <footer class="article__foot">
      <div class="article__foot-tags"><span>标签</span>${tagPills}</div>
      <div class="postnav">${navItem(item.prev, 'prev')}${navItem(item.next, 'next')}</div>
      ${related}
      <p class="article__license">本文作者 <a href="${escapeAttr(author.github || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(author.name || '')}</a>，转载请注明出处。最后更新：${formatDate(item.updated)}</p>
    </footer>
  </article>
</main>
<script type="application/ld+json">${jsonLd}</script>`;
  return htmlDocument({
    site,
    title: item.title,
    description: item.excerpt,
    path: item.url,
    type: 'article',
    image: item.cover || undefined,
    bodyClass: `page-article page-kind-${item.kind}`,
    body,
    hasMath,
  });
}

function htmlDocument({ site, title, description, path, type, image, body, bodyClass, hasMath }) {
  const extraHead = hasMath ? '<link rel="stylesheet" href="/assets/katex/katex.min.css">' : '';
  return (
    head({ site, title, description, path, type, image, bodyClass, extraHead }) +
    body +
    footer(site, null)
  );
}

export function archivesPage({ site, content }) {
  const groups = new Map();
  for (const item of content.all) {
    const year = String(item.year || '');
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(item);
  }
  const years = [...groups.keys()].sort((a, b) => Number(b) - Number(a));
  const body = `<main id="main">
  <section class="page-head">
    <p class="section-eyebrow">ARCHIVE · ${content.all.length} ENTRIES</p>
    <h1 class="page-title">归档<span class="page-title__count">${content.all.length}</span></h1>
    <p class="page-desc">从 ${content.stats.firstYear} 到 ${content.stats.lastYear}，一共 ${content.all.length} 次记录。按时间从近到远排列。</p>
    <nav class="year-nav" aria-label="按年份跳转">${years.map((year) => `<a href="#y${year}">${year}</a>`).join('')}</nav>
  </section>
  <div class="archive">
    ${years
      .map((year) => {
        const items = groups.get(year);
        return `<section class="archive__group" id="y${year}" aria-labelledby="yl${year}">
          <header class="archive__year"><h2 id="yl${year}">${year}</h2><span>${items.length} 篇</span></header>
          <ol class="archive__list">
            ${items
              .map(
                (item) => `<li class="archive__item">
                  <time datetime="${toDateTimeAttr(item.date)}">${formatDate(item.date).slice(5)}</time>
                  <span class="kind-dot kind-dot--${item.kind}" role="img" aria-label="${item.typeLabel}"></span>
                  <a class="archive__title" href="${escapeAttr(item.url)}">${escapeHtml(item.title)}</a>
                  <span class="archive__tags">${item.tags.slice(0, 2).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</span>
                  <span class="archive__read">${item.readingMinutes} 分钟</span>
                </li>`,
              )
              .join('')}
          </ol>
        </section>`;
      })
      .join('')}
  </div>
</main>`;
  return htmlDocument({
    site,
    title: '归档',
    description: `${site.title}的全部文章与笔记归档，共 ${content.all.length} 篇。`,
    path: '/archives/',
    bodyClass: 'page-archives',
    body,
  });
}

export function tagsPage({ site, content }) {
  const body = `<main id="main">
  <section class="page-head">
    <p class="section-eyebrow">TAGS · ${content.tags.length} TOPICS</p>
    <h1 class="page-title">标签<span class="page-title__count">${content.tags.length}</span></h1>
    <p class="page-desc">所有内容按主题聚合。点击标签，查看同一主题下的全部文章与笔记。</p>
  </section>
  <div class="tag-grid">
    ${content.tags
      .map(
        (tag) => `<a class="tag-card" href="${escapeAttr(tagUrl(tag))}" style="--accent:${escapeAttr(tag.latest?.accent || '#9c6b3c')}">
          <span class="tag-card__count">${String(tag.count).padStart(2, '0')}</span>
          <span class="tag-card__name">${escapeHtml(tag.name)}</span>
          <span class="tag-card__latest">${escapeHtml(tag.latest?.title || '')}</span>
          <span class="tag-card__meta">${tag.kinds.has('note') && tag.kinds.has('post') ? '文章 + 笔记' : tag.kinds.has('note') ? '笔记' : '文章'} · 最近 ${formatDate(tag.latest?.date)}</span>
        </a>`,
      )
      .join('')}
  </div>
</main>`;
  return htmlDocument({
    site,
    title: '标签',
    description: `${site.title}的全部标签索引。`,
    path: '/tags/',
    bodyClass: 'page-tags',
    body,
  });
}

export function tagPage({ site, content, tag }) {
  const body = `<main id="main">
  <section class="page-head page-head--tag">
    <p class="section-eyebrow">TAG · ${tag.count} ENTRIES</p>
    <h1 class="page-title">${escapeHtml(tag.name)}<span class="page-title__count">${tag.count}</span></h1>
    <p class="page-desc">${tag.count} 篇相关内容，按时间倒序。</p>
    <div class="page-head__actions"><a class="btn btn--ghost btn--sm" href="/tags/">全部标签</a><a class="btn btn--ghost btn--sm" href="/">回到首页</a></div>
  </section>
  ${masonry(tag.items)}
</main>`;
  return htmlDocument({
    site,
    title: `标签：${tag.name}`,
    description: `${site.title}中标签为「${tag.name}」的全部内容。`,
    path: tagUrl(tag),
    bodyClass: 'page-tag',
    body,
  });
}

export function notesPage({ site, content }) {
  const groups = new Map();
  for (const note of content.notes) {
    const key = note.tags[0] || '未分类';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }
  const entries = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const body = `<main id="main">
  <section class="page-head">
    <p class="section-eyebrow">GITHUB NOTES · ${content.notes.length} ENTRIES</p>
    <h1 class="page-title">笔记库<span class="page-title__count">${content.notes.length}</span></h1>
    <p class="page-desc">这些笔记原先零散地写在 GitHub Issues 里。现在它们被同步到这里，按主题收进书架，也可以直接去 GitHub 查看原文与讨论。</p>
    <div class="page-head__actions"><a class="btn btn--ghost btn--sm" href="${escapeAttr(site.notes?.url || '#')}" target="_blank" rel="noopener noreferrer">${ICONS.github} 原始 Issues 仓库</a><a class="btn btn--ghost btn--sm" href="/archives/">全部内容归档</a></div>
  </section>
  <div class="shelf">
    ${entries
      .map(
        ([label, notes], groupIndex) => `<section class="shelf__group" aria-labelledby="shelf-${groupIndex}">
          <header class="shelf__head"><h2 id="shelf-${groupIndex}">${escapeHtml(label)}</h2><span>${notes.length}</span></header>
          <ol class="shelf__list">
            ${notes
              .map(
                (note) => `<li><a href="${escapeAttr(note.url)}">
                  <span class="shelf__num">#${note.issue || '—'}</span>
                  <span class="shelf__title">${escapeHtml(note.title)}</span>
                  <span class="shelf__date">${formatDate(note.date)}</span>
                  <span class="shelf__go">→</span>
                </a></li>`,
              )
              .join('')}
          </ol>
        </section>`,
      )
      .join('')}
  </div>
</main>`;
  return htmlDocument({
    site,
    title: '笔记库',
    description: `从 GitHub Issues 同步的 ${content.notes.length} 篇开发笔记。`,
    path: '/notes/',
    bodyClass: 'page-notes',
    body,
  });
}

export function aboutPage({ site, content, page, html }) {
  const author = site.author || {};
  const body = `<main id="main" class="about-main">
  <section class="page-head page-head--about">
    <p class="section-eyebrow">ABOUT · 关于</p>
    <h1 class="page-title">关于这间小店<span class="page-title__count">${content.stats.posts + content.stats.notes}</span></h1>
    <p class="page-desc">${escapeHtml(site.hero?.description || site.description)}</p>
  </section>
  <div class="about">
    <aside class="about__card">
      <img class="about__avatar" src="${escapeAttr(author.avatar || '/images/avatar.png')}" alt="${escapeAttr(author.name || '')}的头像" loading="lazy">
      <h2>${escapeHtml(author.name || '')}</h2>
      <p>${escapeHtml(author.bio || '')}</p>
      <dl class="about__stats">
        <div><dt>文章</dt><dd>${content.stats.posts}</dd></div>
        <div><dt>笔记</dt><dd>${content.stats.notes}</dd></div>
        <div><dt>标签</dt><dd>${content.stats.tags}</dd></div>
      </dl>
      <div class="about__links">
        ${author.github ? `<a href="${escapeAttr(author.github)}" target="_blank" rel="noopener noreferrer">${ICONS.github} GitHub</a>` : ''}
        ${author.jianshu ? `<a href="${escapeAttr(author.jianshu)}" target="_blank" rel="noopener noreferrer">${ICONS.link} 简书</a>` : ''}
        <a href="/atom.xml">${ICONS.rss} RSS</a>
      </div>
    </aside>
    <div class="about__body">
      <div class="prose">${html}</div>
      <section class="about__colophon">
        <h2>关于这个站点</h2>
        <p>这是一个纯静态站点：内容用 Markdown 写作，通过自建的 Node.js 生成器构建，托管在 GitHub Pages 上。没有后端、没有数据库，也不依赖第三方博客平台。文章来自早年的 Gridea 博客，笔记来自 GitHub Issues，现在都收在同一个内容仓库里。</p>
        <p class="about__colophon-links"><a href="https://github.com/ShannonMYang/ShannonMYang.github.io" target="_blank" rel="noopener noreferrer">站点源码</a><span>·</span><a href="${escapeAttr(site.notes?.url || '#')}" target="_blank" rel="noopener noreferrer">笔记 Issues 仓库</a></p>
      </section>
    </div>
  </div>
</main>`;
  return htmlDocument({
    site,
    title: page?.title || '关于',
    description: page?.excerpt || site.description,
    path: '/about/',
    bodyClass: 'page-about',
    body,
  });
}

export function notFoundPage({ site }) {
  const body = `<main id="main" class="notfound">
  <p class="notfound__code">404</p>
  <h1>这一页走丢了</h1>
  <p>可能是链接失效，也可能是内容还没写完。回首页逛逛吧。</p>
  <div class="notfound__actions"><a class="btn btn--primary" href="/">回到首页</a><a class="btn btn--ghost" href="/archives/">查看归档</a></div>
</main>`;
  return htmlDocument({
    site,
    title: '页面不存在',
    description: '页面不存在。',
    path: '/404.html',
    bodyClass: 'page-404',
    body,
  });
}

export function searchIndex(items) {
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    kind: item.kind,
    date: formatDate(item.date),
    tags: item.tags,
    excerpt: item.excerpt,
    text: item.plain.slice(0, 4000),
  }));
}
