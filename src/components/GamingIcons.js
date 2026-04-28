import React, { useMemo, useEffect, useRef, useState } from 'react';
import gameController from '../assets/game-controller.png';
import headphone from '../assets/headphone.png';
import keyboardImg from '../assets/keyboard.png';
import mouseImg from '../assets/mouse.png';
import pistol from '../assets/pistol.png';
import rifle from '../assets/rifle.png';
import battle from '../assets/battle.png';

const ICONS = [
  gameController, headphone, keyboardImg, mouseImg, pistol, rifle, battle,
];

const TINTS = [
  'sepia(1) hue-rotate(160deg) saturate(4) brightness(1.5)',   // cyan
  'sepia(1) hue-rotate(250deg) saturate(3.5) brightness(1.4)',  // purple
  'sepia(1) hue-rotate(300deg) saturate(3.5) brightness(1.4)',  // magenta
  'sepia(1) hue-rotate(195deg) saturate(4) brightness(1.5)',    // blue
  'sepia(1) hue-rotate(270deg) saturate(3.5) brightness(1.4)',  // violet
  'sepia(1) hue-rotate(160deg) saturate(4) brightness(1.5)',    // cyan
  'sepia(1) hue-rotate(250deg) saturate(3.5) brightness(1.4)',  // purple
];

const GRID_COLS = 8;
const GRID_ROWS = 5;
const TOTAL = GRID_COLS * GRID_ROWS;

const AnimatedBackground = () => {
  const [, forceUpdate] = useState(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const startTime = useRef(Date.now());
  const frameRef = useRef(null);

  const objects = useMemo(() => {
    const items = [];
    for (let i = 0; i < TOTAL; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cx = (col + 0.5) / GRID_COLS * 100;
      const cy = (row + 0.5) / GRID_ROWS * 100;
      const jitterX = (Math.random() - 0.5) * (100 / GRID_COLS) * 0.6;
      const jitterY = (Math.random() - 0.5) * (100 / GRID_ROWS) * 0.6;
      items.push({
        id: i,
        src: ICONS[i % ICONS.length],
        baseX: cx + jitterX,
        baseY: cy + jitterY,
        size: 80 + Math.random() * 120,
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.35 + Math.random() * 0.35,
        rotation: Math.random() * 360,
        rotSpeed: -0.3 + Math.random() * 0.6,
        wobbleAmp: 6 + Math.random() * 10,
        tint: TINTS[i % TINTS.length],
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
        const mx = (mouseRef.current.x / window.innerWidth - 0.5) * 6;
        const my = (mouseRef.current.y / window.innerHeight - 0.5) * 6;
        const wave = Math.sin(elapsed * 0.0006 * obj.speed + obj.phase);
        const wave2 = Math.cos(elapsed * 0.0005 * obj.speed + obj.phase * 1.7);
        const fx = wave * obj.wobbleAmp * 0.15;
        const fy = wave2 * obj.wobbleAmp * 0.15;
        const rot = obj.rotation + elapsed * 0.00003 * obj.rotSpeed;

        return (
          <img
            key={obj.id}
            src={obj.src}
            alt=""
            style={{
              position: 'absolute',
              left: `calc(${obj.baseX}% + ${fx + mx}px)`,
              top: `calc(${obj.baseY}% + ${fy + my}px)`,
              width: obj.size,
              height: obj.size,
              opacity: obj.opacity,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              filter: obj.tint,
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
