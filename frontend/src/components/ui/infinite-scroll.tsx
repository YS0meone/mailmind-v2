"use client";

import * as React from "react";

interface InfiniteScrollProps {
  isLoading: boolean;
  hasMore: boolean;
  next: () => void;
  threshold?: number;
  root?: Element | Document | null;
  rootMargin?: string;
  children?: React.ReactNode;
}

export function InfiniteScroll({
  isLoading,
  hasMore,
  next,
  threshold = 1,
  root = null,
  rootMargin = "0px",
  children,
}: InfiniteScrollProps) {
  const observer = React.useRef<IntersectionObserver | null>(null);

  const sentinelRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();
      if (!element) return;

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            next();
          }
        },
        { threshold, root, rootMargin }
      );
      observer.current.observe(element);
    },
    [hasMore, isLoading, next, threshold, root, rootMargin]
  );

  return (
    <>
      {children}
      <div ref={sentinelRef} />
    </>
  );
}
