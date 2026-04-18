import { describe, it, expect } from 'vitest';
import { linkifySafe } from '@/lib/linkify';
import type { LinkifySegment } from '@/lib/linkify';

describe('linkifySafe', () => {
  // T-8 (AC-4) — splits text on a safe https URL into three segments
  it('T-8: AC-4 — splits "See https://z.umn.edu/beltsander for details" into text/link/text segments', () => {
    const result = linkifySafe('See https://z.umn.edu/beltsander for details');
    expect(result).toEqual<LinkifySegment[]>([
      { type: 'text', value: 'See ' },
      { type: 'link', href: 'https://z.umn.edu/beltsander', value: 'https://z.umn.edu/beltsander' },
      { type: 'text', value: ' for details' },
    ]);
  });

  // T-11 (AC-5) — trailing period stripped from href; period becomes its own text segment
  it('T-11: AC-5 — strips trailing period from href and appends it as text segment', () => {
    const result = linkifySafe('details at https://example.com/page.');
    const linkSeg = result.find((s) => s.type === 'link');
    expect(linkSeg).toBeDefined();
    expect(linkSeg).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const lastSeg = result[result.length - 1];
    expect(lastSeg).toEqual({ type: 'text', value: '.' });
  });

  // T-12 (AC-5) — each tail punctuation character stripped individually (8 subcases)
  it('T-12a: AC-5 — strips trailing comma from href', () => {
    const result = linkifySafe('see https://example.com/page,');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: ',' });
  });

  it('T-12b: AC-5 — strips trailing semicolon from href', () => {
    const result = linkifySafe('see https://example.com/page;');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: ';' });
  });

  it('T-12c: AC-5 — strips trailing colon from href', () => {
    const result = linkifySafe('see https://example.com/page:');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: ':' });
  });

  it('T-12d: AC-5 — strips trailing exclamation mark from href', () => {
    const result = linkifySafe('see https://example.com/page!');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: '!' });
  });

  it('T-12e: AC-5 — strips trailing question mark from href', () => {
    const result = linkifySafe('see https://example.com/page?');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: '?' });
  });

  it('T-12f: AC-5 — strips trailing close-paren from href', () => {
    const result = linkifySafe('see https://example.com/page)');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: ')' });
  });

  it('T-12g: AC-5 — strips trailing close-bracket from href', () => {
    const result = linkifySafe('see https://example.com/page]');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: ']' });
  });

  it('T-12h: AC-5 — strips trailing close-brace from href', () => {
    const result = linkifySafe('see https://example.com/page}');
    const link = result.find((s) => s.type === 'link');
    expect(link).toEqual({ type: 'link', href: 'https://example.com/page', value: 'https://example.com/page' });
    const last = result[result.length - 1];
    expect(last).toEqual({ type: 'text', value: '}' });
  });

  // T-14 (AC-6) — rejects javascript: protocol (absence oracle)
  it('T-14: AC-6 — returns single text segment for "javascript:alert(1)" (no link produced)', () => {
    const result = linkifySafe('javascript:alert(1)');
    expect(result.every((s) => s.type === 'text')).toBe(true);
  });

  // T-15 (AC-6) — rejects data: protocol (absence oracle)
  it('T-15: AC-6 — returns single text segment for "data:text/html,<script>" (no link produced)', () => {
    const result = linkifySafe('data:text/html,<script>');
    expect(result.every((s) => s.type === 'text')).toBe(true);
  });

  // T-16 (AC-6) — rejects file: protocol (absence oracle)
  it('T-16: AC-6 — returns single text segment for "file:///etc/passwd" (no link produced)', () => {
    const result = linkifySafe('file:///etc/passwd');
    expect(result.every((s) => s.type === 'text')).toBe(true);
  });

  // T-17 (AC-6) — rejects malformed https with no host.
  // Exact-equality oracle strengthens beyond the absence check so an
  // accidental content drop in the tail-flush would surface here.
  it('T-17: AC-6 — returns single text segment for "https://" (no host, content preserved)', () => {
    const result = linkifySafe('https://');
    expect(result).toEqual<LinkifySegment[]>([
      { type: 'text', value: 'https://' },
    ]);
  });

  // T-18 (AC-6) — rejects malformed https with space in host (absence oracle)
  it('T-18: AC-6 — returns single text segment for "https:// example.com" (space in authority)', () => {
    const result = linkifySafe('https:// example.com');
    expect(result.every((s) => s.type === 'text')).toBe(true);
  });

  // T-21 (AC-7) — bare domain without scheme stays as text
  it('T-21: AC-7 — "see z.umn.edu/beltsander" returns single text segment (no scheme inference)', () => {
    const result = linkifySafe('see z.umn.edu/beltsander');
    expect(result).toEqual<LinkifySegment[]>([
      { type: 'text', value: 'see z.umn.edu/beltsander' },
    ]);
  });

  // Regression guard (security review) — https:// with userinfo + embedded
  // javascript-ish hostname must still produce an href whose protocol is
  // https, not javascript. `new URL()` parses this as host "javascript:x"
  // with userinfo "a"; protocol stays https. Lock that behavior in.
  it('AC-6 regression — "https://a@javascript:x" produces https href, never javascript protocol', () => {
    const result = linkifySafe('click https://a@javascript:x here');
    const link = result.find((s) => s.type === 'link');
    if (link && link.type === 'link') {
      const parsed = new URL(link.href);
      expect(parsed.protocol).toBe('https:');
    }
    // Either shape is acceptable (parse may reject as invalid host); the
    // invariant is only that no link segment ever carries a non-https protocol.
    for (const s of result) {
      if (s.type === 'link') {
        expect(new URL(s.href).protocol).toMatch(/^https?:$/);
      }
    }
  });

  // Length cap — over-long URLs fall through to text so an abusive flyer
  // can't produce a multi-KB anchor.
  it('AC-6 hardening — URL over 2048 chars falls through to text segment', () => {
    const longPath = 'a'.repeat(2048);
    const input = `see https://example.com/${longPath} details`;
    const result = linkifySafe(input);
    expect(result.every((s) => s.type === 'text')).toBe(true);
  });
});
