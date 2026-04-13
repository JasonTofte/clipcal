'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  loadProfileFromStorage,
  saveProfileToStorage,
  type Profile,
} from '@/lib/profile';
import { cn } from '@/lib/utils';

const INTEREST_OPTIONS = [
  { label: 'Free Food', emoji: '🍕' },
  { label: 'Networking', emoji: '🤝' },
  { label: 'Tech / CS', emoji: '💻' },
  { label: 'Hackathons', emoji: '⚡' },
  { label: 'AI / ML', emoji: '🤖' },
  { label: 'Art & Design', emoji: '🎨' },
  { label: 'Music', emoji: '🎵' },
  { label: 'Sports / Fitness', emoji: '⚽' },
  { label: 'Outdoors', emoji: '🌲' },
  { label: 'Career Fairs', emoji: '💼' },
  { label: 'Research', emoji: '🔬' },
  { label: 'Volunteering', emoji: '🤲' },
  { label: 'Cultural Events', emoji: '🎭' },
  { label: 'Gaming', emoji: '🎮' },
  { label: 'Film / Movies', emoji: '🎬' },
  { label: 'Dance', emoji: '💃' },
  { label: 'Mental Health', emoji: '🧠' },
  { label: 'Entrepreneurship', emoji: '🚀' },
  { label: 'Study Groups', emoji: '📚' },
  { label: 'Social / Parties', emoji: '🎉' },
];

const STAGE_OPTIONS = [
  { value: 'freshman', label: 'Freshman' },
  { value: 'sophomore', label: 'Sophomore' },
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'grad', label: 'Grad' },
] as const;

export function InterestPicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Pre-fill from saved profile so users can see + edit their prior picks.
  // Without this, revisiting /profile looks like a blank form and the
  // previous "Save" vanished — even though data is in localStorage.
  useEffect(() => {
    const existing = loadProfileFromStorage();
    if (existing) {
      setSelected(new Set(existing.interests));
      setStage(existing.stage ?? null);
    }
    setHydrated(true);
  }, []);

  function toggle(interest: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(interest)) next.delete(interest);
      else next.add(interest);
      return next;
    });
  }

  function handleSave() {
    // Merge with anything already stored (e.g. major/vibe set elsewhere)
    // so saving interests doesn't blow away unrelated fields.
    const existing = loadProfileFromStorage();
    const profile: Profile = {
      major: existing?.major ?? null,
      stage: (stage as Profile['stage']) ?? null,
      interests: Array.from(selected),
      preferences:
        existing?.preferences ?? { showTradeoffs: true, surfaceNoticings: true },
      vibe: existing?.vibe ?? null,
    };
    saveProfileToStorage(profile);
    setSaved(true);
    setTimeout(() => router.push('/'), 900);
  }

  if (saved) {
    return (
      <div className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400">
        Got it — {selected.size} interests saved. Taking you back.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What are you into? Pick as many as you want.
        </p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => toggle(opt.label)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
                selected.has(opt.label)
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-background text-muted-foreground ring-border hover:bg-muted/50',
              )}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Year (optional)
        </p>
        <div className="flex flex-wrap gap-2">
          {STAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStage(stage === opt.value ? null : opt.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
                stage === opt.value
                  ? 'bg-primary text-primary-foreground ring-primary'
                  : 'bg-background text-muted-foreground ring-border hover:bg-muted/50',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {hydrated && selected.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Loaded {selected.size} saved interest{selected.size === 1 ? '' : 's'}.
          Toggle to edit, then save to update.
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={selected.size === 0}
        className="w-full"
      >
        Save profile ({selected.size} interest{selected.size === 1 ? '' : 's'})
      </Button>
    </div>
  );
}
