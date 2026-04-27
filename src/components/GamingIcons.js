import React, { useMemo, useEffect, useRef, useState } from 'react';
import gameController from '../assets/game-controller.png';
import headphone from '../assets/headphone.png';
import keyboardImg from '../assets/keyboard.png';
import mouseImg from '../assets/mouse.png';
import pistol from '../assets/pistol.png';
import rifle from '../assets/rifle.png';
import battle from '../assets/battle.png';

const ICONS = [
  { src: gameController, name: 'controller' },
  { src: headphone, name: 'headphone' },
  { src: keyboardImg, name: 'keyboard' },
  { src: mouseImg, name: 'mouse' },
  { src: pistol, name: 'pistol' },
  { src: rifle, name: 'rifle' },
  { src: battle, name: 'battle' },
];

const COLORS = [
  'rgba(46, 242, 255, VAR)',
  'rgba(168, 85, 247, VAR)',
  'rgba(255, 79, 216, VAR)',
  'rgba(46, 242, 255, VAR)',
  'rgba(29, 174, 255, VAR)',
  'rgba(168, 85, 247, VAR)',
  'rgba(255, 79, 216, VAR)',
];

const AnimatedBackground = () => {
  const bgRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dims, setDims] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    const onMouse = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  const objects = useMemo(() => {
    const items = [];
    for (let i = 0; i < 45; i++) {
      const icon = ICONS[i % ICONS.length];
      const depth = 0.2 + Math.random() * 0.5;
      items.push({
        ...icon,
        id: i,
        x: Math.random() * dims.w,
        y: Math.random() * dims.h,
        size: 40 + Math.random() * 70,
        speed: 0.2 + Math.random() * 0.7,
        delay: Math.random() * 50,
        opacity: 0.06 + Math.random() * 0.1,
        rotation: Math.random() * 360,
        rotSpeed: -0.4 + Math.random() * 0.8,
        depth,
        blur: (1 - depth) * 3,
        color: COLORS[i % COLORS.length].replace('VAR', String(0.2 + Math.random() * 0.4)),
      });
    }
    return items;
  }, [dims]);

  return (
    <div ref={bgRef} className="animated-bg" aria-hidden="true">
      <div className="animated-bg-gradient" />
      {objects.map((obj) => {
        const px = (mousePos.x - dims.w / 2) * obj.depth * 0.025;
        const py = (mousePos.y - dims.h / 2) * obj.depth * 0.025;
        const fy = Math.sin(Date.now() * 0.0008 * obj.speed + obj.delay) * 25 * obj.depth;
        const fx = Math.cos(Date.now() * 0.0006 * obj.speed + obj.delay) * 18 * obj.depth;
        const rot = obj.rotation + Date.now() * 0.0002 * obj.rotSpeed;

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
                filter: `blur(${obj.blur}px) brightness(1.8) saturate(0.6)`,
              pointerEvents: 'none',
              willChange: 'transform',
              objectFit: 'contain',
              transition: 'none',
            }}
          />
        );
      })}
    </div>
  );
};

export default AnimatedBackground;
