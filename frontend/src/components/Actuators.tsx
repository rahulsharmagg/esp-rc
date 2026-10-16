import React, { useState } from 'react';
import type { BLEController } from '../lib/ble';
import { Lightbulb, Volume2, Compass } from 'lucide-react';

interface Props {
  ble: BLEController;
}

const scaleMarks = [
  { angle: 0, label: '0°', isMajor: false },
  { angle: 30, label: '30°', isMajor: false },
  { angle: 60, label: '60°', isMajor: false },
  { angle: 90, label: '90°', isMajor: true },
  { angle: 120, label: '120°', isMajor: false },
  { angle: 150, label: '150°', isMajor: false },
  { angle: 180, label: '180°', isMajor: false },
];

export const Actuators: React.FC<Props> = ({ ble }) => {
  const [showServoSlider, setShowServoSlider] = useState(false);

  const onHornDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    ble.setHorn(true);
  };

  const onHornUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if ((e.currentTarget as HTMLElement)?.hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      }
    } catch (_) {}
    ble.setHorn(false);
  };

  const handleScaleClick = (angle: number) => {
    ble.setServoAngle(angle);
    ble.vibrate(8);
  };

  const getServoDirectionLabel = (angle: number): string => {
    if (angle <= 45) return 'RIGHT';
    if (angle >= 135) return 'LEFT';
    if (angle >= 80 && angle <= 100) return 'CENTER';
    if (angle < 80) return 'MID-RIGHT';
    return 'MID-LEFT';
  };

  return (
    <div className="actuators-container" onContextMenu={(e) => e.preventDefault()}>
      {/* 3-Button Quick Bar */}
      <div className="actuator-quick-bar">
        {/* Headlights Button */}
        <button 
          type="button"
          className={`actuator-btn ${ble.isLightsOn ? 'active' : ''}`} 
          title="Toggle Headlights"
          onClick={() => ble.toggleLights()}
        >
          <Lightbulb size={13} strokeWidth={2.5} />
          <span>LIGHTS</span>
        </button>

        {/* Horn Buzzer Button */}
        <button 
          type="button"
          className={`actuator-btn ${ble.isHornOn ? 'active' : ''}`} 
          title="Horn Buzzer (Hold to sound)"
          onPointerDown={onHornDown}
          onPointerUp={onHornUp}
          onPointerCancel={onHornUp}
        >
          <Volume2 size={13} strokeWidth={2.5} />
          <span>HORN</span>
        </button>

        {/* Servo Angle Manual Toggle Button */}
        <button 
          type="button"
          className={`actuator-btn ${showServoSlider ? 'active' : ''}`} 
          title="Manual Pan Servo Angle Control"
          onClick={() => setShowServoSlider(!showServoSlider)}
        >
          <Compass size={13} strokeWidth={2.5} />
          <span>SERVO</span>
        </button>
      </div>

      {/* Collapsible Manual Servo Slider Box with Exact Center-Aligned Horizontal Scale */}
      {showServoSlider && (
        <div className="servo-slider-box">
          <div className="servo-slider-header">
            <span className="servo-title">PAN SERVO GIMBAL</span>
            <span className="servo-readout">
              <strong>{ble.servoAngle}°</strong> ({getServoDirectionLabel(ble.servoAngle)})
            </span>
          </div>

          <div className="servo-slider-row">
            <input 
              type="range"
              min="0"
              max="180"
              step="1"
              className="servo-range-input"
              value={ble.servoAngle}
              onChange={(e) => ble.setServoAngle(Number(e.target.value))}
            />
          </div>

          {/* Horizontal Calibration Graduation Scale */}
          <div className="servo-horizontal-scale">
            {scaleMarks.map((mark) => (
              <button 
                key={mark.angle}
                type="button" 
                className={`scale-point ${ble.servoAngle === mark.angle ? 'active' : ''}`}
                style={{ left: `calc(7px + (100% - 14px) * (${mark.angle} / 180))` }}
                onClick={() => handleScaleClick(mark.angle)} 
                title={`${mark.angle}°`}
              >
                <span className={`tick-line ${mark.isMajor ? 'major' : ''}`}></span>
                <span className={`tick-lbl ${mark.isMajor ? 'major' : ''}`}>{mark.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Actuators;
