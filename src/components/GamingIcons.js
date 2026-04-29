import React, { useMemo } from 'react';
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

const GRID_COLS = 10;
const GRID_ROWS = 6;
const TOTAL = GRID_COLS * GRID_ROWS;

const AnimatedBackground = () => {
  const objects = useMemo(() => {
    const items = [];
    for (let i = 0; i < TOTAL; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cx = (col + 0.5) / GRID_COLS * 100;
      const cy = (row + 0.5) / GRID_ROWS * 100;
      const jitterX = (Math.random() - 0.5) * 7.5;
      const jitterY = (Math.random() - 0.5) * 7.5;
      const layer = i % 3;
      items.push({
        id: i,
        src: ICONS[Math.floor(Math.random() * ICONS.length)],
        layer,
        baseX: cx + jitterX,
        baseY: cy + jitterY,
        size: 26 + Math.random() * 36,
        opacity: 0.08 + Math.random() * 0.1,
        rotation: -26 + Math.random() * 52,
        driftX: 10 + Math.random() * 22,
        driftY: 8 + Math.random() * 20,
        driftDuration: 14 + Math.random() * 20,
        driftDelay: Math.random() * 10,
      });
    }
    return items;
  }, []);

  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="animated-bg-topfade" />
      <div className="animated-bg-vignette" />
      <div className="animated-bg-glow" />
      <div className="animated-bg-pattern">
        {objects.map((obj) => (
          <img
            key={obj.id}
            src={obj.src}
            alt=""
            style={{
              left: `${obj.baseX}%`,
              top: `${obj.baseY}%`,
              width: obj.size,
              height: obj.size,
              opacity: obj.opacity,
              '--rot': `${obj.rotation}deg`,
              '--driftX': `${obj.layer === 0 ? obj.driftX * 0.6 : obj.layer === 1 ? obj.driftX : obj.driftX * 1.25}px`,
              '--driftY': `${obj.layer === 0 ? obj.driftY * 0.6 : obj.layer === 1 ? obj.driftY : obj.driftY * 1.25}px`,
              animationDuration: `${obj.driftDuration}s`,
              animationDelay: `-${obj.driftDelay}s`,
            }}
            className={`bg-icon layer-${obj.layer}`}
          />
        ))}
      </div>
    </div>
  );
};

export default AnimatedBackground;
