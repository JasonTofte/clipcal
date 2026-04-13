import { describe, it, expect } from 'vitest';
import { __test__ } from '@/lib/qr-decode';

const { isSafeUrl } = __test__;

describe('qr-decode URL filter', () => {
  it('accepts https://', () => {
    expect(isSafeUrl('https://csesocial.umn.edu/signup')).toBe(true);
  });
  it('accepts http:// (LAN demos, dev servers)', () => {
    expect(isSafeUrl('http://10.0.0.140:8080/sync')).toBe(true);
  });
  it('rejects javascript: payloads (XSS)', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
  });
  it('rejects data: URLs', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
  it('rejects file:// URLs', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });
  it('rejects empty / null / undefined', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
  it('rejects non-URL strings', () => {
    expect(isSafeUrl('not a url')).toBe(false);
    expect(isSafeUrl('csesocial.umn.edu')).toBe(false);
  });
  it('rejects ftp://', () => {
    expect(isSafeUrl('ftp://example.com')).toBe(false);
  });
});
