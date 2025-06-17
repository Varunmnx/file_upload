import { useState, useEffect, useRef } from "react";

const useClickOutside = (): [React.RefObject<HTMLElement | null>, boolean] => {
  const [isInside, setIsInside] = useState<boolean>(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsInside(false);
      } else {
        setIsInside(true);
      }
    };

    // Attach the event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup the event listener on unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return [ref, isInside];
};

export default useClickOutside;
