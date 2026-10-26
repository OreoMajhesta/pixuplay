import { useRef, useCallback } from 'react';

/**
 * Custom hook to create a throttled callback function.
 * Ensures the callback is invoked at most once per every `limit` milliseconds.
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 5000
): (...args: Parameters<T>) => void {
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRan.current >= limit) {
        lastRan.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          lastRan.current = Date.now();
          callback(...args);
        }, limit - (now - lastRan.current));
      }
    },
    [callback, limit]
  );
}
