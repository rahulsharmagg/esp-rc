import React, { useState } from 'react';
import type { BLEController } from '../lib/ble';
import type { ControlMode } from '../lib/types';
import { Gamepad2, Bot } from 'lucide-react';
import Joystick from './Joystick';
import DPad from './DPad';
import DifferentialSliders from './DifferentialSliders';

interface Props {
  ble: BLEController;
}

export const LeftControls: React.FC<Props> = ({ ble }) => {
  const [controlMode, setControlMode] = useState<ControlMode>('joystick');

  const selectControlMode = (mode: ControlMode) => {
    setControlMode(mode);
    ble.sendCommand('S', true);
    ble.vibrate(10);
  };

  return (
    <section className="panel-left">
      {/* Mode Selector Header */}
      <div className="drive-mode-bar">
        <button 
          type="button"
          className={`mode-switch-btn ${ble.driveMode === 'MANUAL' ? 'active' : ''}`} 
          onClick={() => ble.setDriveMode('MANUAL')}
        >
          <Gamepad2 size={13} strokeWidth={2.5} />
          <span>MANUAL</span>
        </button>

        <button 
          type="button"
          className={`mode-switch-btn ${ble.driveMode === 'AUTOMATIC' ? 'active' : ''}`} 
          onClick={() => ble.setDriveMode('AUTOMATIC')}
        >
          <Bot size={13} strokeWidth={2.5} />
          <span>AUTO AVOID</span>
        </button>
      </div>

      {/* Control Type Tabs */}
      <div className="control-type-tabs">
        <button 
          type="button"
          className={`type-tab ${controlMode === 'joystick' ? 'active' : ''}`} 
          onClick={() => selectControlMode('joystick')}
        >
          JOYSTICK
        </button>

        <button 
          type="button"
          className={`type-tab ${controlMode === 'dpad' ? 'active' : ''}`} 
          onClick={() => selectControlMode('dpad')}
        >
          BUTTONS
        </button>

        <button 
          type="button"
          className={`type-tab ${controlMode === 'differential' ? 'active' : ''}`} 
          onClick={() => selectControlMode('differential')}
        >
          DIFFERENTIAL
        </button>
      </div>

      {/* Touch Control Viewport */}
      <div className="touch-control-viewport">
        {controlMode === 'joystick' && <Joystick ble={ble} />}
        {controlMode === 'dpad' && <DPad ble={ble} />}
        {controlMode === 'differential' && <DifferentialSliders ble={ble} />}
      </div>
    </section>
  );
};

export default LeftControls;
