import { describe, test, expect } from 'vitest';
import { simpleMarkdownToHtml } from '../app/page';

describe('simpleMarkdownToHtml parser', () => {
  test('parses basic headings', () => {
    const md = '# Main Title\n## Sub Title';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<h1>Main Title</h1>');
    expect(html).toContain('<h2>Sub Title</h2>');
  });

  test('parses bold and italic syntax', () => {
    const md = 'This is **bold** and *italic* text.';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  test('parses markdown lists', () => {
    const md = '- Item 1\n- Item 2';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
  });

  test('parses markdown tables', () => {
    const md = '| Col A | Col B |\n| --- | --- |\n| Val A | Val B |';
    const html = simpleMarkdownToHtml(md);
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Col A');
    expect(html).toContain('Val B');
  });
});
