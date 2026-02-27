import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const ScrollManager = () => {
  const { pathname } = useLocation();
  const positions = useRef({});

  useEffect(() => {
    const saveScroll = () => {
      positions.current[pathname] = window.scrollY;
    };

    window.addEventListener("beforeunload", saveScroll);

    const y = positions.current[pathname] || 0;

    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "smooth" });
    });

    return () => {
      positions.current[pathname] = window.scrollY;
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, [pathname]);

  return null;
};

export default ScrollManager;
