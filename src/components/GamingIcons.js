import React, { useMemo, useEffect, useRef } from 'react';
import gameController from '../assets/game-controller.png';
import headphone from '../assets/headphone.png';
import keyboardImg from '../assets/keyboard.png';
import mouseImg from '../assets/mouse.png';
import pistol from '../assets/pistol.png';
import rifle from '../assets/rifle.png';

const ICONS = [
  gameController, headphone, keyboardImg, mouseImg, pistol, rifle,
];

const ICON_COUNT = 60;

const AnimatedBackground = () => {
  const bgRef = useRef(null);
  const dimsRef = useRef({ w: 1920, h: 1080 });
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onResize = () => { dimsRef.current = { w: window.innerWidth, h: window.innerHeight }; };
    const onMouse = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  const objects = useMemo(() => {
    const items = [];
    for (let i = 0; i < ICON_COUNT; i++) {
      const src = ICONS[i % ICONS.length];
      items.push({
        id: i, src,
        x: Math.random() * dimsRef.current.w,
        y: Math.random() * dimsRef.current.h,
        size: 20 + Math.random() * 30,
        speed: 0.1 + Math.random() * 0.3,
        delay: Math.random() * 60,
        opacity: 0.025 + Math.random() * 0.04,
        rotation: Math.random() * 360,
        rotSpeed: -0.2 + Math.random() * 0.4,
      });
    }
    return items;
  }, []);

  return (
    <div ref={bgRef} className="animated-bg" aria-hidden="true">
      {objects.map((obj) => {
        const d = dimsRef.current;
        const m = mouseRef.current;
        const now = Date.now();
        const px = (m.x - d.w / 2) * 0.01;
        const py = (m.y - d.h / 2) * 0.01;
        const fy = Math.sin(now * 0.0005 * obj.speed + obj.delay) * 15;
        const fx = Math.cos(now * 0.0004 * obj.speed + obj.delay) * 10;
        const rot = obj.rotation + now * 0.0001 * obj.rotSpeed;

        return (
          <img
            key={obj.id}
            src={obj.src}
            alt=""
            style={{
              position: 'absolute',
              left: obj.x + px + fx,
              top: obj.y + py + fy,
              width: obj.size,
              height: obj.size,
              opacity: obj.opacity,
              transform: `rotate(${rot}deg)`,
              filter: 'grayscale(1) brightness(2) contrast(0.3)',
              pointerEvents: 'none',
              willChange: 'transform',
              objectFit: 'contain',
            }}
          />
        );
      })}
    </div>
  );
};

export default AnimatedBackground;
