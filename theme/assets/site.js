/* 木鱼小店 · 交互脚本（无依赖） */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => Array.from(scope.querySelectorAll(selector));

  const debounce = (fn, wait = 120) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const raf = (fn) => {
    let queued = false;
    return (...args) => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fn(...args);
      });
    };
  };

  /* ---------------- Theme ---------------- */
  const themeButton = $('[data-toggle-theme]');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch (_) {
      /* ignore */
    }
    const meta = $('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#15120e' : '#f4efe6');
  };
  themeButton?.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- Header / menu / back-to-top ---------------- */
  const header = $('#site-header');
  const menuButton = $('[data-toggle-menu]');
  const toTop = $('[data-to-top]');
  const filters = $('#filters');
  const headerHeight = () => header?.offsetHeight || 68;

  menuButton?.addEventListener('click', () => {
    const open = header.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  doc.addEventListener('click', (event) => {
    if (header?.classList.contains('is-open') && !header.contains(event.target)) {
      header.classList.remove('is-open');
      menuButton?.setAttribute('aria-expanded', 'false');
    }
  });

  const onScroll = raf(() => {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 6);
    toTop?.classList.toggle('is-visible', y > 800);
    if (filters) {
      const top = filters.getBoundingClientRect().top;
      filters.classList.toggle('is-stuck', top <= headerHeight() + 2 && y > 200);
    }
    const progress = $('#reading-progress');
    if (progress) {
      const max = doc.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progress.style.transform = `scaleX(${value})`;
    }
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------- Search modal ---------------- */
  const modal = $('#search-modal');
  const searchInput = $('#search-input');
  const searchResults = $('#search-results');
  let searchData = null;
  let searchLoading = null;
  let activeIndex = -1;
  let lastFocused = null;

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlight = (text, query) => {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegExp)
      .filter(Boolean);
    if (!tokens.length) return safe;
    return safe.replace(new RegExp(`(${tokens.join('|')})`, 'gi'), '<mark>$1</mark>');
  };

  const loadSearchIndex = () => {
    if (searchData) return Promise.resolve(searchData);
    if (searchLoading) return searchLoading;
    searchResults.innerHTML = '<p class="search-empty">正在载入索引…</p>';
    searchLoading = fetch('/search-index.json', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        searchData = data;
        return data;
      })
      .finally(() => {
        searchLoading = null;
      });
    return searchLoading;
  };

  const renderSearchRows = (rows, query, emptyText) => {
    activeIndex = -1;
    if (!rows.length) {
      searchResults.innerHTML = `<p class="search-empty">${escapeHtml(emptyText)}</p>`;
      return;
    }
    searchResults.innerHTML = rows
      .map(
        (item) => `<a class="search-result" href="${item.url}">
          <span class="search-result__kind">${item.kind === 'note' ? '笔记' : '文章'}</span>
          <span class="search-result__title">${highlight(item.title, query)}</span>
          <span class="search-result__meta">${item.date}</span>
        </a>`,
      )
      .join('');
  };

  const search = (query) => {
    if (!searchData) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      renderSearchRows(searchData.slice(0, 8), '', '输入关键词，搜索全部文章与笔记。');
      return;
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const item of searchData) {
      const title = item.title.toLowerCase();
      const tags = item.tags.join(' ').toLowerCase();
      const body = `${item.excerpt} ${item.text}`.toLowerCase();
      let score = 0;
      if (title === q) score += 120;
      if (title.startsWith(q)) score += 50;
      if (title.includes(q)) score += 28;
      for (const token of tokens) {
        if (title.includes(token)) score += 14;
        if (tags.includes(token)) score += 7;
        if (item.excerpt.toLowerCase().includes(token)) score += 4;
        if (body.includes(token)) score += 1.5;
      }
      if (score > 0) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score || b.item.url.localeCompare(a.item.url));
    renderSearchRows(
      scored.slice(0, 12).map((entry) => entry.item),
      query,
      `没有找到与「${query.trim()}」相关的内容`,
    );
  };

  const openSearch = () => {
    if (!modal) return;
    lastFocused = doc.activeElement;
    modal.hidden = false;
    doc.body.style.overflow = 'hidden';
    loadSearchIndex()
      .then(() => {
        search(searchInput.value);
        searchInput.focus();
        searchInput.select();
      })
      .catch(() => {
        searchResults.innerHTML = '<p class="search-empty">搜索索引载入失败，请刷新页面重试。</p>';
      });
  };

  const closeSearch = () => {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    doc.body.style.overflow = '';
    lastFocused?.focus?.();
  };

  $$('[data-open-search]').forEach((button) => button.addEventListener('click', openSearch));
  $$('[data-close-search]').forEach((button) => button.addEventListener('click', closeSearch));

  searchInput?.addEventListener(
    'input',
    debounce(() => search(searchInput.value), 90),
  );

  searchInput?.addEventListener('keydown', (event) => {
    const rows = $$('.search-result', searchResults);
    if (event.key === 'ArrowDown' && rows.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % rows.length;
      rows.forEach((row, i) => row.classList.toggle('is-active', i === activeIndex));
      rows[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp' && rows.length) {
      event.preventDefault();
      activeIndex = activeIndex <= 0 ? rows.length - 1 : activeIndex - 1;
      rows.forEach((row, i) => row.classList.toggle('is-active', i === activeIndex));
      rows[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      const target = rows[activeIndex] || rows[0];
      if (target) {
        event.preventDefault();
        window.location.href = target.getAttribute('href');
      }
    }
  });

  doc.addEventListener('keydown', (event) => {
    const isInput =
      event.target instanceof HTMLElement &&
      (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === '/' && !isInput) {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === 'Escape') {
      if (!modal?.hidden) {
        event.preventDefault();
        closeSearch();
      } else if (header?.classList.contains('is-open')) {
        header.classList.remove('is-open');
        menuButton?.setAttribute('aria-expanded', 'false');
      }
    }
    if (event.key === 'Tab' && modal && !modal.hidden) {
      const focusables = $$('a[href], button, input', modal).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------------- Masonry ---------------- */
  class Masonry {
    constructor(container) {
      this.container = container;
      this.cards = $$('.card', container).filter((card) => card.closest('[data-masonry]') === container);
      if (!('IntersectionObserver' in window)) {
        this.cards.forEach((card) => card.classList.add('is-in'));
      }
      this.cols = 5;
      this.gap = 22;
      this.layout = this.layout.bind(this);
      this.observer = 'IntersectionObserver' in window ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              this.observer.unobserve(entry.target);
            }
          }
        },
        { rootMargin: '80px 0px -40px 0px', threshold: 0.01 },
      ) : { observe() {}, unobserve() {}, disconnect() {} };
      this.cards.forEach((card) => this.observer.observe(card));
      this.layout();
      window.addEventListener('resize', debounce(this.layout, 140));
      if (doc.fonts?.ready) doc.fonts.ready.then(() => this.layout());
    }

    visibleCards() {
      return this.cards.filter((card) => !card.classList.contains('is-hidden'));
    }

    layout() {
      const cards = this.visibleCards();
      const container = this.container;
      if (!cards.length) {
        container.classList.add('is-masonry', 'is-laid-out');
        container.style.height = '0px';
        return;
      }
      const styles = getComputedStyle(container);
      const cols = Math.max(1, parseInt(styles.getPropertyValue('--cols'), 10) || 5);
      const gap = parseFloat(styles.columnGap) || 22;
      const width = container.clientWidth;
      if (!width) return;
      const columnWidth = (width - gap * (cols - 1)) / cols;

      container.classList.add('is-masonry');
      container.classList.remove('is-laid-out');
      cards.forEach((card) => {
        card.style.width = `${columnWidth}px`;
      });

      const heights = new Array(cols).fill(0);
      for (const card of cards) {
        const height = card.offsetHeight;
        let column = 0;
        for (let i = 1; i < cols; i += 1) {
          if (heights[i] < heights[column] - 0.5) column = i;
        }
        card.style.left = `${column * (columnWidth + gap)}px`;
        card.style.top = `${heights[column]}px`;
        heights[column] += height + gap;
      }
      const maxHeight = Math.max(...heights);
      container.style.height = `${Math.max(0, maxHeight - gap)}px`;
      container.classList.add('is-laid-out');
      this.observer.disconnect();
      cards.forEach((card) => this.observer.observe(card));
    }
  }

  const grid = $('[data-masonry]');
  const masonries = $$('[data-masonry]').map((container) => new Masonry(container));

  /* ---------------- Grid filtering ---------------- */
  const filterState = { type: 'all', tag: '', q: '' };
  let filtersInitialized = false;
  const status = $('#filters-status');
  const clearButtons = $$('[data-clear-filters]');
  const emptyState = $('#empty-state');
  const gridSearch = $('#grid-search');

  const readParams = () => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'post' || type === 'note') filterState.type = type;
    filterState.tag = (params.get('tag') || '').toLowerCase();
    filterState.q = params.get('q') || '';
    if (gridSearch) gridSearch.value = filterState.q;
  };

  const writeParams = () => {
    if (!grid) return;
    const params = new URLSearchParams();
    if (filterState.type !== 'all') params.set('type', filterState.type);
    if (filterState.tag) params.set('tag', filterState.tag);
    if (filterState.q) params.set('q', filterState.q);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${grid ? '#all' : ''}`;
    history.replaceState(null, '', url);
  };

  const applyFilters = ({ updateUrl = true, scroll = false } = {}) => {
    if (!grid) return;
    const q = filterState.q.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    let visible = 0;
    for (const card of $$('.card', grid)) {
      const kindMatch = filterState.type === 'all' || card.dataset.kind === filterState.type;
      const tags = (card.dataset.tags || '').split('|');
      const tagMatch = !filterState.tag || tags.includes(filterState.tag);
      let textMatch = true;
      if (tokens.length) {
        const haystack = (card.dataset.search || '').toLowerCase();
        textMatch = tokens.every((token) => haystack.includes(token));
      }
      const match = kindMatch && tagMatch && textMatch;
      card.classList.toggle('is-hidden', !match);
      if (match) {
        visible += 1;
        if (filtersInitialized) card.classList.add('is-in');
      }
    }

    $$('.segmented__btn').forEach((button) => {
      const active = button.dataset.type === filterState.type;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('.chip[data-tag]').forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.tag === filterState.tag);
    });
    clearButtons.forEach((button) => {
      button.hidden = filterState.type === 'all' && !filterState.tag && !filterState.q;
    });
    if (emptyState) emptyState.hidden = visible > 0;
    if (status) {
      const parts = [`显示 ${visible} / ${$$('.card', grid).length} 篇`];
      if (filterState.type !== 'all') parts.push(filterState.type === 'note' ? '仅笔记' : '仅文章');
      if (filterState.tag) {
        const chip = $(`.chip[data-tag="${CSS.escape(filterState.tag)}"]`);
        parts.push(`标签「${chip ? chip.textContent.replace(/\d+$/, '').trim() : filterState.tag}」`);
      }
      if (filterState.q) parts.push(`关键词「${filterState.q}」`);
      status.textContent = parts.join(' · ');
    }
    filtersInitialized = true;
    masoHelper.layout();
    if (updateUrl) writeParams();
    if (scroll) $('#all')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 便于过滤后统一重排（也兼容标签页的独立瀑布流）
  const masoHelper = {
    layout() {
      masonries.forEach((masonry) => masonry.layout());
    },
  };

  $$('.segmented__btn').forEach((button) => {
    button.addEventListener('click', () => {
      filterState.type = button.dataset.type || 'all';
      applyFilters();
    });
  });

  $$('.chip[data-tag]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      filterState.tag = filterState.tag === tag ? '' : tag;
      applyFilters();
    });
  });

  clearButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterState.type = 'all';
      filterState.tag = '';
      filterState.q = '';
      if (gridSearch) gridSearch.value = '';
      applyFilters();
    });
  });

  gridSearch?.addEventListener(
    'input',
    debounce(() => {
      filterState.q = gridSearch.value;
      applyFilters();
    }, 160),
  );

  if (grid) {
    readParams();
    applyFilters({ updateUrl: false });
  }

  /* ---------------- TOC active state ---------------- */
  const tocLinks = $$('.toc__item a');
  if (tocLinks.length) {
    const map = new Map(tocLinks.map((link) => [decodeURIComponent(link.getAttribute('href').slice(1)), link]));
    const headings = $$('.prose .prose-h').filter((heading) => heading.id && map.has(heading.id));
    if (headings.length) {
      const visible = new Set();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id);
            else visible.delete(entry.target.id);
          }
          let current = '';
          for (const heading of headings) {
            if (visible.has(heading.id)) {
              current = heading.id;
              break;
            }
          }
          if (!current) {
            const passed = headings.filter((heading) => heading.getBoundingClientRect().top < headerHeight() + 80);
            current = passed.length ? passed[passed.length - 1].id : '';
          }
          tocLinks.forEach((link) => {
            link.classList.toggle('is-active', decodeURIComponent(link.getAttribute('href').slice(1)) === current);
          });
        },
        { rootMargin: `-${headerHeight() + 40}px 0px -65% 0px`, threshold: [0, 1] },
      );
      headings.forEach((heading) => observer.observe(heading));
    }
  }

  /* ---------------- Code copy ---------------- */
  doc.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-code]');
    if (!button) return;
    const block = button.closest('.code-block');
    const code = block?.querySelector('code');
    if (!code) return;
    const text = code.textContent;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = doc.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        doc.body.appendChild(textarea);
        textarea.select();
        doc.execCommand('copy');
        textarea.remove();
      }
      button.textContent = '已复制';
      button.classList.add('is-copied');
      setTimeout(() => {
        button.textContent = '复制';
        button.classList.remove('is-copied');
      }, 1600);
    } catch (_) {
      button.textContent = '复制失败';
    }
  });

  /* ---------------- Image lightbox ---------------- */
  let lightbox = null;
  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.remove();
    lightbox = null;
    doc.body.style.overflow = '';
  };

  doc.addEventListener('click', (event) => {
    const image = event.target.closest('img.prose-img');
    if (!image) {
      if (lightbox && event.target === lightbox) closeLightbox();
      return;
    }
    event.preventDefault();
    const overlay = doc.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '查看大图');
    const big = doc.createElement('img');
    big.src = image.currentSrc || image.src;
    big.alt = image.alt || '';
    overlay.appendChild(big);
    overlay.addEventListener('click', closeLightbox);
    doc.body.appendChild(overlay);
    doc.body.style.overflow = 'hidden';
    lightbox = overlay;
  });

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox) closeLightbox();
  });

  /* ---------------- Broken images fallback ---------------- */
  $$('.prose .prose-img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const fallback = doc.createElement('div');
        fallback.className = 'img-missing';
        fallback.innerHTML = `<span>图片已失效</span><small>${escapeHtml(img.getAttribute('alt') || '原图床链接已不可用')}</small>`;
        const figure = img.closest('.prose-figure');
        if (figure) figure.replaceWith(fallback);
        else img.replaceWith(fallback);
      },
      { once: true },
    );
  });

  /* ---------------- Broken covers fallback ---------------- */
  $$('.card__media--image img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const card = img.closest('.card');
        card?.classList.add('is-broken');
      },
      { once: true },
    );
  });
})();
