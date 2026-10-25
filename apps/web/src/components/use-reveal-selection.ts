'use client';
import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useRevealSelection(
  optionsRef: RefObject<HTMLElement | null>,
  selected: string | undefined,
) {
  useEffect(() => {
    const options = optionsRef.current;
    if (!options) return;
    const reveal = () => {
      const active = options.querySelector<HTMLElement>('[aria-current]');
      if (!active) {
        options.scrollLeft = 0;
        return;
      }
      const bounds = options.getBoundingClientRect(),
        target = active.getBoundingClientRect();
      // Scroll only the chip row, preserving the document's position.
      options.scrollLeft +=
        target.left - bounds.left - (options.clientWidth - target.width) / 2;
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(options);
    return () => observer.disconnect();
  }, [optionsRef, selected]);
}
