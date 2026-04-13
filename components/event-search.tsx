'use client';

import { Input } from '@/components/ui/input';

export type EventSearchProps = {
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
};

export function EventSearch({ value, onChange, placeholder }: EventSearchProps) {
  return (
    <div className="relative">
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search campus events…'}
        aria-label="Search campus events"
        className="pr-10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          clear
        </button>
      )}
    </div>
  );
}
