#!/usr/bin/env node
/**
 * 命令行发布：构建站点 + git commit（可选 push）。
 *
 *   npm run publish                    # 构建、提交并推送
 *   npm run publish -- -m "更新文章"    # 自定义提交信息
 *   npm run publish -- --no-push       # 只构建并本地提交
 */
import { publishSite } from './lib/publish.mjs';

const args = process.argv.slice(2);
const push = !args.includes('--no-push');
const messageIndex = args.findIndex((arg) => arg === '-m' || arg === '--message');
const message = messageIndex > -1 ? args[messageIndex + 1] || '' : '';

const result = publishSite({ message, push });
console.log(result.log);
if (!result.ok) {
  console.error(`\n发布失败：${result.step}`);
  process.exit(1);
}
console.log(result.pushed ? '\n已推送到 GitHub，约 1 分钟后线上生效。' : '\n已在本地完成构建与提交。');
