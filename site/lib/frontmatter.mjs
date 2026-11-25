import * as yaml from 'js-yaml';

/** 把 frontmatter 字段序列化成 YAML（值为 JSON 风格，YAML 1.2 可直接解析） */
function yamlValue(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(yamlValue).join(', ')}]`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) {
    // 统一用 Asia/Shanghai 的表达，便于人读源文件
    const shifted = new Date(value.getTime() + 8 * 3600 * 1000);
    return JSON.stringify(`${shifted.toISOString().slice(0, 19)}+08:00`);
  }
  if (typeof value === 'object') {
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${yamlValue(v)}`)
      .join(', ')} }`;
  }
  return JSON.stringify(String(value));
}

export function stringifyFrontmatter(fields, body = '') {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  lines.push('---', '');
  return `${lines.join('\n')}\n${String(body).replace(/^\n+/, '').trimEnd()}\n`;
}

/** 只解析一段 YAML 文本（用于 content/site.yml） */
export function parseYaml(text) {
  return yaml.load(text) ?? {};
}
