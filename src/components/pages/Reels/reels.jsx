import React, { useEffect, useRef } from "react";
import Home from "../Home/home";
import Seo from "../../seo/Seo";

function Reels() {
  const lockRef = useRef(false);
  const touchStartYRef = useRef(0);

  useEffect(() => {
    const getItems = () =>
      Array.from(document.querySelectorAll(".home-feed .post-item"));

    const getActiveIndex = (items) => {
      if (!items.length) return -1;
      const viewportCenter = window.innerHeight / 2;
      let closestIndex = 0;
      let minDistance = Number.POSITIVE_INFINITY;

      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - viewportCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      return closestIndex;
    };

    const jumpToNext = (direction) => {
      if (lockRef.current) return;
      const items = getItems();
      if (!items.length) return;

      const activeIndex = getActiveIndex(items);
      if (activeIndex < 0) return;

      const nextIndex = Math.max(
        0,
        Math.min(items.length - 1, activeIndex + direction),
      );

      if (nextIndex === activeIndex) return;
      lockRef.current = true;
      items[nextIndex].scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        lockRef.current = false;
      }, 420);
    };

    const onWheel = (event) => {
      if (Math.abs(event.deltaY) < 30) return;
      event.preventDefault();
      jumpToNext(event.deltaY > 0 ? 1 : -1);
    };

    const onTouchStart = (event) => {
      touchStartYRef.current = event.touches[0]?.clientY || 0;
    };

    const onTouchEnd = (event) => {
      const endY = event.changedTouches[0]?.clientY || 0;
      const deltaY = touchStartYRef.current - endY;
      if (Math.abs(deltaY) < 45) return;
      jumpToNext(deltaY > 0 ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <>
      <Seo
        title="Reels"
        description="Xabarchi reels uslubidagi postlar oqimi."
      />
      <div>
        <Home enableSeo={false} />
      </div>
    </>
  );
}

export default Reels;
