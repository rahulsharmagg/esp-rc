import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { BLEController } from '../lib/ble';
import { Zap, OctagonAlert } from 'lucide-react';

interface Props {
  ble: BLEController;
}

const HANDLE_PADDING_PX = 13;

const getThrottleGradient = (pct: number): string => {
  if (pct < 35) {
    return 'linear-gradient(0deg, #16a34a 0%, #22c55e 100%)';
  } else if (pct < 70) {
    return 'linear-gradient(0deg, #16a34a 0%, #f59e0b 100%)';
  } else {
    return 'linear-gradient(0deg, #16a34a 0%, #f59e0b 50%, #dc2626 100%)';
  }
};

export const ThrottleQuadrant: React.FC<Props> = ({ ble }) => {
  const trackElRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const fillBarRef = useRef<HTMLDivElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const vuMeterRef = useRef<HTMLDivElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const lastBleSendTimeRef = useRef<number>(0);
  const pendingSpeedRef = useRef<number>(ble.currentSpeed);
  const bleSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Directly update DOM elements for zero-latency, 120 FPS buttery-smooth response
  const updateVisuals = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0, Math.min(255, speed));
    const pct = Math.round((clampedSpeed / 255) * 100);

    if (handleRef.current) {
      handleRef.current.style.top = `calc(${HANDLE_PADDING_PX}px + ${(100 - pct) / 100} * (100% - ${HANDLE_PADDING_PX * 2}px))`;
      handleRef.current.setAttribute('aria-valuenow', String(clampedSpeed));
    }

    if (fillBarRef.current) {
      fillBarRef.current.style.height = `${pct}%`;
      fillBarRef.current.style.background = getThrottleGradient(pct);
    }

    if (readoutRef.current) {
      readoutRef.current.textContent = `${clampedSpeed} (${pct}%)`;
    }

    if (vuMeterRef.current) {
      const segments = vuMeterRef.current.children;
      for (let i = 0; i < segments.length; i++) {
        const segNum = 10 - i;
        const seg = segments[i] as HTMLElement;
        if (pct >= segNum * 10 - 5) {
          seg.classList.add('active');
        } else {
          seg.classList.remove('active');
        }
      }
    }
  }, []);

  // Sync visuals whenever ble.currentSpeed updates externally (e.g. Turbo, Brake, reconnect)
  useEffect(() => {
    if (!isDraggingRef.current) {
      updateVisuals(ble.currentSpeed);
    }
  }, [ble.currentSpeed, updateVisuals]);

  // Clean up any pending BLE timer on unmount
  useEffect(() => {
    return () => {
      if (bleSendTimerRef.current) {
        clearTimeout(bleSendTimerRef.current);
        bleSendTimerRef.current = null;
      }
    };
  }, []);

  // Throttled BLE command dispatcher to prevent saturating GATT buffer or UI thread
  const dispatchBleSpeed = (speed: number, force = false) => {
    const now = performance.now();
    pendingSpeedRef.current = speed;

    if (force || now - lastBleSendTimeRef.current >= 40) {
      if (bleSendTimerRef.current) {
        clearTimeout(bleSendTimerRef.current);
        bleSendTimerRef.current = null;
      }
      lastBleSendTimeRef.current = now;
      ble.sendSpeed(speed);
    } else if (!bleSendTimerRef.current) {
      const wait = Math.max(10, 40 - (now - lastBleSendTimeRef.current));
      bleSendTimerRef.current = setTimeout(() => {
        bleSendTimerRef.current = null;
        lastBleSendTimeRef.current = performance.now();
        ble.sendSpeed(pendingSpeedRef.current);
      }, wait);
    }
  };

  const calculateSpeedFromY = (clientY: number): number => {
    if (!trackElRef.current) return ble.currentSpeed;
    const rect = trackElRef.current.getBoundingClientRect();
    const topBound = rect.top + HANDLE_PADDING_PX;
    const botBound = rect.bottom - HANDLE_PADDING_PX;
    const clampedY = Math.max(topBound, Math.min(botBound, clientY));
    const ratio = (botBound - clampedY) / (botBound - topBound);
    return Math.round(Math.max(0, Math.min(255, ratio * 255)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    const track = trackElRef.current;
    if (!track) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    activePointerIdRef.current = e.pointerId;

    try {
      track.setPointerCapture(e.pointerId);
    } catch (_) {}

    const speed = calculateSpeedFromY(e.clientY);
    updateVisuals(speed);
    dispatchBleSpeed(speed, true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    e.preventDefault();

    const speed = calculateSpeedFromY(e.clientY);
    updateVisuals(speed);
    dispatchBleSpeed(speed, false);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.pointerId !== activePointerIdRef.current) return;
    e.preventDefault();

    const finalSpeed = calculateSpeedFromY(e.clientY);
    updateVisuals(finalSpeed);

    if (bleSendTimerRef.current) {
      clearTimeout(bleSendTimerRef.current);
      bleSendTimerRef.current = null;
    }
    dispatchBleSpeed(finalSpeed, true);

    try {
      if (trackElRef.current?.hasPointerCapture(e.pointerId)) {
        trackElRef.current.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    isDraggingRef.current = false;
    setIsDragging(false);
    activePointerIdRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let nextSpeed: number | null = null;
    if (e.key === 'ArrowUp') nextSpeed = Math.min(255, ble.currentSpeed + 5);
    else if (e.key === 'ArrowDown') nextSpeed = Math.max(0, ble.currentSpeed - 5);
    else if (e.key === 'PageUp') nextSpeed = Math.min(255, ble.currentSpeed + 25);
    else if (e.key === 'PageDown') nextSpeed = Math.max(0, ble.currentSpeed - 25);
    else if (e.key === 'Home') nextSpeed = 255;
    else if (e.key === 'End') nextSpeed = 0;

    if (nextSpeed !== null) {
      e.preventDefault();
      updateVisuals(nextSpeed);
      dispatchBleSpeed(nextSpeed, true);
    }
  };

  const onTurboDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    ble.setTurbo(true);
  };

  const onTurboUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if ((e.currentTarget as HTMLElement)?.hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      }
    } catch (_) {}
    ble.setTurbo(false);
  };

  const onBrake = (e: React.MouseEvent) => {
    e.preventDefault();
    updateVisuals(0);
    ble.sendSpeed(0);
    ble.sendCommand('S', true);
    ble.vibrate([60, 40, 60]);
    ble.log('🛑 EMERGENCY STOP ACTIVATED', 'error');
  };

  const initialPct = Math.round((ble.currentSpeed / 255) * 100);

  return (
    <div className="throttle-vertical-container" onContextMenu={(e) => e.preventDefault()}>
      {/* Title & Speed Readout */}
      <div className="throttle-title-row">
        <span className="throttle-title-text">
          <span className="cockpit-dot"></span>
          THROTTLE QUADRANT
        </span>
        <span className="pwm-readout" ref={readoutRef}>
          {ble.currentSpeed} ({initialPct}%)
        </span>
      </div>

      {/* Vertical Throttle Body */}
      <div className="throttle-vertical-body">
        {/* 1. 10-Segment VU Meter Column */}
        <div className="throttle-vu-meter" ref={vuMeterRef}>
          {Array.from({ length: 10 }).map((_, idx) => {
            const segNum = 10 - idx;
            return (
              <div 
                key={segNum} 
                className={`vu-segment seg-${segNum} ${initialPct >= segNum * 10 - 5 ? 'active' : ''}`}
              ></div>
            );
          })}
        </div>

        {/* 2. Mechanical Throttle Lever Track (Captures all touches/clicks across track) */}
        <div 
          className={`throttle-lever-track ${isDragging ? 'dragging' : ''}`}
          ref={trackElRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{ touchAction: 'none' }}
        >
          <div className="lever-track-slot">
            <div 
              ref={fillBarRef}
              className="lever-fill-bar" 
              style={{ 
                height: `${initialPct}%`, 
                background: getThrottleGradient(initialPct) 
              }}
            ></div>
          </div>

          <div className="lever-graduations">
            <span className="grad-mark" data-val="255">255</span>
            <span className="grad-mark" data-val="190">190</span>
            <span className="grad-mark" data-val="128">128</span>
            <span className="grad-mark" data-val="64">64</span>
            <span className="grad-mark" data-val="0">0</span>
          </div>

          {/* Machined Heavy-Duty Handle Grip */}
          <div 
            ref={handleRef}
            className={`throttle-handle ${isDragging ? 'dragging' : ''}`} 
            style={{ 
              top: `calc(${HANDLE_PADDING_PX}px + ${(100 - initialPct) / 100} * (100% - ${HANDLE_PADDING_PX * 2}px))` 
            }}
            role="slider"
            aria-label="Throttle Lever Handle"
            aria-valuenow={ble.currentSpeed}
            aria-valuemin={0}
            aria-valuemax={255}
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            <div className="handle-grip-ribs">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="handle-center-glow"></div>
            <div className="handle-grip-ribs">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        {/* 3. Right Action Column: TURBO on top, STOP directly below */}
        <div className="throttle-actions-col">
          <button 
            type="button"
            className={`btn-turbo-boost ${ble.isTurbo ? 'turbo-active' : ''}`} 
            title="Hold for Turbo Boost (255 PWM)"
            onPointerDown={onTurboDown}
            onPointerUp={onTurboUp}
            onPointerCancel={onTurboUp}
          >
            <Zap size={15} strokeWidth={2.5} className="turbo-bolt" fill="currentColor" />
            <span className="turbo-lbl">TURBO</span>
          </button>

          <button 
            type="button"
            className="emergency-brake-btn" 
            title="Emergency Stop All Motors" 
            onClick={onBrake}
          >
            <OctagonAlert size={14} strokeWidth={2.5} />
            <span className="brake-lbl">STOP</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThrottleQuadrant;
