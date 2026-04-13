'use client';

import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

type DropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function Dropzone({ onFiles, disabled = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const pickImageFiles = (files: FileList | File[] | null) => {
    if (!files) return [];
    return Array.from(files).filter((f) => f.type.startsWith('image/'));
  };

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) setDragActive(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Ignore leaves that land on a child of the dropzone.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const files = pickImageFiles(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    },
    [openPicker],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Drop a flyer, paste an image, or click to upload"
      className={cn(
        'group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
        'border-border bg-card',
        !disabled && 'cursor-pointer hover:border-primary/40 hover:bg-primary/5',
        dragActive && 'border-primary bg-primary/5 scale-[1.01]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = pickImageFiles(e.target.files);
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
        disabled={disabled}
      />
      <div className="text-4xl transition-transform group-hover:scale-110" aria-hidden>
        {dragActive ? '🎯' : '📸'}
      </div>
      <div className="space-y-1">
        <p className="font-heading text-base font-medium">
          {dragActive ? 'Drop it! Claude will take it from here' : 'Snap, paste, or drop a flyer'}
        </p>
        <p className="text-sm text-muted-foreground">
          Any flyer works — photos, screenshots, posters
        </p>
        <p className="text-xs text-muted-foreground/70">
          or press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘V</kbd> to paste from clipboard
        </p>
      </div>
    </div>
  );
}
