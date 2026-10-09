import { useEffect, useState } from 'react';

// Height in CSS px of the part of the page the player can see, or null where the browser can't tell.
// On phones it shrinks while the on-screen keyboard is up, which `100vh` doesn't.
const useViewportHeight = () => {
  const [height, setHeight] = useState(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // While zoomed in, the visible height no longer matches the page, and scrolling is how the player
      // reaches the input: keep the last fitted height and leave the scroll alone.
      if (vv.scale > 1) return;
      setHeight(Math.round(vv.height));
      // Some browsers scroll the page to reveal the focused input; the game already fits, so undo it.
      window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  return height;
};

export default useViewportHeight;
