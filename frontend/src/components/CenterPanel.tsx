import React from 'react';
import type { BLEController } from '../lib/ble';
import RadarGauge from './RadarGauge';
import Actuators from './Actuators';
import ThrottleQuadrant from './ThrottleQuadrant';

interface Props {
  ble: BLEController;
}

export const CenterPanel: React.FC<Props> = ({ ble }) => {
  return (
    <section className="panel-center">
      {/* 1. Distance Sensor Progress Bar Gauge */}
      <RadarGauge ble={ble} />

      {/* 2. Actuators Quick Bar (Headlights, Horn, Pan Servo Angle) */}
      <Actuators ble={ble} />

      {/* 3. Centerpiece Throttle Quadrant (Aviation-Grade Lever) */}
      <ThrottleQuadrant ble={ble} />
    </section>
  );
};

export default CenterPanel;
