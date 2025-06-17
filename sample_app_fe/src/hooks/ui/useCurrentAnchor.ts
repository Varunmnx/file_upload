import { useEffect, useState } from "react";

export default function useCurrentAnchor(containerSelector: string) {
  const [currentAnchor, setCurrentAnchor] = useState<string | null>(null);

  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let currentEntry = entries[0];
        if (!currentEntry) return;

        for (let i = 1; i < entries?.length; i++) {
          const entry = entries[i];
          if (!entry) break;

          if (
            entry.boundingClientRect.top < currentEntry.boundingClientRect.top
          ) {
            currentEntry = entry;
          }
        }

        const target: Element | undefined = currentEntry.target;

        if (target) setCurrentAnchor(target.getAttribute("id"));
      },
      {
        threshold: 1,
      },
    );

    const anchors = container.querySelectorAll("[data-anchor]");
    anchors.forEach((anchor) => observer.observe(anchor));

    return () => {
      observer.disconnect();
    };
  }, [containerSelector]);

  return currentAnchor;
}
