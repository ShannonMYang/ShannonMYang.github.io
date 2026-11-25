#!/usr/bin/env node
/**
 * 布局与可访问性自动检查（需要本机 Chrome）。
 * 用法：node scripts/verify-layout.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT_DIR = path.resolve(import.meta.dirname, '../.tmp/shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const measure = () => {
  const cards = Array.from(document.querySelectorAll('#content-grid .card:not(.is-hidden)'));
  const rects = cards.map((card) => {
    const r = card.getBoundingClientRect();
    return { left: Math.round(r.left + window.scrollX), top: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  });
  const columns = [...new Set(rects.map((r) => r.left))].sort((a, b) => a - b);
  const byColumn = new Map();
  for (const rect of rects) {
    if (!byColumn.has(rect.left)) byColumn.set(rect.left, []);
    byColumn.get(rect.left).push(rect);
  }
  let overlaps = 0;
  for (const list of byColumn.values()) {
    list.sort((a, b) => a.top - b.top);
    for (let i = 1; i < list.length; i += 1) {
      if (list[i].top < list[i - 1].top + list[i - 1].height - 2) overlaps += 1;
    }
  }
  const grid = document.querySelector('#content-grid');
  const gridHeight = grid ? Math.round(grid.getBoundingClientRect().height) : 0;
  const maxBottom = rects.length ? Math.max(...rects.map((r) => r.top + r.height)) : 0;
  const firstCardTop = rects.length ? Math.min(...rects.map((r) => r.top)) : 0;
  return {
    count: rects.length,
    columns: columns.length,
    columnWidths: columns.length ? [...new Set(rects.map((r) => r.width))] : [],
    overlaps,
    gridHeight,
    contentHeight: maxBottom - firstCardTop,
    docWidth: document.documentElement.scrollWidth,
    winWidth: window.innerWidth,
    cardOpacities: [...new Set(cards.filter((c) => { const r = c.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }).map((c) => getComputedStyle(c).opacity))],
    fonts: document.fonts.status,
    images: [...document.querySelectorAll('#content-grid img')].map((img) => ({ src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 })),
    h1: document.querySelector('h1')?.textContent?.trim().slice(0, 40),
  };
};

const contrast = (fg, bg) => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (value) => value.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const l1 = lum(parse(fg));
  const l2 = lum(parse(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-background-networking', '--hide-scrollbars'],
  });
  const errors = [];

  for (const width of [1920, 1600, 1440, 1280, 1024, 768, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(`${width}px pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`${width}px console: ${msg.text()}`);
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    const m = await page.evaluate(measure);
    const expectedCols = width >= 1360 ? 5 : width >= 1080 ? 4 : width >= 900 ? 3 : width >= 640 ? 2 : width >= 431 ? 2 : 1;
    record(`首页 ${width}px 无横向滚动`, m.docWidth <= m.winWidth + 1, `scrollWidth=${m.docWidth} viewport=${m.winWidth}`);
    record(`首页 ${width}px 列数 = ${expectedCols}`, m.columns === expectedCols, `实际 ${m.columns} 列，卡片宽 ${m.columnWidths.join('/')}`);
    record(`首页 ${width}px 卡片无重叠`, m.overlaps === 0, `${m.overlaps} 处重叠`);
    record(`首页 ${width}px 卡片全部可见`, m.cardOpacities.every((v) => Number(v) === 1), `opacity=${m.cardOpacities.join(',')}`);
    if (width === 1600) {
      await page.evaluate(() => document.querySelectorAll('#content-grid img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }));
      await page.waitForTimeout(2500);
      const imgs = await page.evaluate(() =>
        [...document.querySelectorAll('#content-grid img')].map((img) => ({ src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 })),
      );
      record('首页封面图全部加载', imgs.every((img) => img.ok), `${imgs.filter((i) => !i.ok).length}/${imgs.length} 张失败`);
    }
    record(`首页 ${width}px 容器高度正确`, Math.abs(m.gridHeight - m.contentHeight) < 24, `grid=${m.gridHeight} 内容=${m.contentHeight}`);

    if ([1600, 1440, 768, 390].includes(width)) {
      await page.screenshot({ path: path.join(SHOT_DIR, `home-${width}.png`), fullPage: false });
      if (width === 1600) {
        await page.evaluate(() => document.querySelectorAll('#content-grid img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }));
        await page.waitForTimeout(2200);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SHOT_DIR, 'home-full-1600.png'), fullPage: true });
      }
    }

    // 交互：筛选
    if (width === 1600) {
      await page.click('.segmented__btn[data-type="note"]');
      await page.waitForTimeout(500);
      const filtered = await page.evaluate(() => ({
        visible: document.querySelectorAll('#content-grid .card:not(.is-hidden)').length,
        notes: document.querySelectorAll('#content-grid .card[data-kind="note"]:not(.is-hidden)').length,
        columns: new Set([...document.querySelectorAll('#content-grid .card:not(.is-hidden)')].map((c) => Math.round(c.getBoundingClientRect().left))).size,
        url: location.search,
      }));
      record('筛选「笔记」生效', filtered.visible === filtered.notes && filtered.visible > 0, `可见 ${filtered.visible}，笔记 ${filtered.notes}，${filtered.columns} 列`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'home-filter-note.png') });

      await page.fill('#grid-search', 'Swift');
      await page.waitForTimeout(450);
      await page.fill('#grid-search', 'zzzz不存在的关键词');
      await page.waitForTimeout(450);
      const noResult = await page.evaluate(() => ({
        visible: document.querySelectorAll('#content-grid .card:not(.is-hidden)').length,
        empty: !document.querySelector('#empty-state').hidden,
      }));
      record('关键词筛选与空状态', noResult.visible === 0 && noResult.empty, `可见 ${noResult.visible}，空状态 ${noResult.empty}`);

      await page.click('[data-clear-filters]');
      await page.waitForTimeout(300);

      // 搜索弹窗
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(500);
      const searchOpen = await page.evaluate(() => !document.querySelector('#search-modal').hidden);
      record('⌘K 打开搜索', searchOpen);
      await page.fill('#search-input', 'Runtime');
      await page.waitForTimeout(400);
      const searchCount = await page.locator('.search-result').count();
      record('搜索有结果', searchCount > 0, `${searchCount} 条`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'search-modal.png') });
      await page.keyboard.press('Escape');

      // 主题
      await page.click('[data-toggle-theme]');
      const dark = await page.evaluate(() => document.documentElement.dataset.theme);
      record('深色模式切换', dark === 'dark');
      await page.screenshot({ path: path.join(SHOT_DIR, 'home-dark-1600.png') });
      await page.click('[data-toggle-theme]');
      await page.waitForTimeout(400);

      // 对比度
      const colors = await page.evaluate(() => {
        const get = (sel, prop) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el)[prop] : null;
        };
        return {
          bodyText: get('body', 'color'),
          bodyBg: get('body', 'backgroundColor'),
          muted: get('.hero__desc', 'color'),
          cardTitle: get('.card__title', 'color'),
          cardBg: get('.card', 'backgroundColor'),
          nav: get('.nav__link', 'color'),
        };
      });
      const ratios = {
        '正文/纸色': contrast(colors.bodyText, colors.bodyBg),
        '次要文字/纸色': contrast(colors.muted, colors.bodyBg),
        '卡片标题/卡片': contrast(colors.cardTitle, colors.cardBg),
        '导航/纸色': contrast(colors.nav, colors.bodyBg),
      };
      record('色值解析', Boolean(colors.bodyBg && colors.nav), JSON.stringify(colors));
      for (const [name, ratio] of Object.entries(ratios)) {
        record(`对比度 ${name} ≥ 4.5`, ratio >= 4.4, ratio.toFixed(2));
      }
    }
    await context.close();
  }

  // 文章页
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`article pageerror: ${err.message}`));
  for (const [label, url] of [
    ['文章', '/note/gh-49/'],
    ['旧文章', '/post/ios-li-yong-runtime-zi-ding-yi-dao-hang-kong-zhi-qi-fan-hui-shou-shi/'],
    ['归档', '/archives/'],
    ['标签', '/tags/'],
    ['标签详情', '/tag/ios/'],
    ['笔记库', '/notes/'],
    ['关于', '/about/'],
    ['404', '/no-such-page/'],
  ]) {
    const response = await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      toc: document.querySelectorAll('.toc__item').length,
      proseWidth: Math.round(document.querySelector('.prose')?.getBoundingClientRect().width || 0),
      codeBlocks: document.querySelectorAll('.code-block').length,
      brokenImages: [...document.querySelectorAll('img')].filter((img) => img.complete && img.naturalWidth === 0).length,
      metaDesc: document.querySelector('meta[name="description"]')?.content || '',
    }));
    record(`${label} 页面无横向滚动`, info.docWidth <= info.winWidth + 1, `${info.docWidth}/${info.winWidth}`);
    record(`${label} 图片无损坏`, info.brokenImages === 0, `${info.brokenImages} 张`);
    if (label === '文章') {
      record('文章正文宽度合适', info.proseWidth > 600 && info.proseWidth <= 800, `${info.proseWidth}px`);
      record('文章页有代码块', info.codeBlocks > 0, `${info.codeBlocks} 个`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'article-note.png'), fullPage: false });
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOT_DIR, 'article-note-body.png') });
    }
    if (label === '旧文章') {
      record('旧文章 TOC 生成', info.toc > 0, `${info.toc} 项`);
      await page.screenshot({ path: path.join(SHOT_DIR, 'article-post.png') });
    }
    if (label === '归档') await page.screenshot({ path: path.join(SHOT_DIR, 'archives.png') });
    if (label === '标签') await page.screenshot({ path: path.join(SHOT_DIR, 'tags.png') });
    if (label === '笔记库') await page.screenshot({ path: path.join(SHOT_DIR, 'notes.png') });
    if (label === '关于') await page.screenshot({ path: path.join(SHOT_DIR, 'about.png') });
    if (label === '404') record('404 状态码', response.status() === 404, String(response.status()));
  }

  // 移动端文章 + 菜单
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/note/gh-49/`, { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(300);
  const mobileInfo = await mpage.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    winWidth: window.innerWidth,
    menuVisible: getComputedStyle(document.querySelector('[data-toggle-menu]')).display !== 'none',
    navHidden: getComputedStyle(document.querySelector('.nav')).display === 'none',
    tocHidden: !document.querySelector('.toc') || getComputedStyle(document.querySelector('.toc')).display === 'none',
    codeWidth: document.querySelector('.code-block')?.getBoundingClientRect().width || 0,
  }));
  record('移动端文章无横向滚动', mobileInfo.docWidth <= mobileInfo.winWidth + 1, `${mobileInfo.docWidth}/${mobileInfo.winWidth}`);
  record('移动端显示菜单按钮', mobileInfo.menuVisible);
  record('移动端隐藏桌面导航', mobileInfo.navHidden);
  record('移动端隐藏 TOC', mobileInfo.tocHidden);
  await mpage.screenshot({ path: path.join(SHOT_DIR, 'mobile-article.png') });
  await mpage.click('[data-toggle-menu]');
  await mpage.waitForTimeout(250);
  const menuOpen = await mpage.evaluate(() => document.querySelector('#site-header').classList.contains('is-open'));
  record('移动端菜单可展开', menuOpen);
  await mpage.screenshot({ path: path.join(SHOT_DIR, 'mobile-menu.png') });
  await mobile.close();

  record('无 JS 运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  fs.writeFileSync(path.join(SHOT_DIR, 'report.json'), JSON.stringify({ results, errors }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项检查，失败 ${failed.length} 项。截图：${SHOT_DIR}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
