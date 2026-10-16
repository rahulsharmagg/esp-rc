import React from 'react';
import type { BLEController } from '../lib/ble';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  Square
} from 'lucide-react';

interface Props {
  ble: BLEController;
}

export const DPad: React.FC<Props> = ({ ble }) => {
  const startCmd = (cmd: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
    if (ble.driveMode !== 'MANUAL') {
      ble.setDriveMode('MANUAL');
    }
    ble.sendCommand(cmd, true);
    ble.vibrate(15);
  };

  const stopCmd = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    ble.sendCommand('S', true);
  };

  return (
    <div className="dpad-surface" onContextMenu={(e) => e.preventDefault()}>
      <button 
        type="button"
        className="d-btn diag" 
        onPointerDown={(e) => startCmd('G', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Forward Left"
      >
        <ArrowUpLeft size={16} strokeWidth={2.4} />
      </button>

      <button 
        type="button"
        className="d-btn card" 
        onPointerDown={(e) => startCmd('F', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Forward"
      >
        <ArrowUp size={20} strokeWidth={2.8} />
      </button>

      <button 
        type="button"
        className="d-btn diag" 
        onPointerDown={(e) => startCmd('I', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Forward Right"
      >
        <ArrowUpRight size={16} strokeWidth={2.4} />
      </button>

      <button 
        type="button"
        className="d-btn card" 
        onPointerDown={(e) => startCmd('L', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Left"
      >
        <ArrowLeft size={20} strokeWidth={2.8} />
      </button>

      <button 
        type="button"
        className="d-btn stop-core" 
        onPointerDown={(e) => startCmd('S', e)} 
        title="Emergency Stop" 
        aria-label="Emergency Stop"
      >
        <Square size={13} strokeWidth={0} fill="currentColor" />
      </button>

      <button 
        type="button"
        className="d-btn card" 
        onPointerDown={(e) => startCmd('R', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Right"
      >
        <ArrowRight size={20} strokeWidth={2.8} />
      </button>

      <button 
        type="button"
        className="d-btn diag" 
        onPointerDown={(e) => startCmd('H', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Reverse Left"
      >
        <ArrowDownLeft size={16} strokeWidth={2.4} />
      </button>

      <button 
        type="button"
        className="d-btn card" 
        onPointerDown={(e) => startCmd('B', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Reverse"
      >
        <ArrowDown size={20} strokeWidth={2.8} />
      </button>

      <button 
        type="button"
        className="d-btn diag" 
        onPointerDown={(e) => startCmd('J', e)} 
        onPointerUp={stopCmd} 
        onPointerCancel={stopCmd} 
        aria-label="Reverse Right"
      >
        <ArrowDownRight size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
};

export default DPad;
