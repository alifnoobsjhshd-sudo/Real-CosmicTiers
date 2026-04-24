import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyMountProps {
  children: ReactNode;
  placeholderHeight?: number;
  rootMargin?: string;
  className?: string;
}

export function LazyMount({
  children,
  placeholderHeight = 96,
  rootMargin = "400px",
  className = "",
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div
      ref={ref}
      className={className}
      style={!visible ? { minHeight: placeholderHeight } : undefined}
    >
      {visible ? (
        children
      ) : (
        <div
          className="flex items-center justify-center w-full"
          style={{ height: placeholderHeight }}
          aria-busy="true"
          aria-label="Loading"
        >
          <span className="lazy-spinner" />
        </div>
      )}
    </div>
  );
}
