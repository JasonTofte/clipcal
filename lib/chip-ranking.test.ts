import { describe, it, expect } from 'vitest';
import { rankChips, type ChipPriority, type RankedChip } from './chip-ranking';
import type { Noticing } from './noticings';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeConflictChip(): Noticing {
  return { icon: '🔁', text: 'back-to-back with Lecture', tone: 'info' };
}

function makeInterestMatchChip(label = 'jazz'): Noticing {
  return { icon: '⭐', text: `matches your interest: ${label}`, tone: 'delight' };
}

function makeWalkChip(): Noticing {
  return { icon: '🚶', text: '12-min walk to Keller Hall', tone: 'info' };
}

function makeTimeChip(): Noticing {
  return { icon: '⚠', text: '8 AM class tomorrow', tone: 'heads-up' };
}

function makeAmenityChip(label = 'free food'): Noticing {
  return { icon: '🍕', text: label, tone: 'delight' };
}

// ---------------------------------------------------------------------------
// describe: rankChips
// ---------------------------------------------------------------------------

describe('rankChips', () => {

  // -------------------------------------------------------------------------
  // AC-6: Deterministic ordering — conflict > interest-match > walk > time > amenities
  // T-22: conflict outranks interest-match when both present
  // -------------------------------------------------------------------------
  describe('AC-6: ranking order', () => {
    it('T-22: should rank conflict before interest-match when both are present', () => {
      // Arrange
      const noticings: Noticing[] = [makeInterestMatchChip('jazz'), makeWalkChip(), makeConflictChip()];
      const interests = ['jazz', 'networking'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert — conflict is the load-bearing safety signal; it sorts to position 0
      // and, with interests present, gets the priority slot.
      expect(result[0].rankKey).toBe('conflict');
      expect(result[0].priority).toBe('priority');
    });

    it('T-24: should rank interest-match first when no conflict chip is present', () => {
      // Arrange
      const noticings: Noticing[] = [makeAmenityChip(), makeInterestMatchChip('jazz'), makeWalkChip()];
      const interests = ['jazz'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert — interest-match outranks walk and amenity when there is no conflict
      expect(result[0].rankKey).toMatch(/^interest-/);
    });

    it('should rank time chips before walk chips before amenity chips in default order', () => {
      // AC-7: empty profile → conflict → time → walk → amenities.
      // Time ranks above walk because a "leave by 6:43" constraint is more
      // cognitively load-bearing than walk distance for time-blind users.
      const noticings: Noticing[] = [makeAmenityChip(), makeTimeChip(), makeWalkChip()];
      const interests: string[] = [];

      const result = rankChips(noticings, interests);

      const timeIdx = result.findIndex((c) => c.rankKey.startsWith('time-'));
      const walkIdx = result.findIndex((c) => c.rankKey.startsWith('walk-'));
      const amenityIdx = result.findIndex((c) => c.rankKey.startsWith('amenity-'));

      expect(timeIdx).toBeLessThan(walkIdx);
      expect(walkIdx).toBeLessThan(amenityIdx);
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: single-priority invariant
  // T-23: exactly 1 chip gets priority === 'priority'
  // T-26: single-chip event still gets priority === 'priority'
  // -------------------------------------------------------------------------
  describe('AC-6: single-priority invariant', () => {
    it('T-23: should mark exactly 1 chip as priority when interests are provided', () => {
      // Arrange — 5 chips of mixed types, non-empty interests
      const noticings: Noticing[] = [
        makeConflictChip(),
        makeInterestMatchChip('jazz'),
        makeWalkChip(),
        makeTimeChip(),
        makeAmenityChip(),
      ];
      const interests = ['jazz'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert
      const priorityChips = result.filter((c) => c.priority === 'priority');
      expect(priorityChips).toHaveLength(1);
    });

    it('T-26: should mark the sole chip as priority when only one chip exists', () => {
      // Arrange
      const noticings: Noticing[] = [makeWalkChip()];
      const interests = ['hiking'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('priority');
    });

    it('should mark all non-top chips as secondary when interests are provided', () => {
      // Arrange — 3 chips; only the top one should be 'priority'
      const noticings: Noticing[] = [makeConflictChip(), makeWalkChip(), makeAmenityChip()];
      const interests = ['sports'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert
      const secondaryChips = result.filter((c) => c.priority === 'secondary');
      expect(secondaryChips).toHaveLength(result.length - 1);
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: determinism
  // T-25: same input → same output every call
  // T-27: tie-breaking is stable across calls
  // -------------------------------------------------------------------------
  describe('AC-6: determinism', () => {
    it('T-25: should return identical ordering on repeated calls with the same input', () => {
      // Arrange
      const noticings: Noticing[] = [makeAmenityChip(), makeWalkChip(), makeConflictChip(), makeTimeChip()];
      const interests = ['music'];

      // Act — call twice
      const first = rankChips(noticings, interests);
      const second = rankChips(noticings, interests);

      // Assert — same rankKey sequence
      expect(first.map((c) => c.rankKey)).toEqual(second.map((c) => c.rankKey));
    });

    it('T-27: should break ties between same-tier chips by text alpha (deterministic mechanism)', () => {
      const noticings: Noticing[] = [
        makeAmenityChip('free food'),
        makeAmenityChip('free coffee'),
      ];
      const interests: string[] = [];

      const first = rankChips(noticings, interests);
      const second = rankChips(noticings, interests);

      // Stability: identical order across calls
      expect(first.map((c) => c.rankKey)).toEqual(second.map((c) => c.rankKey));
      // Mechanism: 'free coffee' < 'free food' lexicographically, so it sorts first
      expect(first[0].rankKey).toMatch(/free-coffee/);
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: rankKey is stable and unique within a single call
  // -------------------------------------------------------------------------
  describe('AC-6: rankKey uniqueness', () => {
    it('should produce unique rankKey values within a single call', () => {
      // Arrange — 4 distinct chips
      const noticings: Noticing[] = [makeConflictChip(), makeWalkChip(), makeTimeChip(), makeAmenityChip()];
      const interests: string[] = [];

      // Act
      const result = rankChips(noticings, interests);
      const keys = result.map((c) => c.rankKey);

      // Assert — all keys are unique (no two chips share a rankKey)
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('should produce identical rankKey values for the same chip across two calls', () => {
      // Arrange — single chip, called twice
      const noticings: Noticing[] = [makeWalkChip()];
      const interests: string[] = [];

      // Act
      const first = rankChips(noticings, interests);
      const second = rankChips(noticings, interests);

      // Assert — same rankKey on both calls (stable, not random/hash-based)
      expect(first[0].rankKey).toBe(second[0].rankKey);
    });
  });

  // -------------------------------------------------------------------------
  // AC-7: empty interests → default order, no 'priority' markings
  // T-28: no chip receives priority === 'priority' when interests = []
  // T-29: default order is conflict → time → walk → amenities
  // T-30: empty noticings + empty interests = []
  // T-31: blank-string interests treated as empty profile
  // -------------------------------------------------------------------------
  describe('AC-7: empty-interest fallback', () => {
    it('T-28: should not mark any chip as priority when interests is empty', () => {
      // Arrange
      const noticings: Noticing[] = [makeConflictChip(), makeWalkChip(), makeAmenityChip()];
      const interests: string[] = [];

      // Act
      const result = rankChips(noticings, interests);

      // Assert — all chips are secondary; priority style is suppressed
      const priorityChips = result.filter((c) => c.priority === 'priority');
      expect(priorityChips).toHaveLength(0);
    });

    it('T-29: should use default order conflict → time → walk → amenity when interests is empty', () => {
      const noticings: Noticing[] = [
        makeAmenityChip(),
        makeWalkChip(),
        makeTimeChip(),
        makeConflictChip(),
      ];
      const interests: string[] = [];

      const result = rankChips(noticings, interests);

      expect(result[0].rankKey).toBe('conflict');
      expect(result[1].rankKey).toMatch(/^time-/);
      expect(result[2].rankKey).toMatch(/^walk-/);
      expect(result[3].rankKey).toMatch(/^amenity-/);
    });

    it('should not throw when interests is null (JS interop guard)', () => {
      const noticings: Noticing[] = [makeConflictChip(), makeWalkChip()];
      expect(() => rankChips(noticings, null as unknown as string[])).not.toThrow();
      const result = rankChips(noticings, null as unknown as string[]);
      // Null interests behave identically to empty: no priority chip, default order
      expect(result.filter((c) => c.priority === 'priority')).toHaveLength(0);
      expect(result[0].rankKey).toBe('conflict');
    });

    it('should assign secondary to the sole chip when interests are empty (AC-7 invariant pinned)', () => {
      const result = rankChips([makeWalkChip()], []);
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('secondary');
    });

    it('T-30: should return empty array without throwing when both noticings and interests are empty', () => {
      // Arrange
      const noticings: Noticing[] = [];
      const interests: string[] = [];

      // Act & Assert — no error, no crash
      expect(() => rankChips(noticings, interests)).not.toThrow();
      expect(rankChips(noticings, interests)).toEqual([]);
    });

    it('T-31: should treat blank-string interests as empty profile (no priority chip)', () => {
      // Arrange — interests array contains one blank string (unfinished form)
      const noticings: Noticing[] = [makeConflictChip(), makeWalkChip()];
      const interests = [''];

      // Act
      const result = rankChips(noticings, interests);

      // Assert — behaves exactly like empty interests: no priority chip, conflict-first order
      const priorityChips = result.filter((c) => c.priority === 'priority');
      expect(priorityChips).toHaveLength(0);
      expect(result[0].rankKey).toBe('conflict');
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: empty noticings with non-empty interests
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should return empty array when noticings is empty but interests are provided', () => {
      // Arrange
      const noticings: Noticing[] = [];
      const interests = ['jazz'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return RankedChip objects that extend the original Noticing fields', () => {
      // Arrange — verify the returned objects include all original Noticing fields
      const chip = makeWalkChip();
      const noticings: Noticing[] = [chip];
      const interests = ['hiking'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert — original fields preserved
      expect(result[0].icon).toBe(chip.icon);
      expect(result[0].text).toBe(chip.text);
      expect(result[0].tone).toBe(chip.tone);
      // Additional fields
      expect(result[0].priority).toBeDefined();
      expect(result[0].rankKey).toBeDefined();
    });

    it('should not mark more than 1 chip as priority even when multiple interests match', () => {
      // Arrange — two chips both matching stated interests
      const noticings: Noticing[] = [
        makeInterestMatchChip('jazz'),
        makeInterestMatchChip('networking'),
        makeWalkChip(),
      ];
      const interests = ['jazz', 'networking'];

      // Act
      const result = rankChips(noticings, interests);

      // Assert — single-priority invariant holds even with multiple matches
      const priorityChips = result.filter((c) => c.priority === 'priority');
      expect(priorityChips).toHaveLength(1);
    });
  });
});
