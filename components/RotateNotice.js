import { useEffect, useState } from 'react';

// A phone held sideways leaves no room for the game once the on-screen keyboard is up.
// Reads the screen's orientation rather than the viewport's, which the keyboard can make look landscape.
const isLandscapePhone = () => {
  const { width, height, orientation } = window.screen;
  const phone = window.matchMedia('(pointer: coarse)').matches && Math.min(width, height) < 600;
  const landscape = orientation?.type ? orientation.type.startsWith('landscape') : width > height;
  return phone && landscape;
};

// Whether the player is holding a phone sideways; false until the browser has been asked.
export const useLandscapePhone = () => {
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const update = () => setLandscape(isLandscapePhone());
    update();
    window.screen.orientation?.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.screen.orientation?.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return landscape;
};

// Covers the game asking the player to turn their phone upright.
const RotateNotice = () => (
  <div className="rotate-notice" role="alert">
    <div className="rotate-notice-text">
      화면을 세로로 돌려주세요
      <br />
      <span className="yellow">세로 모드에서만 놀이할 수 있습니다</span>
    </div>
  </div>
);

export default RotateNotice;
