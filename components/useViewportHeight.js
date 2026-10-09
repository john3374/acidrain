import { useEffect, useState } from 'react';

// Height in CSS px of the part of the page the player can see, or null where the browser can't tell.
// On phones it shrinks while the on-screen keyboard is up, which `100vh` doesn't.
const useViewportHeight = () => {
  const [height, setHeight] = useState(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // Times scale, so pinch-zooming doesn't shrink the game.
      setHeight(Math.round(vv.height * vv.scale));
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
