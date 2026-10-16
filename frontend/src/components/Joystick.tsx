import React, { useRef } from 'react';
import type { BLEController } from '../lib/ble';

interface Props {
  ble: BLEController;
}

const maxRadius = 55;

export const Joystick: React.FC<Props> = ({ ble }) => {
  const baseElRef = useRef<HTMLDivElement | null>(null);
  const stickElRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const processMovement = (clientX: number, clientY: number) => {
    if (!baseElRef.current || !stickElRef.current) return;
    const rect = baseElRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    stickElRef.current.style.transform = `translate(${dx}px, ${dy}px)`;

    const normX = dx / maxRadius;
    const normY = -dy / maxRadius;
    const deadzone = 0.25;

    let cmd = 'S';
    if (Math.abs(normX) < deadzone && Math.abs(normY) < deadzone) {
      cmd = 'S';
    } else {
      if (ble.driveMode !== 'MANUAL') {
        ble.setDriveMode('MANUAL');
      }

      const angle = Math.atan2(normY, normX) * (180 / Math.PI);
      if (angle >= 67.5 && angle < 112.5) cmd = 'F';
      else if (angle >= 22.5 && angle < 67.5) cmd = 'I';
      else if (angle >= -22.5 && angle < 22.5) cmd = 'R';
      else if (angle >= -67.5 && angle < -22.5) cmd = 'J';
      else if (angle >= -112.5 && angle < -67.5) cmd = 'B';
      else if (angle >= -157.5 && angle < -112.5) cmd = 'H';
      else if (angle >= 112.5 && angle < 157.5) cmd = 'G';
      else cmd = 'L';
    }

    ble.sendCommand(cmd);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!baseElRef.current) return;
    activePointerIdRef.current = e.pointerId;
    try {
      baseElRef.current.setPointerCapture(e.pointerId);
    } catch (_) {}
    processMovement(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === activePointerIdRef.current) {
      e.preventDefault();
      e.stopPropagation();
      processMovement(e.clientX, e.clientY);
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === activePointerIdRef.current) {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (baseElRef.current?.hasPointerCapture?.(e.pointerId)) {
          baseElRef.current.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
      activePointerIdRef.current = null;
      if (stickElRef.current) stickElRef.current.style.transform = 'translate(0px, 0px)';
      ble.sendCommand('S', true);
    }
  };

  return (
    <div className="joystick-surface" onContextMenu={(e) => e.preventDefault()}>
      <div 
        className="joystick-outer-ring" 
        ref={baseElRef}
        role="slider"
        aria-label="Directional Joystick"
        aria-valuenow={0}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div className="cross-h"></div>
        <div className="cross-v"></div>
        <div className="joystick-knob" ref={stickElRef}>
          <div className="knob-dot"></div>
        </div>
      </div>
    </div>
  );
};

export default Joystick;
