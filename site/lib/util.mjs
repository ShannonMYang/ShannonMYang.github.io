const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

/** 标签 → URL slug：ASCII 转小写连字符；中文保留（浏览器会自动编码） */
export function tagSlug(name) {
  const s = String(name)
    .trim()
    .toLowerCase()
    .replace(/[.\u3002]/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'tag';
}

export function hashString(value = '') {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 粗略的阅读时长：中文按 350 字/分钟，英文按 220 词/分钟 */
export function readingMinutes(text = '') {
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latinWords = (text.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 350 + latinWords / 220));
}

export function stripMarkdown(markdown = '') {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptFrom(markdown = '', limit = 180) {
  const plain = stripMarkdown(markdown);
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}

const DATE_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_LONG_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function dateParts(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return DATE_FMT.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
}

export function formatDate(date) {
  const p = dateParts(date);
  return p ? `${p.year}.${p.month}.${p.day}` : '';
}

/** YYYY-MM-DD（按 Asia/Shanghai，供 <input type="date"> 使用） */
export function dateInputValue(date) {
  const p = dateParts(date);
  return p ? `${p.year}-${p.month}-${p.day}` : '';
}

export function formatDateLong(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return DATE_LONG_FMT.format(date);
}

export function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return TIME_FMT.format(date);
}

export function toDateTimeAttr(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

export function asDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string' && value.trim()) {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+08:00` : value;
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(n >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}

export function uniq(list) {
  return [...new Set(list)];
}
