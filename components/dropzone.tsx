'use client';

import { useCallback, useState, type DragEvent } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

type DropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function Dropzone({ onFiles, disabled = false }: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const pickImageFiles = (files: FileList | File[] | null) => {
    if (!files) return [];
    return Array.from(files).filter((f) => f.type.startsWith('image/'));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = pickImageFiles(e.target.files);
    if (files.length > 0) onFiles(files);
    e.target.value = '';
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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative rounded-2xl border-2 border-dashed transition-colors',
        'border-border bg-card',
        dragActive && 'border-primary bg-primary/5',
        disabled && 'opacity-50',
      )}
    >
      <label
        aria-label="Upload a flyer image"
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-10 text-center',
          !disabled && 'cursor-pointer hover:bg-muted/50 rounded-2xl',
          disabled && 'cursor-not-allowed',
        )}
      >
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={handleFileInput}
          disabled={disabled}
        />
        <Camera aria-hidden size={40} strokeWidth={1.5} className="text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-heading text-base font-medium">
            {dragActive ? 'Drop it — Claude will read it' : 'Snap, paste, or drop a flyer'}
          </p>
          <p className="text-sm text-muted-foreground">
            JPG · PNG · WEBP · up to 5 MB
          </p>
          <p className="text-xs text-muted-foreground/70">
            or press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘V</kbd> to paste
          </p>
        </div>
      </label>
      <div className="flex justify-center pb-4">
        <label
          aria-label="Take a photo with your camera"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm',
            !disabled && 'cursor-pointer hover:bg-muted active:bg-muted',
            disabled && 'cursor-not-allowed',
          )}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileInput}
            disabled={disabled}
          />
          <Camera aria-hidden size={16} strokeWidth={1.75} />
          <span>Take photo</span>
        </label>
      </div>
    </div>
  );
}
