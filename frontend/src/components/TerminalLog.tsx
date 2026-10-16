import React from 'react';
import type { BLEController } from '../lib/ble';

interface Props {
  ble: BLEController;
}

export const TerminalLog: React.FC<Props> = ({ ble }) => {
  const clearLogs = () => {
    ble.logs = [];
    ble.log('Terminal log cleared.', 'info');
  };

  return (
    <div className="logs-container">
      <div className="logs-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="logs-stream-dot"></span>
          <span>TELEMETRY STREAM</span>
        </div>
        <button 
          type="button"
          onClick={clearLogs} 
          title="Clear Log Output"
          style={{
            fontSize: '0.5rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            padding: '1px 4px',
            background: '#ffffff',
            border: '1px solid var(--border-dark)',
            cursor: 'pointer'
          }}
        >
          CLEAR
        </button>
      </div>

      <div className="logs-scroller">
        {ble.logs.map((item) => (
          <div key={item.id} className={`log-line ${item.type}`}>
            [{item.timestamp}] {item.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerminalLog;
