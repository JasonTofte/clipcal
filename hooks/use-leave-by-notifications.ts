'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Event } from '@/lib/schema';
import { scheduleLeaveByNotifications } from '@/lib/leave-by-scheduler';

export type NotifyPermission = 'default' | 'granted' | 'denied' | 'unsupported';
const OPT_IN_KEY = 'clipcal_leave_by_notify_optin';
const MAX_SETTIMEOUT_MS = 2_147_483_647; // ~24.8 days — setTimeout upper bound

// Foreground-only leave-by notifications. Tab must be open when the
// timer fires. We document this limit in the release notes — iOS PWA
// push and service-worker scheduling are out of scope without a backend.
export function useLeaveByNotifications(events: Event[]) {
  const [permission, setPermission] = useState<NotifyPermission>('default');
  const [optedIn, setOptedIn] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(window.Notification.permission as NotifyPermission);
    setOptedIn(window.localStorage.getItem(OPT_IN_KEY) === 'true');
  }, []);

  const requestOptIn = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await window.Notification.requestPermission();
    setPermission(result as NotifyPermission);
    if (result === 'granted') {
      window.localStorage.setItem(OPT_IN_KEY, 'true');
      setOptedIn(true);
    }
  }, []);

  const optOut = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OPT_IN_KEY, 'false');
    setOptedIn(false);
  }, []);

  // Schedule/clear foreground timers when events or opt-in changes.
  useEffect(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    if (!optedIn || permission !== 'granted') return;

    const scheduled = scheduleLeaveByNotifications(events);
    for (const n of scheduled) {
      const delay = n.fireAt.getTime() - Date.now();
      if (delay <= 0 || delay > MAX_SETTIMEOUT_MS) continue;
      const id = window.setTimeout(() => {
        try {
          new window.Notification(n.title, { body: n.body, tag: n.key });
        } catch {
          /* notification API can throw on some platforms; fail silent */
        }
      }, delay);
      timers.current.push(id);
    }

    return () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    };
  }, [events, optedIn, permission]);

  return { permission, optedIn, requestOptIn, optOut };
}
