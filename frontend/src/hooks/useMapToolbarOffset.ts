import { useEffect, type RefObject } from 'react';

const CSS_VAR = '--map-toolbar-offset';
const DEFAULT_OFFSET = '120px';

/** Mede a altura da toolbar e expõe --map-toolbar-offset no container do mapa. */
export function useMapToolbarOffset(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const toolbar = root.querySelector('.map-toolbar-root');
    if (!toolbar) {
      root.style.setProperty(CSS_VAR, DEFAULT_OFFSET);
      return;
    }

    const update = () => {
      const containerRect = root.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const offset = Math.ceil(toolbarRect.bottom - containerRect.top + 8);
      root.style.setProperty(CSS_VAR, `${offset}px`);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(toolbar);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);
}
