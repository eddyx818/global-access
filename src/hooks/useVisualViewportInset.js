import { useEffect, useState } from 'react';

/** Bottom inset when mobile keyboard is open (visualViewport API). */
export default function useVisualViewportInset(enabled = true) {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) return undefined;

    const vv = window.visualViewport;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBottomInset(inset > 40 ? inset : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);

  return bottomInset;
}
