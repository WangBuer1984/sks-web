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
});
