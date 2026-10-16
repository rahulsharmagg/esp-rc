import React from 'react';
import type { BLEController } from '../lib/ble';

interface Props {
  ble: BLEController;
}

export const RadarGauge: React.FC<Props> = ({ ble }) => {
  const radarWidth = ble.distance >= 300 
    ? 100 
    : Math.min(100, Math.max(8, (ble.distance / 120) * 100));

  const radarClass = ble.distance <= 22 
    ? 'radar-fill danger' 
    : ble.distance <= 40 
    ? 'radar-fill warning' 
    : 'radar-fill';

  const distLabel = !ble.ultrasonicEnabled 
    ? 'SENSOR OFF' 
    : ble.distance >= 300 
    ? '>300 cm' 
    : `${ble.distance} cm`;

  return (
    <div className="radar-box">
      <div className="radar-header">
        <span className="radar-tag">DISTANCE SENSOR</span>
        <span className="radar-dist">{distLabel}</span>
      </div>
      <div className="radar-track">
        <div className={radarClass} style={{ width: `${radarWidth}%` }}></div>
      </div>
    </div>
  );
};

export default RadarGauge;
