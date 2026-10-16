import React, { useEffect } from 'react';
import type { BLEController } from '../lib/ble';
import { useBLE } from '../lib/ble';
import { 
  Bluetooth, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  X 
} from 'lucide-react';

interface Props {
  ble: BLEController;
}

export const CustomAlertModal: React.FC<Props> = ({ ble: propBle }) => {
  const ble = useBLE(propBle);
  const config = ble.alertConfig;

  useEffect(() => {
    if (!config) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (config.onCancel) config.onCancel();
        ble.closeAlert();
      } else if (e.key === 'Enter') {
        if (config.onConfirm) config.onConfirm();
        ble.closeAlert();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, ble]);

  if (!config) return null;

  const type = config.type || 'warning';

  const getTypeStyle = () => {
    switch (type) {
      case 'bluetooth':
        return {
          headerBg: '#eff6ff',
          headerBorder: '#2563eb',
          iconColor: '#2563eb',
          icon: <Bluetooth size={16} strokeWidth={2.6} color="#2563eb" />,
          title: config.title || 'BLUETOOTH REQUIRED',
          primaryBtnBg: '#2563eb',
          primaryBtnColor: '#ffffff'
        };
      case 'error':
        return {
          headerBg: '#fef2f2',
          headerBorder: '#dc2626',
          iconColor: '#dc2626',
          icon: <AlertCircle size={16} strokeWidth={2.6} color="#dc2626" />,
          title: config.title || 'SYSTEM ERROR',
          primaryBtnBg: '#dc2626',
          primaryBtnColor: '#ffffff'
        };
      case 'success':
        return {
          headerBg: '#f0fdf4',
          headerBorder: '#16a34a',
          iconColor: '#16a34a',
          icon: <CheckCircle2 size={16} strokeWidth={2.6} color="#16a34a" />,
          title: config.title || 'SUCCESS',
          primaryBtnBg: '#16a34a',
          primaryBtnColor: '#ffffff'
        };
      case 'info':
        return {
          headerBg: '#f0f9ff',
          headerBorder: '#0284c7',
          iconColor: '#0284c7',
          icon: <Info size={16} strokeWidth={2.6} color="#0284c7" />,
          title: config.title || 'INFORMATION',
          primaryBtnBg: '#0284c7',
          primaryBtnColor: '#ffffff'
        };
      case 'warning':
      default:
        return {
          headerBg: '#fffbeb',
          headerBorder: '#d97706',
          iconColor: '#d97706',
          icon: <AlertTriangle size={16} strokeWidth={2.6} color="#d97706" />,
          title: config.title || 'ATTENTION',
          primaryBtnBg: '#090d16',
          primaryBtnColor: '#ffffff'
        };
    }
  };

  const currentStyle = getTypeStyle();

  const handleClose = () => {
    if (config.onCancel) config.onCancel();
    ble.closeAlert();
  };

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    ble.closeAlert();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(9, 13, 22, 0.65)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          border: '2px solid #090d16',
          boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: currentStyle.headerBg,
            borderBottom: `2px solid ${currentStyle.headerBorder}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentStyle.icon}
            <span 
              style={{
                fontSize: '0.72rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#090d16',
                letterSpacing: '0.6px'
              }}
            >
              {currentStyle.title}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
              color: '#475569'
            }}
            title="Dismiss Alert"
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p 
            style={{
              margin: 0,
              fontSize: '0.76rem',
              fontWeight: 600,
              color: '#1e293b',
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono, monospace)'
            }}
          >
            {config.message}
          </p>

          {type === 'bluetooth' && (
            <div 
              style={{
                marginTop: 4,
                padding: '6px 8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.62rem',
                color: '#64748b',
                fontFamily: 'var(--font-mono, monospace)'
              }}
            >
              Nordic UART BLE service is required to communicate with ESP32 robot firmware.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 16px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0'
          }}
        >
          {(config.cancelText || type === 'bluetooth' || config.onCancel) && (
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                padding: '5px 12px',
                fontSize: '0.65rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              {config.cancelText || 'DISMISS'}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: currentStyle.primaryBtnBg,
              border: '1.5px solid #090d16',
              color: currentStyle.primaryBtnColor,
              padding: '5px 14px',
              fontSize: '0.65rem',
              fontWeight: 900,
              fontFamily: 'var(--font-mono, monospace)',
              cursor: 'pointer',
              boxShadow: '1px 1px 0px rgba(0,0,0,0.18)',
              letterSpacing: '0.4px'
            }}
          >
            {type === 'bluetooth' && <Bluetooth size={12} strokeWidth={2.4} />}
            <span>{config.confirmText || (type === 'bluetooth' ? 'PAIR & CONNECT' : 'OK')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlertModal;
