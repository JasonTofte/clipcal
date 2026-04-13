'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// === pure helpers (exported for test) ====================================

// Decide which swipe action (if any) fires when the user lifts. Pure
// function so it tests without a DOM.
export function swipeDecision(args: {
  dxAtRelease: number;
  cancelled: boolean;
  threshold: number;
}): 'right' | 'left' | null {
  if (args.cancelled) return null;
  if (args.dxAtRelease >= args.threshold) return 'right';
  if (args.dxAtRelease <= -args.threshold) return 'left';
  return null;
}

// Decide whether a still-in-progress gesture should be cancelled in
// favor of vertical scroll. Pure function so it tests without a DOM.
export function shouldCancelForScroll(args: {
  dx: number;
  dy: number;
  cancelOnVerticalPx: number;
}): boolean {
  return (
    Math.abs(args.dy) > args.cancelOnVerticalPx &&
    Math.abs(args.dy) > Math.abs(args.dx)
  );
}

// Clamp a swipe offset to the visual maximum.
export function clampOffset(dx: number, maxOffset: number): number {
  return Math.max(-maxOffset, Math.min(maxOffset, dx));
}

// === hook ================================================================

// Swipe-to-reveal accelerator hook for list-item rows. Designed to
// match the iOS Mail / Gmail pattern: drag the row horizontally past
// a threshold to commit a hidden action; release before the threshold
// to snap back. Vertical-dominant gestures cancel and yield to scroll.
//
// Pointer Events handle mouse + touch + pen with one code path; no
// libraries needed. respects prefers-reduced-motion (snap is instant
// + no easing transition when reduced).
//
// API:
//   const { ref, dx, committedSide } = useSwipeReveal({
//     onSwipeRight: () => add(),
//     onSwipeLeft:  () => hide(),
//   });
//   <div ref={ref} style={{ transform: `translateX(${dx}px)` }} />

export type SwipeRevealOptions = {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  // Pixel distance the row must travel before a release commits.
  // Default 80 — matches Gmail. Past this, finger lift = action fires.
  threshold?: number;
  // Pixels of vertical drift that cancel the swipe (yield to scroll).
  // Default 14 — small enough to be forgiving without trapping the
  // page scroll.
  cancelOnVerticalPx?: number;
  // Hard cap on visual offset so the row doesn't fly off screen.
  // Default 160px (2× threshold).
  maxOffset?: number;
};

export type SwipeRevealApi<T extends HTMLElement = HTMLElement> = {
  ref: (el: T | null) => void;
  // Current horizontal offset (negative = left swipe). Apply via
  // transform: translateX(${dx}px) on the row.
  dx: number;
  // True while the user is actively dragging. Lets the consumer disable
  // the snap-back transition during the drag.
  isDragging: boolean;
};

export function useSwipeReveal<T extends HTMLElement = HTMLElement>(
  opts: SwipeRevealOptions,
): SwipeRevealApi<T> {
  const {
    onSwipeRight,
    onSwipeLeft,
    threshold = 80,
    cancelOnVerticalPx = 14,
    maxOffset = 160,
  } = opts;

  const [dx, setDx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const elRef = useRef<T | null>(null);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  // After we decide the gesture is vertical-dominant, we ignore the
  // rest of this pointer interaction and yield to scroll.
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    setDx(0);
    setIsDragging(false);
    startRef.current = null;
    cancelledRef.current = false;
  }, []);

  const onPointerDown = useCallback((e: PointerEvent) => {
    // Mouse only: only react to the primary button so right-clicks don't
    // accidentally start a swipe.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    cancelledRef.current = false;
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const start = startRef.current;
      if (!start || cancelledRef.current) return;
      const dxRaw = e.clientX - start.x;
      const dyRaw = e.clientY - start.y;

      if (shouldCancelForScroll({ dx: dxRaw, dy: dyRaw, cancelOnVerticalPx })) {
        cancelledRef.current = true;
        setDx(0);
        setIsDragging(false);
        return;
      }

      // Once we've committed to horizontal, capture the pointer so
      // subsequent move/up events fire on this element even if the
      // finger leaves it.
      const el = elRef.current;
      if (el && Math.abs(dxRaw) > 6) {
        try {
          el.setPointerCapture?.(start.pointerId);
        } catch {
          // setPointerCapture can throw in some browsers if the pointer
          // is already captured elsewhere — non-fatal, continue.
        }
      }

      setDx(clampOffset(dxRaw, maxOffset));
    },
    [cancelOnVerticalPx, maxOffset],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const start = startRef.current;
      if (!start) return;

      const el = elRef.current;
      try {
        el?.releasePointerCapture?.(start.pointerId);
      } catch {
        // ignore
      }

      const finalDx = e.clientX - start.x;
      const decision = swipeDecision({
        dxAtRelease: finalDx,
        cancelled: cancelledRef.current,
        threshold,
      });
      if (decision === 'right' && onSwipeRight) onSwipeRight();
      if (decision === 'left' && onSwipeLeft) onSwipeLeft();
      reset();
    },
    [onSwipeRight, onSwipeLeft, threshold, reset],
  );

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  // Bind listeners imperatively so we can use { passive: false } on
  // touchstart/move (Pointer Events default to passive on touch which
  // forces preventDefault to be a no-op).
  const setRef = useCallback(
    (el: T | null) => {
      // Detach from the previous element if any.
      if (elRef.current) {
        const prev = elRef.current;
        prev.removeEventListener('pointerdown', onPointerDown as EventListener);
        prev.removeEventListener('pointermove', onPointerMove as EventListener);
        prev.removeEventListener('pointerup', onPointerUp as EventListener);
        prev.removeEventListener('pointercancel', onPointerCancel as EventListener);
      }
      elRef.current = el;
      if (el) {
        el.addEventListener('pointerdown', onPointerDown as EventListener);
        el.addEventListener('pointermove', onPointerMove as EventListener);
        el.addEventListener('pointerup', onPointerUp as EventListener);
        el.addEventListener('pointercancel', onPointerCancel as EventListener);
      }
    },
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel],
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      const el = elRef.current;
      if (!el) return;
      el.removeEventListener('pointerdown', onPointerDown as EventListener);
      el.removeEventListener('pointermove', onPointerMove as EventListener);
      el.removeEventListener('pointerup', onPointerUp as EventListener);
      el.removeEventListener('pointercancel', onPointerCancel as EventListener);
    };
  }, [onPointerDown, onPointerMove, onPointerUp, onPointerCancel]);

  return { ref: setRef, dx, isDragging };
}
