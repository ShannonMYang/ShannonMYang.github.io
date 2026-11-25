#!/usr/bin/env node
/** 无障碍与基础质量检查（axe-core）。用法：node scripts/verify-a11y.mjs [baseUrl] */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AXE = path.resolve(import.meta.dirname, '../node_modules/axe-core/axe.min.js');
const OUT = path.resolve(import.meta.dirname, '../.tmp/a11y');

const pages = ['/', '/note/gh-49/', '/post/ios-li-yong-runtime-zi-ding-yi-dao-hang-kong-zhi-qi-fan-hui-shou-shi/', '/archives/', '/tags/', '/notes/', '/about/', '/404.html'];

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const results = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [1600, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      await page.addInitScript((value) => {
        try {
          localStorage.setItem('theme', value);
        } catch {
          /* ignore */
        }
      }, theme);
      for (const route of pages) {
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        await page.addScriptTag({ path: AXE });
        const result = await page.evaluate(async () => {
          const res = await axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          });
          return res.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.slice(0, 4).map((node) => ({ target: node.target, summary: node.failureSummary?.slice(0, 220) })),
          }));
        });
        const serious = result.filter((item) => item.impact === 'serious' || item.impact === 'critical');
        results.push({ theme, width, route, violations: result });
        console.log(`${serious.length ? '✗' : '✓'} ${theme} ${width}px ${route} — ${result.length} 项（严重 ${serious.length}）`);
        for (const violation of result) {
          console.log(`   · [${violation.impact}] ${violation.id}: ${violation.help}`);
          for (const node of violation.nodes.slice(0, 2)) console.log(`     ${node.target.join(' ')} — ${node.summary || ''}`);
        }
      }
      await context.close();
    }
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  const serious = results.flatMap((r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'));
  console.log(`\n严重问题：${serious.length} 个。报告：${OUT}/report.json`);
  if (serious.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
