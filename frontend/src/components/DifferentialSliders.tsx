import React, { useRef, useState } from 'react';
import type { BLEController } from '../lib/ble';

interface Props {
  ble: BLEController;
}

const HANDLE_PADDING_PX = 13;

export const DifferentialSliders: React.FC<Props> = ({ ble }) => {
  const [leftVal, setLeftVal] = useState(0);
  const [rightVal, setRightVal] = useState(0);

  const [isLeftDragging, setIsLeftDragging] = useState(false);
  const [isRightDragging, setIsRightDragging] = useState(false);

  const leftTrackElRef = useRef<HTMLDivElement | null>(null);
  const rightTrackElRef = useRef<HTMLDivElement | null>(null);

  const activeLeftPointerIdRef = useRef<number | null>(null);
  const activeRightPointerIdRef = useRef<number | null>(null);

  const updateTrackFromY = (trackEl: HTMLDivElement | null, clientY: number): number => {
    if (!trackEl) return 0;
    const rect = trackEl.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const maxTravel = Math.max(10, rect.height / 2 - HANDLE_PADDING_PX);

    let dy = clientY - centerY;
    dy = Math.max(-maxTravel, Math.min(maxTravel, dy));

    const norm = -dy / maxTravel;
    const deadzone = 0.08;

    if (Math.abs(norm) < deadzone) return 0;
    return Math.round(norm * 255);
  };

  const syncCommands = (left: number, right: number) => {
    if (left === 0 && right === 0) {
      ble.sendCommand('S');
    } else {
      ble.sendCommand(`D:${right},${left}`);
    }
  };

  // Left Lever Events
  const onLeftPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (ble.driveMode !== 'MANUAL') {
      ble.setDriveMode('MANUAL');
    }
    const target = e.currentTarget;
    setIsLeftDragging(true);
    activeLeftPointerIdRef.current = e.pointerId;
    try {
      target.setPointerCapture(e.pointerId);
    } catch (_) {}
    const val = updateTrackFromY(leftTrackElRef.current, e.clientY);
    setLeftVal(val);
    syncCommands(val, rightVal);
    ble.vibrate(10);
  };

  const onLeftPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLeftDragging && e.pointerId === activeLeftPointerIdRef.current) {
      e.preventDefault();
      const val = updateTrackFromY(leftTrackElRef.current, e.clientY);
      setLeftVal(val);
      syncCommands(val, rightVal);
    }
  };

  const onLeftPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLeftDragging && e.pointerId === activeLeftPointerIdRef.current) {
      e.preventDefault();
      setIsLeftDragging(false);
      activeLeftPointerIdRef.current = null;
      setLeftVal(0);
      syncCommands(0, rightVal);
      ble.vibrate(8);
    }
  };

  // Right Lever Events
  const onRightPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (ble.driveMode !== 'MANUAL') {
      ble.setDriveMode('MANUAL');
    }
    const target = e.currentTarget;
    setIsRightDragging(true);
    activeRightPointerIdRef.current = e.pointerId;
    try {
      target.setPointerCapture(e.pointerId);
    } catch (_) {}
    const val = updateTrackFromY(rightTrackElRef.current, e.clientY);
    setRightVal(val);
    syncCommands(leftVal, val);
    ble.vibrate(10);
  };

  const onRightPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRightDragging && e.pointerId === activeRightPointerIdRef.current) {
      e.preventDefault();
      const val = updateTrackFromY(rightTrackElRef.current, e.clientY);
      setRightVal(val);
      syncCommands(leftVal, val);
    }
  };

  const onRightPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRightDragging && e.pointerId === activeRightPointerIdRef.current) {
      e.preventDefault();
      setIsRightDragging(false);
      activeRightPointerIdRef.current = null;
      setRightVal(0);
      syncCommands(leftVal, 0);
      ble.vibrate(8);
    }
  };

  const formatReadout = (val: number): string => {
    if (val === 0) return 'IDLE (0)';
    const pct = Math.round((Math.abs(val) / 255) * 100);
    return val > 0 ? `+${val} (${pct}%)` : `${val} (${pct}%)`;
  };

  return (
    <div className="diff-quadrant-container" onContextMenu={(e) => e.preventDefault()}>
      {/* Top Header: Equal Width Left/Right Readouts */}
      <div className="diff-title-row">
        <div className="diff-channel-head">
          <span className="channel-title">
            <span className="cockpit-dot"></span>
            TRACK L
          </span>
          <span className={`diff-pwm-readout ${leftVal > 0 ? 'fwd' : leftVal < 0 ? 'rev' : ''}`}>
            {formatReadout(leftVal)}
          </span>
        </div>

        <div className="diff-channel-divider"></div>

        <div className="diff-channel-head">
          <span className="channel-title">
            <span className="cockpit-dot"></span>
            TRACK R
          </span>
          <span className={`diff-pwm-readout ${rightVal > 0 ? 'fwd' : rightVal < 0 ? 'rev' : ''}`}>
            {formatReadout(rightVal)}
          </span>
        </div>
      </div>

      {/* Main Dual Throttle Bays Body */}
      <div className="diff-quadrant-body">
        {/* ===================================================================
             1. LEFT MOTOR LEVER BAY
             =================================================================== */}
        <div 
          className="diff-lever-column"
          ref={leftTrackElRef}
          role="slider"
          aria-label="Left Motor Differential Throttle Lever"
          aria-valuenow={leftVal}
          aria-valuemin={-255}
          aria-valuemax={255}
          tabIndex={0}
          onPointerDown={onLeftPointerDown}
          onPointerMove={onLeftPointerMove}
          onPointerUp={onLeftPointerEnd}
          onPointerCancel={onLeftPointerEnd}
        >
          {/* Lever Track Slot */}
          <div className="diff-track-slot">
            <div className="diff-slot-center-line"></div>
            {leftVal > 0 ? (
              <div 
                className="diff-fill-up" 
                style={{ height: `${(leftVal / 255) * 50}%` }}
              ></div>
            ) : leftVal < 0 ? (
              <div 
                className="diff-fill-down" 
                style={{ height: `${(Math.abs(leftVal) / 255) * 50}%` }}
              ></div>
            ) : null}
          </div>

          {/* Graduations / Tick Marks */}
          <div className="diff-graduations">
            <span className="diff-grad-mark top-mark">+255</span>
            <span className="diff-grad-mark">+128</span>
            <span className="diff-grad-mark center-mark">0</span>
            <span className="diff-grad-mark">-128</span>
            <span className="diff-grad-mark bot-mark">-255</span>
          </div>

          {/* Heavy Machined Handle Grip */}
          <div 
            className={`diff-throttle-handle ${isLeftDragging ? 'dragging' : ''}`}
            style={{
              top: `calc(50% + ${(-leftVal / 255)} * (50% - ${HANDLE_PADDING_PX}px))`
            }}
          >
            <div className="handle-grip-ribs">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className={`handle-center-glow ${leftVal > 0 ? 'glow-green' : leftVal < 0 ? 'glow-red' : ''}`}></div>
            <div className="handle-grip-ribs">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        {/* Tactical Center Divider */}
        <div className="diff-bays-sep"></div>

        {/* ===================================================================
             2. RIGHT MOTOR LEVER BAY
             =================================================================== */}
        <div 
          className="diff-lever-column"
          ref={rightTrackElRef}
          role="slider"
          aria-label="Right Motor Differential Throttle Lever"
          aria-valuenow={rightVal}
          aria-valuemin={-255}
          aria-valuemax={255}
          tabIndex={0}
          onPointerDown={onRightPointerDown}
          onPointerMove={onRightPointerMove}
          onPointerUp={onRightPointerEnd}
          onPointerCancel={onRightPointerEnd}
        >
          {/* Lever Track Slot */}
          <div className="diff-track-slot">
            <div className="diff-slot-center-line"></div>
            {rightVal > 0 ? (
              <div 
                className="diff-fill-up" 
                style={{ height: `${(rightVal / 255) * 50}%` }}
              ></div>
            ) : rightVal < 0 ? (
              <div 
                className="diff-fill-down" 
                style={{ height: `${(Math.abs(rightVal) / 255) * 50}%` }}
              ></div>
            ) : null}
          </div>

          {/* Graduations / Tick Marks */}
          <div className="diff-graduations">
            <span className="diff-grad-mark top-mark">+255</span>
            <span className="diff-grad-mark">+128</span>
            <span className="diff-grad-mark center-mark">0</span>
            <span className="diff-grad-mark">-128</span>
            <span className="diff-grad-mark bot-mark">-255</span>
          </div>

          {/* Heavy Machined Handle Grip */}
          <div 
            className={`diff-throttle-handle ${isRightDragging ? 'dragging' : ''}`}
            style={{
              top: `calc(50% + ${(-rightVal / 255)} * (50% - ${HANDLE_PADDING_PX}px))`
            }}
          >
            <div className="handle-grip-ribs">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className={`handle-center-glow ${rightVal > 0 ? 'glow-green' : rightVal < 0 ? 'glow-red' : ''}`}></div>
            <div className="handle-grip-ribs">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DifferentialSliders;
