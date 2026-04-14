'use client';

import { CampusFeed } from '@/components/campus-feed';
import { Dropzone } from '@/components/dropzone';
import { GoldyBubble } from '@/components/shared';

type Props = {
  onFiles: (files: File[]) => void;
};

export function HomeIdleView({ onFiles }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <GoldyBubble avatar tone="gold" className="self-start max-w-sm">
        <p className="text-sm leading-snug">
          Drop a flyer, I&rsquo;ll sort it. Camera roll, paste, or pick a file — I&rsquo;ll pull
          the when, where, and whether you&rsquo;re free.
        </p>
      </GoldyBubble>
      <Dropzone onFiles={onFiles} />
      <CampusFeed />
    </div>
  );
}
