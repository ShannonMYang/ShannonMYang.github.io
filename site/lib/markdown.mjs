import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';
import katex from 'katex';
import { escapeHtml, stripMarkdown } from './util.mjs';

const SITE_ORIGIN = 'https://shannonmyang.github.io';

const LANG_MAP = {
  'objective-c': 'objectivec',
  objc: 'objectivec',
  oc: 'objectivec',
  'objectivec': 'objectivec',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  js: 'javascript',
  ts: 'typescript',
  md: 'markdown',
  yml: 'yaml',
  vue: 'xml',
  html: 'xml',
  'c++': 'cpp',
  golang: 'go',
  py: 'python',
  rb: 'ruby',
};

const LANG_LABEL = {
  objectivec: 'Objective-C',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  bash: 'Shell',
  cpp: 'C++',
  c: 'C',
  json: 'JSON',
  html: 'HTML',
  xml: 'XML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  swift: 'Swift',
  python: 'Python',
  go: 'Go',
  java: 'Java',
  sql: 'SQL',
  yaml: 'YAML',
  markdown: 'Markdown',
  text: 'TEXT',
  code: 'CODE',
};

function normalizeLang(raw) {
  const lang = String(raw || '').trim().toLowerCase();
  if (!lang) return '';
  return LANG_MAP[lang] || lang;
}

