import React from 'react';
import type { BLEController } from '../lib/ble';
import MinimapCanvas from './MinimapCanvas';
import TerminalLog from './TerminalLog';

interface Props {
  ble: BLEController;
}

export const RightPanel: React.FC<Props> = ({ ble }) => {
  return (
    <section className="panel-right">
      {/* 150x150 HUD Dead-Reckoning Minimap */}
      <MinimapCanvas ble={ble} />

      {/* UART Stream Logger */}
      <TerminalLog ble={ble} />
    </section>
  );
};

export default RightPanel;
