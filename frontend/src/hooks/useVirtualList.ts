/**
 * Day 37: Performance Optimization Hooks
 * useVirtualList - Efficient rendering for large task lists
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualListOptions {
  itemHeight: number;
  overscan?: number; // Extra items to render above/below viewport
}

interface VirtualListResult<T> {
  visibleItems: { item: T; index: number; offsetTop: number }[];
  totalHeight: number;
  containerProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    onScroll: () => void;
    style: React.CSSProperties;
  };
  innerProps: {
    style: React.CSSProperties;
  };
}

/**
 * Virtual scrolling hook - only renders visible items for long lists.
 * Massively cuts DOM nodes for 500+ item lists.
 */
export function useVirtualList<T>(
  items: T[],
  { itemHeight, overscan = 5 }: VirtualListOptions
): VirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Observe container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const { visibleItems, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visible = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visible.push({
        item: items[i],
        index: i,
        offsetTop: i * itemHeight,
      });
    }

    return { visibleItems: visible, totalHeight: total };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  return {
    visibleItems,
    totalHeight,
    containerProps: {
      ref: containerRef,
      onScroll,
      style: { overflowY: 'auto' as const, position: 'relative' as const },
    },
    innerProps: {
      style: { height: totalHeight, position: 'relative' as const },
    },
  };
}
