import { useState, useEffect } from "react";

const defaultBreakpoints = {
  xs: "480px", // 30em
  sm: "768px", // 48em
  md: "1024px", // 64em
  lg: "1184px", // 74em
  xl: "1440px", // 90em
};

const useBreakpoints = (
  customBreakpoints?: Partial<typeof defaultBreakpoints>,
) => {
  const breakpoints = { ...defaultBreakpoints, ...customBreakpoints };

  const getMatches = () => ({
    isXs: window.matchMedia(`(min-width: ${breakpoints.xs})`).matches,
    isSm: window.matchMedia(`(min-width: ${breakpoints.sm})`).matches,
    isMd: window.matchMedia(`(min-width: ${breakpoints.md})`).matches,
    isLg: window.matchMedia(`(min-width: ${breakpoints.lg})`).matches,
    isXl: window.matchMedia(`(min-width: ${breakpoints.xl})`).matches,
  });

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const handleResize = () => setMatches(getMatches());

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return matches;
};

export default useBreakpoints;
