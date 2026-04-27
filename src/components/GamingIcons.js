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

const TINTS = [
  'sepia(1) hue-rotate(160deg) saturate(2) brightness(1.2)',    // cyan
  'sepia(1) hue-rotate(240deg) saturate(1.5) brightness(1.2)',   // purple
  'sepia(1) hue-rotate(300deg) saturate(1.5) brightness(1.2)',   // magenta
  'sepia(1) hue-rotate(180deg) saturate(2) brightness(1.2)',     // blue
  'sepia(1) hue-rotate(280deg) saturate(1.5) brightness(1.2)',   // violet
  'sepia(1) hue-rotate(150deg) saturate(2) brightness(1.2)',     // teal
  'sepia(1) hue-rotate(250deg) saturate(1.5) brightness(1.2)',   // pink-purple
];

const ICON_COUNT = 25;

const AnimatedBackground = () => {
  const [, forceUpdate] = useState(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const startTime = useRef(Date.now());
  const frameRef = useRef(null);

  const objects = useMemo(() => {
    const items = [];
    for (let i = 0; i < ICON_COUNT; i++) {
      const icon = ICONS[i % ICONS.length];
      items.push({
        ...icon,
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 40 + Math.random() * 60,
        speedX: -0.3 + Math.random() * 0.6,
        speedY: -0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.12 + Math.random() * 0.15,
        rotation: Math.random() * 360,
        rotSpeed: -0.5 + Math.random() * 1,
        wobbleAmp: 10 + Math.random() * 20,
        wobbleFreq: 0.3 + Math.random() * 0.5,
        tint: TINTS[i % TINTS.length],
        layer: Math.floor(i / 5) * 0.15 + 0.1,
      });
    }
    return items;
  }, []);

  useEffect(() => {
    const onMouse = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMouse);

    const animate = () => {
      forceUpdate(n => n + 1);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouse);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const elapsed = Date.now() - startTime.current;

  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="animated-bg-glow" />
      {objects.map((obj) => {
        const mx = mouseRef.current.x / window.innerWidth - 0.5;
        const my = mouseRef.current.y / window.innerHeight - 0.5;
        const px = obj.x + mx * obj.layer * 8;
        const py = obj.y + my * obj.layer * 8;
        const fx = Math.sin(elapsed * 0.0005 * obj.wobbleFreq + obj.phase) * obj.wobbleAmp * 0.01 * obj.layer + elapsed * 0.00005 * obj.speedX * 50;
        const fy = Math.cos(elapsed * 0.0004 * obj.wobbleFreq + obj.phase * 1.3) * obj.wobbleAmp * 0.01 * obj.layer + elapsed * 0.00005 * obj.speedY * 50;
        const rot = obj.rotation + elapsed * 0.00005 * obj.rotSpeed;

        return (
          <img
            key={obj.id}
            src={obj.src}
            alt=""
            style={{
              position: 'absolute',
              left: `calc(${px}% + ${fx}px)`,
              top: `calc(${py}% + ${fy}px)`,
              width: obj.size,
              height: obj.size,
              opacity: obj.opacity,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              filter: obj.tint,
              pointerEvents: 'none',
              willChange: 'transform, left, top',
              objectFit: 'contain',
            }}
          />
        );
      })}
    </div>
  );
};

export default AnimatedBackground;
