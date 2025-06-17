import React, { useEffect } from "react";

const useObserver = (
  isAllDataFetched: boolean,
  searchRequest: string,
  callback: () => void,
  targetRef: React.RefObject<HTMLDivElement>,
  category: string,
) => {
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isAllDataFetched) {
        callback();
      }
    });

    const targetElement = targetRef.current;
    if (targetElement) {
      observer.observe(targetElement);
    }

    return () => {
      if (targetElement) {
        observer.unobserve(targetElement);
      }
    };
  }, [searchRequest, category, isAllDataFetched, callback, targetRef]);
};

export default useObserver;
