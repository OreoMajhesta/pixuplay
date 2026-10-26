import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any fast-changing value.
 * @param value The value to debounce (e.g., search query, filter).
 * @param delay Milliseconds to wait before updating value (default 300ms).
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
