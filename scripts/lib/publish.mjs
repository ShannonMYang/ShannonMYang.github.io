#!/usr/bin/env node
/** 共享的构建 / 发布逻辑：写作台和 CLI 都走这里。 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');

export function exec(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: options.timeout || 120000,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...options.env },
  });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

export function buildSite() {
  return exec(process.execPath, ['site/build.mjs'], { timeout: 120000 });
}

export function gitInfo() {
  const branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = exec('git', ['status', '--porcelain']);
  const last = exec('git', ['log', '-1', '--pretty=format:%h %s (%cr)', '--date=relative']);
  const changes = (status.output || '').split('\n').filter(Boolean);
  return {
    branch: branch.ok ? branch.output : '(unknown)',
    dirty: changes.length > 0,
    changes: changes.length,
    lastCommit: last.ok ? last.output : '',
  };
}

/**
 * 构建 + 提交 + 推送。
 * @param {{message?: string, push?: boolean}} options
 * @returns {{ok: boolean, step?: string, log: string, pushed?: boolean}}
 */
export function publishSite({ message = '', push = true } = {}) {
  const log = [];
  const build = buildSite();
  log.push(`$ npm run build\n${build.output}`);
  if (!build.ok) return { ok: false, step: '构建静态站点', log: log.join('\n\n') };

  const add = exec('git', ['add', '-A']);
  log.push(`$ git add -A\n${add.output}`);
  if (!add.ok) return { ok: false, step: 'git add', log: log.join('\n\n') };

  const status = exec('git', ['status', '--porcelain']);
  if (!status.output.trim()) {
    return { ok: true, pushed: false, log: `${log.join('\n\n')}\n\n没有需要提交的改动，站点已是最新。` };
  }

  const commitMessage = message.trim() || `发布：${new Date().toLocaleString('zh-CN', { hour12: false })}`;
  const commit = exec('git', ['commit', '-m', commitMessage]);
  log.push(`$ git commit -m ${JSON.stringify(commitMessage)}\n${commit.output}`);
  if (!commit.ok) return { ok: false, step: 'git commit', log: log.join('\n\n') };

  if (!push) return { ok: true, pushed: false, log: log.join('\n\n') };

  const info = gitInfo();
  const pushed = exec('git', ['push', 'origin', info.branch], { timeout: 120000 });
  log.push(`$ git push origin ${info.branch}\n${pushed.output}`);
  if (!pushed.ok) return { ok: false, step: 'git push', log: log.join('\n\n') };
  return { ok: true, pushed: true, log: log.join('\n\n') };
}
