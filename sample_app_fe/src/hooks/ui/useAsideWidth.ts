import { useState, useEffect } from "react";

const useAsideWidth = () => {
  const [asideWidth, setAsideWidth] = useState(400); // default width

  const updateAsideWidth = () => {
    const screenWidth = window.innerWidth;

    if (screenWidth >= 1200) {
      // Large screens (e.g., desktops)
      setAsideWidth(400);
    } else if (screenWidth >= 992 && screenWidth < 1200) {
      // Medium screens (e.g., tablets)
      setAsideWidth(350);
    } else if (screenWidth >= 768 && screenWidth < 992) {
      // Small screens (e.g., large phones)
      setAsideWidth(300);
    } else {
      // Extra small screens (e.g., small phones)
      setAsideWidth(0);
    }
  };

  useEffect(() => {
    updateAsideWidth(); // Adjust the width on initial load

    window.addEventListener("resize", updateAsideWidth);

    // Cleanup the event listener on component unmount
    return () => window.removeEventListener("resize", updateAsideWidth);
  }, []);

  return asideWidth;
};

export default useAsideWidth;
