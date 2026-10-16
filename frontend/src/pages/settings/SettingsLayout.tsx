import React from 'react';
import { Outlet } from 'react-router-dom';
import type { BLEController } from '../../lib/ble';
import { globalBle, useBLE } from '../../lib/ble';
import TopBar from '../../components/TopBar';
import CustomAlertModal from '../../components/CustomAlertModal';

interface Props {
  ble?: BLEController;
}

export const SettingsLayout: React.FC<Props> = ({ ble: propBle }) => {
  const bleHook = useBLE(globalBle);
  const ble = propBle || bleHook;

  return (
    <div className="upload-root" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Unified Full-Width Status Bar at Very Top */}
      <TopBar ble={ble} />

      {/* Main Settings Content Area - Full page layout */}
      <div 
        className="hud-viewport" 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          background: '#ffffff'
        }}
      >
        <div 
          style={{ 
            maxWidth: 960, 
            margin: '0 auto', 
            padding: '16px 20px 40px 20px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <Outlet />
        </div>
      </div>

      {/* Custom Alert Modal */}
      <CustomAlertModal ble={ble} />
    </div>
  );
};

export default SettingsLayout;
