/* 土禾灶台 · 写作台（前端） */
(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const state = {
    items: [],
    site: null,
    git: null,
    current: null,
    dirty: false,
    filter: 'all',
    query: '',
    previewPort: 4401,
    previewUrl: '',
    previewSeq: 0,
    building: false,
  };

  const els = {
    list: $('#item-list'),
    listSearch: $('#list-search'),
    foot: $('#sidebar-foot'),
    empty: $('#empty'),
    editor: $('#editor'),
    title: $('#title'),
    slug: $('#slug'),
    date: $('#date'),
    tags: $('#tags'),
    cover: $('#cover'),
    excerpt: $('#excerpt'),
    draft: $('#draft'),
    markdown: $('#markdown'),
    preview: $('#preview'),
    toolbar: $('#toolbar'),
    badge: $('#kind-badge'),
    draftBadge: $('#draft-badge'),
    readonlyBadge: $('#readonly-badge'),
    path: $('#editor-path'),
    noteBanner: $('#note-banner'),
    noteNumber: $('#note-number'),
    noteLink: $('#note-link'),
    wordCount: $('#word-count'),
    saveState: $('#save-state'),
    saveButton: $('#save-item'),
    deleteButton: $('#delete-item'),
    advanced: $('#advanced'),
    panes: $('#panes'),
    tagList: $('#tag-list'),
    gitText: $('#git-text'),
    gitPill: $('#git-pill'),
    workspace: $('#workspace'),
    coverInput: $('#cover-input'),
    imageInput: $('#image-input'),
    publishDialog: $('#publish-dialog'),
    syncDialog: $('#sync-dialog'),
    progressDialog: $('#progress-dialog'),
    toasts: $('#toasts'),
  };

  const themeKey = 'studio-theme';
  const debounce = (fn, wait = 200) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  /* ---------------- api ---------------- */
  async function api(path, options = {}) {
    const config = { ...options, headers: { ...(options.headers || {}) } };
    if (options.body && !config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
    const res = await fetch(path, config);
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok || (data && data.ok === false)) {
      const message = (data && (data.error || data.step)) || `请求失败（HTTP ${res.status}）`;
      throw new Error(message);
    }
    return data;
  }

  /* ---------------- toast ---------------- */
  function toast(message, type = 'ok') {
    const node = document.createElement('div');
    node.className = `toast${type === 'error' ? ' is-error' : ''}`;
    node.innerHTML = `<span class="toast__mark"></span><span>${escapeHtml(message)}</span>`;
    els.toasts.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
      node.style.transition = 'opacity .2s, transform .2s';
      setTimeout(() => node.remove(), 220);
    }, type === 'error' ? 5200 : 2600);
  }

  const openExternal = (url) => {
    if (!url) return false;
    try {
      const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.tuheOpen;
      if (bridge) {
        bridge.postMessage(url);
        return true;
      }
    } catch (_) {
      /* ignore */
    }
    const popup = window.open(url, '_blank');
    if (popup) {
      try {
        popup.opener = null;
      } catch (_) {
        /* ignore */
      }
    }
    return Boolean(popup);
  };

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  /* ---------------- theme ---------------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      /* ignore */
    }
    renderPreview(true);
  }

  /* ---------------- data ---------------- */
  async function loadState() {
    const data = await api('/api/state');
    state.items = data.items;
    state.site = data.site;
    state.git = data.git;
    state.previewPort = data.previewPort;
    state.previewUrl = data.previewUrl;
    $('#sync-repo').textContent = data.site.notesRepo || 'ShannonMYang/MyPersonalBlog';
    renderGit();
    renderList();
    renderFoot(data.counts);
    renderTags();
  }

  async function refreshItems() {
    const data = await api('/api/state');
    state.items = data.items;
    state.git = data.git;
    state.site = data.site;
    renderGit();
    renderList();
    renderFoot(data.counts);
    renderTags();
  }

  function renderGit() {
    if (!state.git) return;
    els.gitPill.classList.toggle('is-dirty', state.git.dirty || state.git.ahead > 0);
    els.gitText.textContent = state.git.dirty
      ? `${state.git.branch} · ${state.git.changes} 处改动${state.git.ahead > 0 ? ` · 领先 ${state.git.ahead}` : ''}`
      : state.git.ahead > 0
        ? `${state.git.branch} · 领先 origin ${state.git.ahead} 个提交`
        : `${state.git.branch} · 工作区干净`;
    els.gitPill.title = state.git.lastCommit || '';
  }

  function filteredItems() {
    const query = state.query.trim().toLowerCase();
    return state.items.filter((item) => {
      if (state.filter === 'draft' && !item.draft) return false;
      if (['post', 'note', 'page'].includes(state.filter) && item.kind !== state.filter) return false;
      if (query) {
        const haystack = `${item.title} ${item.tags.join(' ')} ${item.slug}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function renderList() {
    const items = filteredItems();
    if (!items.length) {
      els.list.innerHTML = `<li class="item__empty">没有匹配的内容</li>`;
      return;
    }
    els.list.innerHTML = items
      .map((item) => {
        const kindLabel = item.kind === 'note' ? 'NOTE' : item.kind === 'page' ? 'PAGE' : 'POST';
        return `<li class="item${state.current && state.current.path === item.path ? ' is-active' : ''}" data-path="${escapeHtml(item.path)}" tabindex="0">
          <span class="item__title">${escapeHtml(item.title)}</span>
          <span class="item__badges">
            <span class="item__kind item__kind--${item.kind}">${kindLabel}</span>
            ${item.draft ? '<span class="item__draft">DRAFT</span>' : ''}
            <span class="item__date">${escapeHtml(item.dateLabel)}</span>
          </span>
        </li>`;
      })
      .join('');
  }

  function renderFoot(counts) {
    if (!counts) return;
    els.foot.textContent = `${counts.posts} 篇文章 · ${counts.notes} 篇笔记 · ${counts.pages} 个页面 · ${counts.drafts} 篇草稿`;
  }

  function renderTags() {
    const tags = [...new Set(state.items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    els.tagList.innerHTML = tags.map((tag) => `<option value="${escapeHtml(tag)}"></option>`).join('');
  }

  /* ---------------- editor ---------------- */
  function setEditorVisible(visible) {
    els.empty.hidden = visible;
    els.editor.hidden = !visible;
  }

  function setDirty(dirty = true) {
    state.dirty = dirty;
    els.saveState.textContent = dirty ? '未保存修改' : '已保存';
    els.saveState.classList.toggle('is-dirty', dirty);
  }

  function updateWordCount() {
    const text = els.markdown.value;
    const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const words = (text.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
    const count = cjk + words;
    els.wordCount.textContent = `${count.toLocaleString('zh-CN')} 字`;
  }

  async function selectItem(path, { force = false } = {}) {
    if (!force && state.dirty && !window.confirm('当前内容还没有保存，确定要离开吗？')) return;
    try {
      const { item } = await api(`/api/item?path=${encodeURIComponent(path)}`);
      state.current = item;
      fillForm(item);
      setEditorVisible(true);
      setDirty(false);
      renderList();
      history.replaceState(null, '', `#path=${encodeURIComponent(item.path)}`);
      if (window.innerWidth <= 860) els.workspace.classList.add('sidebar-collapsed');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function fillForm(item) {
    const readOnly = item.readOnly;
    const kindLabel = item.kind === 'note' ? '笔记' : item.kind === 'page' ? '页面' : '文章';
    els.badge.textContent = kindLabel;
    els.badge.classList.toggle('is-note', item.kind === 'note');
    els.draftBadge.hidden = !item.fields.draft;
    els.readonlyBadge.hidden = !readOnly;
    els.path.textContent = item.path;
    els.noteBanner.hidden = !readOnly;
    if (readOnly) {
      els.noteNumber.textContent = `#${item.fields.issue || ''}`;
      els.noteLink.textContent = `${item.fields.repo || 'GitHub'} #${item.fields.issue || ''}`;
      els.noteLink.href = item.fields.issueUrl || '#';
    }
    els.title.value = item.fields.title;
    els.slug.value = item.fields.slug;
    els.date.value = item.fields.date || '';
    els.tags.value = item.fields.tags.join(', ');
    els.cover.value = item.fields.cover || '';
    els.excerpt.value = item.fields.excerpt || '';
    els.draft.checked = Boolean(item.fields.draft);
    els.markdown.value = item.body;
    els.title.readOnly = readOnly;
    els.slug.readOnly = readOnly;
    els.date.disabled = readOnly;
    els.tags.readOnly = readOnly;
    els.cover.readOnly = readOnly;
    els.excerpt.readOnly = readOnly;
    els.draft.disabled = readOnly;
    els.markdown.readOnly = readOnly;
    els.editor.classList.toggle('is-readonly', readOnly);
    els.saveButton.hidden = readOnly;
    els.deleteButton.hidden = readOnly;
    els.advanced.open = true;
    const coverButton = $('#cover-upload');
    if (coverButton) coverButton.disabled = readOnly;
    updateWordCount();
    renderPreview(true);
    $('#editor-scroll').scrollTop = 0;
  }

  function collectFields() {
    return {
      title: els.title.value,
      slug: els.slug.value,
      date: els.date.value,
      tags: els.tags.value
        .split(/[,，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      cover: els.cover.value,
      excerpt: els.excerpt.value,
      draft: els.draft.checked,
    };
  }

  async function save({ silent = false } = {}) {
    if (!state.current || state.current.readOnly) return false;
    if (!els.title.value.trim()) {
      toast('标题不能为空', 'error');
      els.title.focus();
      return false;
    }
    try {
      els.saveButton.disabled = true;
      const result = await api('/api/item', {
        method: 'PUT',
        body: JSON.stringify({ path: state.current.path, fields: collectFields(), body: els.markdown.value }),
      });
      state.current = result.item;
      els.draftBadge.hidden = !result.item.fields.draft;
      els.path.textContent = result.item.path;
      history.replaceState(null, '', `#path=${encodeURIComponent(result.item.path)}`);
      setDirty(false);
      await refreshItems();
      if (!silent) toast('已保存');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    } finally {
      els.saveButton.disabled = false;
    }
  }

  async function create(kind = 'post') {
    if (state.dirty && !window.confirm('当前内容还没有保存，确定要新建吗？')) return;
    try {
      const result = await api('/api/item', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', kind, title: kind === 'page' ? '未命名页面' : '未命名文章' }),
      });
      await refreshItems();
      await selectItem(result.path, { force: true });
      els.title.focus();
      els.title.select();
      toast(kind === 'page' ? '已新建页面' : '已新建草稿');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function removeCurrent() {
    if (!state.current || state.current.readOnly) return;
    if (!window.confirm(`确定删除《${state.current.fields.title}》吗？文件会移到 .trash/，可以手动找回。`)) return;
    try {
      await api('/api/item', { method: 'DELETE', body: JSON.stringify({ path: state.current.path }) });
      const oldTitle = state.current.fields.title;
      state.current = null;
      setEditorVisible(false);
      setDirty(false);
      history.replaceState(null, '', window.location.pathname);
      await refreshItems();
      toast(`已把《${oldTitle}》移到回收站`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ---------------- preview ---------------- */
  function previewDocument(html) {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    return `<!doctype html><html lang="zh-CN" data-theme="${theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="/theme/site.css">
<style>
html,body{background:var(--paper);}
body{margin:0;padding:30px 34px 70px;}
.prose{max-width:760px;margin:0 auto;}
.prose .prose-img{max-width:100%;}
.prose .article-cover{display:none;}
</style></head><body><div class="prose">${html}</div></body></html>`;
  }

  async function renderPreview(immediate = false) {
    if (!state.current) return;
    const seq = ++state.previewSeq;
    const markdown = els.markdown.value;
    const title = els.title.value;
    const scroll = (() => {
      try {
        return els.preview.contentWindow.scrollY;
      } catch {
        return 0;
      }
    })();
    try {
      const result = await api('/api/preview', { method: 'POST', body: JSON.stringify({ markdown, title }) });
      if (seq !== state.previewSeq) return;
      els.preview.onload = () => {
        try {
          els.preview.contentWindow.scrollTo(0, scroll);
        } catch {
          /* ignore */
        }
      };
      els.preview.srcdoc = previewDocument(result.html);
    } catch (err) {
      /* 预览失败不打断写作 */
      console.warn(err);
    }
  }
  const renderPreviewDebounced = debounce(() => renderPreview(), 260);

  /* ---------------- uploads ---------------- */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error');
      return null;
    }
    const dataUrl = await readFileAsDataURL(file);
    const result = await api('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name || 'image', dataUrl }),
    });
    return result.url;
  }

  function insertText(text, replaceFrom, replaceTo) {
    const textarea = els.markdown;
    const start = replaceFrom ?? textarea.selectionStart;
    const end = replaceTo ?? textarea.selectionEnd;
    textarea.setRangeText(text, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  async function insertImageFile(file) {
    try {
      toast('正在上传图片…');
      const url = await uploadImage(file);
      if (!url) return;
      const alt = file.name ? file.name.replace(/\.[a-z0-9]+$/i, '') : '图片';
      insertText(`\n![${alt}](${url})\n`);
      toast('图片已插入');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function setCoverFile(file) {
    try {
      toast('正在上传封面…');
      const url = await uploadImage(file);
      if (!url) return;
      els.cover.value = url;
      setDirty(true);
      toast('封面已更新');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* ---------------- markdown toolbar ---------------- */
  function linePrefix(prefix) {
    const textarea = els.markdown;
    const value = textarea.value;
    const start = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    let end = value.indexOf('\n', textarea.selectionEnd);
    if (end < 0) end = value.length;
    const block = value.slice(start, end) || '';
    const next = block
      .split('\n')
      .map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
      .join('\n');
    textarea.setRangeText(next, start, end, 'select');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  function wrap(before, after = before, placeholder = '') {
    const textarea = els.markdown;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hadSelection = end > start;
    const selected = hadSelection ? textarea.value.slice(start, end) : placeholder;
    textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    if (!hadSelection) {
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }
  }

  function applyMarkdown(action) {
    const textarea = els.markdown;
    if (textarea.readOnly) return;
    switch (action) {
      case 'h2':
        linePrefix('## ');
        break;
      case 'h3':
        linePrefix('### ');
        break;
      case 'bold':
        wrap('**', '**', '加粗文字');
        break;
      case 'italic':
        wrap('*', '*', '斜体文字');
        break;
      case 'strike':
        wrap('~~', '~~', '删除线');
        break;
      case 'code':
        wrap('`', '`', 'code');
        break;
      case 'quote':
        linePrefix('> ');
        break;
      case 'ul':
        linePrefix('- ');
        break;
      case 'ol':
        linePrefix('1. ');
        break;
      case 'hr':
        insertText('\n\n---\n\n');
        break;
      case 'table':
        insertText('\n\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n\n');
        break;
      case 'link':
        wrap('[', '](https://)', '链接文字');
        break;
      case 'image':
        els.imageInput.click();
        break;
      default:
        break;
    }
  }

  /* ---------------- progress ---------------- */
  let progressDoneCallback = null;

  function showProgress(title, eyebrow = 'WORKING') {
    $('#progress-title').textContent = title;
    $('#progress-eyebrow').textContent = eyebrow;
    $('#progress-log').textContent = '';
    $('#progress-dialog').classList.remove('is-done');
    $('#progress-close').hidden = true;
    $('#progress-done').hidden = true;
    if (!els.progressDialog.open) els.progressDialog.showModal();
  }

  function setProgressLog(text) {
    $('#progress-log').textContent = text;
    $('#progress-log').scrollTop = $('#progress-log').scrollHeight;
  }

  function finishProgress(ok, title) {
    $('#progress-dialog').classList.toggle('is-done', ok);
    $('#progress-title').textContent = title;
    $('#progress-eyebrow').textContent = ok ? 'DONE' : 'FAILED';
    $('#progress-close').hidden = false;
    $('#progress-done').hidden = false;
    if (!ok) toast(title, 'error');
  }

  function closeProgress() {
    if (els.progressDialog.open) els.progressDialog.close();
    progressDoneCallback?.();
    progressDoneCallback = null;
  }

  /* ---------------- dialogs ---------------- */
  function openPublishDialog() {
    if (!state.current) {
      toast('先选择一篇文章', 'error');
      return;
    }
    if (state.current.readOnly) {
      toast('GitHub 笔记是只读的，请到原 Issue 编辑', 'error');
      return;
    }
    const summary = state.git
      ? `分支：${state.git.branch}\n待提交改动：${state.git.changes} 处\n未推送提交：${state.git.ahead || 0} 个\n最近提交：${state.git.lastCommit || '—'}`
      : '读取中…';
    const prefix = state.dirty ? '当前文章有未保存修改，发布前会先保存。\n\n' : '';
    const nothingToDo = state.git && state.git.changes === 0 && !(state.git.ahead > 0);
    $('#publish-summary').textContent = nothingToDo
      ? `${prefix}没有未提交的改动，也没有待推送的提交，站点已是最新。`
      : prefix + summary;
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    $('#commit-message').value = state.current ? `发布：${state.current.fields.title}` : `发布：${stamp}`;
    $('#push-toggle').checked = true;
    els.publishDialog.showModal();
  }

  async function confirmPublish() {
    const message = $('#commit-message').value.trim();
    const push = $('#push-toggle').checked;
    if (state.dirty) {
      const saved = await save({ silent: true });
      if (!saved) return;
    }
    els.publishDialog.close();
    showProgress('正在构建并发布…', 'PUBLISH');
    try {
      const result = await api('/api/publish', { method: 'POST', body: JSON.stringify({ message, push }) });
      setProgressLog(result.log || '完成。');
      finishProgress(true, result.pushed ? '已发布到 GitHub，约 1 分钟后线上生效' : '构建完成（未推送）');
      await refreshItems();
    } catch (err) {
      setProgressLog(err.message);
      finishProgress(false, '发布失败');
    }
  }

  function openSyncDialog() {
    els.syncDialog.showModal();
  }

  async function confirmSync() {
    els.syncDialog.close();
    showProgress('正在同步 GitHub Issues…', 'SYNC');
    try {
      const result = await api('/api/sync', { method: 'POST', body: JSON.stringify({}) });
      setProgressLog(result.log || '完成。');
      finishProgress(true, '同步完成，站点已重新构建');
      await refreshItems();
      if (state.current && !state.current.readOnly) {
        // 当前打开的是本地文章，不强制刷新
      } else if (state.current) {
        const stillExists = state.items.some((item) => item.path === state.current.path);
        if (stillExists) await selectItem(state.current.path, { force: true });
      }
    } catch (err) {
      setProgressLog(err.message);
      finishProgress(false, '同步失败');
    }
  }

  /* ---------------- events ---------------- */
  function bindEvents() {
    $$('[data-action="theme"]').forEach((button) =>
      button.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      }),
    );

    $$('[data-action="toggle-sidebar"]').forEach((button) =>
      button.addEventListener('click', () => els.workspace.classList.toggle('sidebar-collapsed')),
    );

    $$('[data-action="new-post"]').forEach((button) => button.addEventListener('click', () => create('post')));
    $$('[data-action="new-page"]').forEach((button) => button.addEventListener('click', () => create('page')));
    $('[data-action="publish"]').addEventListener('click', openPublishDialog);
    $('[data-action="sync"]').addEventListener('click', openSyncDialog);
    $('[data-action="open-site"]').addEventListener('click', async () => {
      if (!state.previewUrl) {
        toast('站点预览地址还没有就绪，请稍后重试', 'error');
        return;
      }
      if (state.building) return;
      state.building = true;
      try {
        if (state.dirty && state.current && !state.current.readOnly) {
          toast('先保存当前修改…');
          const saved = await save({ silent: true });
          if (!saved) return;
        }
        toast('正在构建本地预览…');
        const result = await api('/api/build', { method: 'POST' });
        if (!result.ok) {
          toast('构建失败，详情见写作台终端输出', 'error');
          return;
        }
        if (state.current && state.current.fields && state.current.fields.draft) {
          toast('已构建；当前文章是草稿，不会出现在站点预览中', 'error');
        }
        if (!openExternal(state.previewUrl)) {
          toast(`浏览器拦截了新窗口。预览地址：${state.previewUrl}`, 'error');
        }
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        state.building = false;
      }
    });

    $('#confirm-publish').addEventListener('click', confirmPublish);
    $('#confirm-sync').addEventListener('click', confirmSync);
    $('#progress-done').addEventListener('click', closeProgress);
    $('#progress-close').addEventListener('click', closeProgress);
    $$('[data-close-dialog]').forEach((button) =>
      button.addEventListener('click', () => button.closest('dialog')?.close()),
    );

    els.list.addEventListener('click', (event) => {
      const item = event.target.closest('.item');
      if (item) selectItem(item.dataset.path);
    });
    els.list.addEventListener('keydown', (event) => {
      const item = event.target.closest('.item');
      if (item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        selectItem(item.dataset.path);
      }
    });

    els.listSearch.addEventListener('input', debounce(() => {
      state.query = els.listSearch.value;
      renderList();
    }, 120));

    $$('#kind-tabs .tab').forEach((tab) =>
      tab.addEventListener('click', () => {
        $$('#kind-tabs .tab').forEach((node) => node.classList.toggle('is-active', node === tab));
        state.filter = tab.dataset.kind;
        renderList();
      }),
    );

    els.saveButton.addEventListener('click', () => save());
    els.deleteButton.addEventListener('click', removeCurrent);

    [els.title, els.slug, els.date, els.tags, els.cover, els.excerpt].forEach((input) =>
      input.addEventListener('input', () => setDirty(true)),
    );
    els.draft.addEventListener('change', () => setDirty(true));
    els.title.addEventListener('input', () => {
      els.draftBadge.hidden = !els.draft.checked;
    });

    els.markdown.addEventListener('input', () => {
      if (!state.current || state.current.readOnly) return;
      setDirty(true);
      updateWordCount();
      renderPreviewDebounced();
    });
    els.title.addEventListener('input', renderPreviewDebounced);

    $$('#toolbar [data-md]').forEach((button) =>
      button.addEventListener('click', () => applyMarkdown(button.dataset.md)),
    );

    $$('.view-btn').forEach((button) =>
      button.addEventListener('click', () => {
        $$('.view-btn').forEach((node) => node.classList.toggle('is-active', node === button));
        els.panes.className = `panes view-${button.dataset.view}`;
      }),
    );

    els.coverUpload?.addEventListener('click', () => els.coverInput.click());
    $('#cover-upload').addEventListener('click', () => els.coverInput.click());
    els.coverInput.addEventListener('change', () => {
      const file = els.coverInput.files?.[0];
      if (file) setCoverFile(file);
      els.coverInput.value = '';
    });
    els.imageInput.addEventListener('change', () => {
      const file = els.imageInput.files?.[0];
      if (file) insertImageFile(file);
      els.imageInput.value = '';
    });

    els.markdown.addEventListener('paste', (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      const image = items.find((item) => item.type.startsWith('image/'));
      if (image) {
        event.preventDefault();
        const file = image.getAsFile();
        if (file) insertImageFile(file);
      }
    });

    els.markdown.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
    });
    els.markdown.addEventListener('drop', (event) => {
      const file = Array.from(event.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
      if (file) {
        event.preventDefault();
        insertImageFile(file);
      }
    });

    document.addEventListener('keydown', (event) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (state.current && !state.current.readOnly) save();
      } else if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        create('post');
      } else if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        els.listSearch.focus();
        els.listSearch.select();
      } else if (meta && event.key.toLowerCase() === 'b' && document.activeElement === els.markdown) {
        event.preventDefault();
        applyMarkdown('bold');
      } else if (meta && event.key.toLowerCase() === 'i' && document.activeElement === els.markdown) {
        event.preventDefault();
        applyMarkdown('italic');
      }
    });

    window.addEventListener('beforeunload', (event) => {
      if (state.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    const savedTheme = localStorage.getItem(themeKey);
    applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
    bindEvents();
    if (window.innerWidth <= 860) els.workspace.classList.add('sidebar-collapsed');
    try {
      await loadState();
      const match = window.location.hash.match(/^#path=(.+)$/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        if (state.items.some((item) => item.path === path)) {
          await selectItem(path, { force: true });
          return;
        }
      }
      const editable =
        state.items.find((item) => item.kind === 'post' && !item.draft) ||
        state.items.find((item) => item.kind === 'post') ||
        state.items.find((item) => item.slug === 'about');
      if (editable) await selectItem(editable.path, { force: true });
    } catch (err) {
      toast(`写作台启动失败：${err.message}`, 'error');
      els.foot.textContent = '无法连接本地服务';
    }
  }

  boot();
})();
