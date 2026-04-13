import { useEffect, useState } from 'react';

const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';

export function useDemoMode(defaultValue = true): [boolean, (v: boolean) => void] {
  const [demoMode, setDemoMode] = useState<boolean>(defaultValue);

  useEffect(() => {
    const stored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored !== null) setDemoMode(stored === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(demoMode));
  }, [demoMode]);

  return [demoMode, setDemoMode];
}