function isSafeLang(lang) {
  return Boolean(lang) && /^[a-z0-9+#-]+$/.test(lang) && hljs.getLanguage(lang);
}

function normalizeSrc(src = '') {
  let value = String(src).trim();
  if (value.startsWith(SITE_ORIGIN)) value = value.slice(SITE_ORIGIN.length) || '/';
  return value;
}

/** 把 heading 文本转成稳定的锚点 id（保留中文，便于分享） */
export function headingId(text, seen) {
  let base = String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) base = 'section';
  let id = base;
  let n = seen.get(base) || 0;
  while (seen.has(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  seen.set(base, n);
  return id;
}

function mapHeadingLevel(tag) {
  const level = Number(tag.replace('h', '')) || 2;
  if (level <= 2) return 2;
  if (level === 3) return 2;
  if (level === 4) return 3;
  return 4;
}

function sanitize(html) {
  return html
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, ' $1="#"');
}

function createRenderer() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  });
  md.use(footnote);
  md.use(taskLists, { enabled: false, label: true });

  // ---- 数学公式：$$ 块级 + 行内 $...$（保守匹配，避免误伤金额） ----
  md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
    if (state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') return false;
    const start = state.pos + 1;
    let end = -1;
    for (let i = start; i < state.src.length; i += 1) {
      if (state.src[i] === '\\') {
        i += 1;
        continue;
      }
      if (state.src[i] === '$') {
        end = i;
        break;
      }
      if (state.src[i] === '\n' && i - start > 120) break;
    }
    if (end < 0 || end === start) return false;
    const content = state.src.slice(start, end);
    if (/^\s|\s$/.test(content) || content.length > 200) return false;
    if (!/[\\^_{}=]/.test(content)) return false;
    const token = state.push('math_inline', 'math', 0);
    token.content = content;
    state.pos = end + 1;
    return true;
  });

  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    if (start + 2 > max) return false;
    if (state.src.slice(start, start + 2) !== '$$') return false;
    let nextLine = startLine;
    let content = '';
    const first = state.src.slice(start + 2, max).trim();
    if (first.endsWith('$$') && first.length > 2) {
      content = first.slice(0, -2);
      nextLine = startLine + 1;
    } else {
      if (first) content += first;
      nextLine = startLine + 1;
      let closed = false;
      for (; nextLine < endLine; nextLine += 1) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const lineMax = state.eMarks[nextLine];
        const line = state.src.slice(lineStart, lineMax);
        if (line.trim() === '$$' || line.trim().endsWith('$$')) {
          content += `\n${line.replace(/\$\$\s*$/, '')}`;
          closed = true;
          nextLine += 1;
          break;
        }
        content += `\n${line}`;
      }
      if (!closed) return false;
    }
    if (silent) return true;
    const token = state.push('math_block', 'math', 0);
    token.block = true;
    token.content = content.trim();
    token.map = [startLine, nextLine];
    state.line = nextLine;
    return true;
  });

  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: false });
    } catch {
      return escapeHtml(`$${tokens[idx].content}$`);
    }
  };
  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return `<div class="math-block">${katex.renderToString(tokens[idx].content, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<pre class="math-fallback">${escapeHtml(tokens[idx].content)}</pre>`;
    }
  };

  // ---- 标题：统一层级、生成 id、收集目录 ----
  md.renderer.rules.heading_open = (tokens, idx, options, env) => {
    const token = tokens[idx];
    const level = mapHeadingLevel(token.tag);
    token.tag = `h${level}`;
    const inline = tokens[idx + 1];
    const raw = inline?.content || '';
    const id = headingId(stripMarkdown(raw), env.headingIds);
    token.attrSet('id', id);
    if (level <= 3 && env.toc) {
      env.toc.push({ level, title: stripMarkdown(raw), id });
    }
    return `<h${level} id="${id}" class="prose-h prose-h${level}"><a class="h-anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>`;
  };
  md.renderer.rules.heading_close = (tokens, idx) => {
    const level = mapHeadingLevel(tokens[idx].tag);
    tokens[idx].tag = `h${level}`;
    return `</h${level}>`;
  };

  // ---- 代码块 ----
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || '').trim().split(/\s+/)[0];
    const lang = normalizeLang(info);
    const code = token.content;
    let html;
    let label;
    if (isSafeLang(lang)) {
      html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      label = LANG_LABEL[lang] || lang;
    } else {
      // 未标注或未知语言：自动识别，失败则纯文本
      try {
        const auto = hljs.highlightAuto(code);
        if (auto.relevance >= 5 && auto.language) {
          html = auto.value;
          label = `${LANG_LABEL[auto.language] || auto.language} · 推断`;
        } else {
          throw new Error('low relevance');
        }
      } catch {
        html = escapeHtml(code);
        label = 'CODE';
      }
    }
    return `<figure class="code-block"><figcaption class="code-block__bar"><span class="code-block__lang">${escapeHtml(label)}</span><button class="code-block__copy" type="button" data-copy-code>复制</button></figcaption><pre class="code-block__pre" tabindex="0"><code class="hljs">${html}</code></pre></figure>`;
  };

  // ---- 图片：懒加载 + 原站地址本地化 ----
  md.renderer.rules.image = (tokens, idx) => {
    const token = tokens[idx];
    const src = normalizeSrc(token.attrGet('src') || '');
    const alt = token.content || '';
    const title = token.attrGet('title') || '';
    if (!src) return '';
    const attrs = [
      `src="${escapeHtml(src)}"`,
      `alt="${escapeHtml(alt)}"`,
      'loading="lazy"',
      'decoding="async"',
      'referrerpolicy="no-referrer"',
      title ? `title="${escapeHtml(title)}"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return `<img class="prose-img" ${attrs}>`;
  };

  // ---- 链接：站内绝对地址相对化，站外新窗口 ----
  md.renderer.rules.link_open = (tokens, idx) => {
    const token = tokens[idx];
    let href = token.attrGet('href') || '';
    if (href.startsWith(SITE_ORIGIN)) href = href.slice(SITE_ORIGIN.length) || '/';
    token.attrSet('href', href);
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
      token.attrJoin('class', 'ext-link');
    }
    const attrs = token.attrs.map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ');
    return `<a ${attrs}>`;
  };

  return md;
}

const renderer = createRenderer();

/**
 * 渲染 Markdown。
 * @param {string} markdown 正文
 * @param {{title?: string}} options
 * @returns {{html: string, toc: Array<{level:number,title:string,id:string}>, hasMath: boolean}}
 */
export function renderMarkdown(markdown, options = {}) {
  const env = { toc: [], headingIds: new Map() };
  const body = String(markdown || '');
  let html = renderer.render(body, env);

  // 去掉与页面标题重复的首个标题
  const title = (options.title || '').replace(/\s+/g, '');
  if (title && env.toc.length) {
    const firstMatch = html.match(/<h([234]) id="[^"]*"[^>]*><a[^>]*>#<\/a>([\s\S]*?)<\/h\1>/);
    if (firstMatch && stripMarkdown(firstMatch[2]).replace(/\s+/g, '') === title) {
      html = html.replace(firstMatch[0], '');
      const headingText = stripMarkdown(firstMatch[2]).replace(/\s+/g, '');
      env.toc = env.toc.filter((entry) => entry.title.replace(/\s+/g, '') !== headingText);
    }
  }

  // 独占一段的图片包装成 figure，便于写图注
  html = html.replace(
    /<p>\s*(<img class="prose-img"[^>]*>)\s*<\/p>/g,
    (_, img) => {
      const alt = img.match(/alt="([^"]*)"/)?.[1] || '';
      const caption = alt && alt !== 'image' && !/^[\d\s]+$/.test(alt) ? `<figcaption>${alt}</figcaption>` : '';
      return `<figure class="prose-figure">${img}${caption}</figure>`;
    },
  );

  html = sanitize(html);

  return {
    html,
    toc: env.toc,
    hasMath: /\$[^$]+\$/.test(body) || body.includes('$$'),
  };
}
