import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../..');
}

function readRepo(...parts: string[]): string {
  return readFileSync(join(repoRoot(), ...parts), 'utf8');
}

describe('crawler shell files', () => {
  it('serves a real robots.txt for Baidu', () => {
    const text = readRepo('public', 'robots.txt');
    expect(text).toContain('User-agent: *');
    expect(text).toContain('Allow: /');
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Disallow: /admin/');
    expect(text).toContain('Sitemap: https://suikoushuo.com/sitemap.xml');
    expect(text).not.toContain('<html');
  });

  it('lists only the homepage in sitemap.xml', () => {
    const xml = readRepo('public', 'sitemap.xml');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('https://suikoushuo.com/');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).not.toContain('/login');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('<html');
  });

  it('exposes Baidu-readable meta and noscript on the HTML shell', () => {
    const html = readRepo('index.html');
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<title>随口说 — 口播博主的 AI 内容工作台</title>');
    expect(html).toContain(
      'content="面向口播博主与获客老板的 AI 内容工作台。「随口说」记住你的人设、口吻和业务知识，从账号定位到选题、创作、发布复盘，全流程陪你把号做起来。"',
    );
    expect(html).toContain(
      'content="随口说,口播,口播文案,AI写作,抖音口播,视频号,内容工作台"',
    );
    expect(html).toContain('<link rel="canonical" href="https://suikoushuo.com/" />');
    expect(html).toContain('<noscript>');
    expect(html).toContain('随口说');
    expect(html).toContain('让每条口播稿都像你本人写的');
    expect(html).toContain(
      '不是又一个 AI 写作工具。「随口说」记住你的人设、口吻和业务知识，从账号定位到选题、创作、发布复盘，全流程陪你把号做起来。',
    );
    expect(html).toContain('免费开始，手机号登录');
    expect(html).toContain('https://suikoushuo.com/');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('name="theme-color"');
    expect(html).not.toContain('VITE_');
  });
});
