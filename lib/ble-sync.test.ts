import { describe, it, expect } from 'vitest';
import { chunkBytes } from '@/lib/ble-sync';

describe('chunkBytes', () => {
  it('returns empty array for empty input', () => {
    expect(chunkBytes(new Uint8Array(0), 20)).toEqual([]);
  });

  it('single chunk for input ≤ chunkSize', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const chunks = chunkBytes(bytes, 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('exactly-chunk-sized input fits in one chunk', () => {
    const bytes = new Uint8Array(20).fill(7);
    const chunks = chunkBytes(bytes, 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(20);
  });

  it('input one byte over chunkSize splits into two', () => {
    const bytes = new Uint8Array(21).fill(9);
    const chunks = chunkBytes(bytes, 20);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(1);
  });

  it('510-byte payload at 20-byte chunks → 26 chunks', () => {
    const bytes = new Uint8Array(510);
    const chunks = chunkBytes(bytes, 20);
    expect(chunks).toHaveLength(26); // 25 full + 1 of length 10
    const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0);
    expect(totalBytes).toBe(510);
  });

  it('throws on chunkSize ≤ 0', () => {
    expect(() => chunkBytes(new Uint8Array(10), 0)).toThrow();
    expect(() => chunkBytes(new Uint8Array(10), -1)).toThrow();
  });
});
