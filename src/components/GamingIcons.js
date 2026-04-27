import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';

const BG_OBJECTS = [
  { type: 'crosshair', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="4"/><circle cx="24" cy="24" r="1.5" fill="currentColor"/><line x1="24" y1="6" x2="24" y2="0"/><line x1="24" y1="42" x2="24" y2="48"/><line x1="6" y1="24" x2="0" y2="24"/><line x1="42" y1="24" x2="48" y2="24"/></g>' },
  { type: 'controller', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><rect x="2" y="12" width="44" height="22" rx="8" fill="currentColor" fill-opacity="0.04"/><circle cx="12" cy="23" r="5.5" fill="currentColor" fill-opacity="0.12"/><circle cx="36" cy="23" r="5.5" fill="currentColor" fill-opacity="0.12"/><line x1="24" y1="34" x2="24" y2="44"/><line x1="24" y1="44" x2="16" y2="52"/><line x1="24" y1="44" x2="32" y2="52"/></g>' },
  { type: 'keyboard', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="0.9" fill="none"><g transform="rotate(-15 24 24)"><rect x="2" y="8" width="44" height="28" rx="3" fill="currentColor" fill-opacity="0.03"/><rect x="6" y="13" width="7" height="6" rx="1.2" fill="currentColor" fill-opacity="0.07"/><rect x="15" y="13" width="7" height="6" rx="1.2" fill="currentColor" fill-opacity="0.07"/><rect x="24" y="13" width="7" height="6" rx="1.2" fill="currentColor" fill-opacity="0.07"/><rect x="33" y="13" width="11" height="6" rx="1.2" fill="currentColor" fill-opacity="0.1"/><rect x="6" y="22" width="18" height="6" rx="1.2" fill="currentColor" fill-opacity="0.07"/><rect x="26" y="22" width="18" height="6" rx="1.2" fill="currentColor" fill-opacity="0.07"/></g></g>' },
  { type: 'mouse', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><path d="M8 8c-7 0-12 5.5-12 13v34c0 7 5 12.5 12 12.5h12c7 0 12-5.5 12-12.5V21c0-7.5-5-13-12-13H8z" fill="currentColor" fill-opacity="0.03"/><line x1="14" y1="8" x2="14" y2="40"/><line x1="14" y1="30" x2="14" y2="40" stroke-width="2.5"/><circle cx="14" cy="46" r="2" fill="currentColor"/><line x1="26" y1="8" x2="26" y2="40"/></g>' },
  { type: 'rifle', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><rect x="2" y="4" width="14" height="4" rx="1.5" fill="currentColor" fill-opacity="0.04"/><rect x="0" y="2" width="8" height="8" rx="1.5" fill="currentColor" fill-opacity="0.03"/><rect x="6" y="0" width="6" height="3" rx="1" fill="currentColor" fill-opacity="0.04"/><rect x="16" y="3" width="28" height="6" rx="1.5" fill="currentColor" fill-opacity="0.05"/><rect x="22" y="6" width="4" height="10" rx="1"/><rect x="36" y="6" width="6" height="10" rx="1"/><line x1="-4" y1="8" x2="-10" y2="14" stroke-width="1.5"/><line x1="-10" y1="14" x2="-16" y2="11" stroke-width="1.5"/><rect x="16" y="1" width="6" height="3" rx="1"/></g>' },
  { type: 'potion', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><rect x="14" y="8" width="20" height="38" rx="4" fill="currentColor" fill-opacity="0.04"/><rect x="18" y="2" width="12" height="10" rx="3" fill="currentColor" fill-opacity="0.04"/><line x1="24" y1="18" x2="24" y2="40" stroke-width="1.5"/><line x1="15" y1="30" x2="33" y2="30" stroke-width="1.5"/><line x1="15" y1="24" x2="33" y2="24" stroke-width="0.8" stroke-opacity="0.4"/><line x1="15" y1="36" x2="33" y2="36" stroke-width="0.8" stroke-opacity="0.4"/></g>' },
  { type: 'headset', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><path d="M14 12c-18 0-32 14-32 32v20c0 7 5.5 12.5 12.5 12.5h5c7 0 12.5-5.5 12.5-12.5V40c0-7-5.5-12.5-12.5-12.5H-6"/><path d="M34 12c18 0 32 14 32 32v20c0 7-5.5 12.5-12.5 12.5h-5c-7 0-12.5-5.5-12.5-12.5V40c0-7 5.5-12.5 12.5-12.5H42"/><line x1="-8" y1="46" x2="-8" y2="60"/><line x1="40" y1="46" x2="40" y2="60"/><path d="M-18 38c-5 8-8 17-8 26v-3"/><path d="M50 38c5 8 8 17 8 26v-3"/></g>' },
  { type: 'crown', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><path d="M4 40l10-16 10 8 12-24 12 24 10-8 10 16v12H4V40z" fill="currentColor" fill-opacity="0.03"/><circle cx="14" cy="20" r="2.5" fill="currentColor"/><circle cx="38" cy="8" r="2.5" fill="currentColor"/><circle cx="24" cy="14" r="3" fill="currentColor"/><circle cx="14" cy="40" r="2" fill="currentColor" fill-opacity="0.06"/><circle cx="24" cy="40" r="2" fill="currentColor" fill-opacity="0.06"/><circle cx="34" cy="40" r="2" fill="currentColor" fill-opacity="0.06"/></g>' },
  { type: 'lightning', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><polygon points="28,0 8,28 20,28 12,48 36,20 24,20 32,0" fill="currentColor" fill-opacity="0.08"/></g>' },
  { type: 'ammo', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="1" fill="none"><rect x="6" y="6" width="10" height="34" rx="4" fill="currentColor" fill-opacity="0.06"/><rect x="6" y="2" width="10" height="6" rx="2" fill="currentColor" fill-opacity="0.04"/><rect x="20" y="12" width="10" height="28" rx="4" fill="currentColor" fill-opacity="0.05"/><rect x="20" y="8" width="10" height="6" rx="2" fill="currentColor" fill-opacity="0.03"/><rect x="34" y="18" width="10" height="22" rx="4" fill="currentColor" fill-opacity="0.04"/><rect x="34" y="14" width="10" height="6" rx="2" fill="currentColor" fill-opacity="0.02"/></g>' },
  { type: 'bullseye', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="0.9" fill="none"><circle cx="24" cy="24" r="22" fill="currentColor" fill-opacity="0.02"/><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="4" fill="currentColor" fill-opacity="0.1"/><line x1="24" y1="2" x2="24" y2="8"/><line x1="24" y1="40" x2="24" y2="46"/><line x1="2" y1="24" x2="8" y2="24"/><line x1="40" y1="24" x2="46" y2="24"/></g>' },
  { type: 'medal', w: 48, h: 48, path: '<g stroke="currentColor" stroke-width="0.9" fill="none"><circle cx="24" cy="24" r="20" fill="currentColor" fill-opacity="0.03"/><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="17" stroke-width="0.4" stroke-dasharray="3 2"/><text x="24" y="30" text-anchor="middle" fill="currentColor" fill-opacity="0.15" font-size="16" font-weight="bold">1</text><path d="M12 44l3-8h18l3 8" fill="currentColor" fill-opacity="0.02"/><line x1="24" y1="36" x2="24" y2="48"/></g>' },
];

const AnimatedBackground = () => {
  const bgRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const updateSize = () => {
      setDimensions({ w: window.innerWidth, h: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const objects = useMemo(() => {
    const count = 30;
    const items = [];
    for (let i = 0; i < count; i++) {
      const obj = BG_OBJECTS[i % BG_OBJECTS.length];
      const layer = Math.floor(i / BG_OBJECTS.length);
      const depth = layer === 0 ? 0.3 : layer === 1 ? 0.5 : 0.7;
      items.push({
        ...obj,
        id: i,
        x: Math.random() * dimensions.w,
        y: Math.random() * dimensions.h,
        size: 28 + Math.random() * 36,
        speed: 0.3 + Math.random() * 0.6,
        delay: Math.random() * 40,
        opacity: 0.02 + Math.random() * 0.06 + depth * 0.03,
        rotation: Math.random() * 360,
        rotateSpeed: -0.3 + Math.random() * 0.6,
        depth,
        blur: (1 - depth) * 2.5,
      });
    }
    return items;
  }, [dimensions]);

  return (
    <div ref={bgRef} className="animated-bg" aria-hidden="true">
      <div className="animated-bg-gradient" />
      {objects.map((obj) => {
        const parallaxX = (mousePos.x - dimensions.w / 2) * obj.depth * 0.03;
        const parallaxY = (mousePos.y - dimensions.h / 2) * obj.depth * 0.03;
        const floatY = Math.sin(Date.now() * 0.001 * obj.speed + obj.delay) * 20 * obj.depth;
        const floatX = Math.cos(Date.now() * 0.0007 * obj.speed + obj.delay) * 15 * obj.depth;
        const rot = obj.rotation + Date.now() * 0.0003 * obj.rotateSpeed;
        const color = obj.depth > 0.5 ? 'var(--cyan)' : obj.depth > 0.4 ? 'var(--purple)' : 'rgba(255,255,255,0.8)';

        return (
          <div
            key={obj.id}
            className="bg-float-object"
            style={{
              position: 'absolute',
              left: obj.x + parallaxX + floatX,
              top: obj.y + parallaxY + floatY,
              width: obj.size,
              height: obj.size,
              opacity: obj.opacity,
              transform: `rotate(${rot}deg)`,
              filter: `blur(${obj.blur}px)`,
              color,
              transition: 'left 0.1s ease-out, top 0.1s ease-out',
              pointerEvents: 'none',
              willChange: 'transform',
            }}
          >
            <svg viewBox={`0 0 ${obj.w} ${obj.h}`} width={obj.size} height={obj.size} style={{ display: 'block' }}>
              <g dangerouslySetInnerHTML={{ __html: obj.path }} />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export default AnimatedBackground;
