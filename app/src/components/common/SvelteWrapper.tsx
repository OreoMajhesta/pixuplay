import React, { useEffect, useRef } from 'react';
import { mount, unmount } from 'svelte';
import type { Component } from 'svelte';

interface SvelteWrapperProps {
  component: Component<any, any>;
  props?: Record<string, any>;
  className?: string;
}

export const SvelteWrapper: React.FC<SvelteWrapperProps> = ({
  component,
  props = {},
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Svelte 5 mount API
    appRef.current = mount(component, {
      target: containerRef.current,
      props,
    });

    return () => {
      if (appRef.current) {
        unmount(appRef.current);
        appRef.current = null;
      }
    };
  }, [component]);

  return <div ref={containerRef} className={className} />;
};
