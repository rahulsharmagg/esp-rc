import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BLEController } from '../lib/ble';
import { 
  Bluetooth, 
  BluetoothConnected,
  Wifi, 
  WifiOff, 
  BatteryFull, 
  BatteryMedium, 
  BatteryLow, 
  BatteryWarning, 
  BatteryCharging,
  Maximize,
  Minimize,
  Settings
} from 'lucide-react';

interface Props {
  ble: BLEController;
  onOpenWifi?: () => void;
  onOpenSettings?: () => void;
}

export const TopBar: React.FC<Props> = ({ ble, onOpenWifi, onOpenSettings }) => {
  const navigate = useNavigate();
  const reconnectTimerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleOpenWifi = onOpenWifi || (() => navigate('/settings/wifi'));
  const handleOpenSettings = onOpenSettings || (() => navigate('/settings'));

  // Fullscreen state listener
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Themed colors: Active / Connected = Cockpit Red (#dc2626), Disconnected / Inactive = Dull (#52525b)
  const activeColor = 'var(--red-primary, #dc2626)';
  const dullColor = '#52525b';

  return (
    <div 
      className="cockpit-status-bar"
      style={{
        width: '100%',
        maxWidth: '100vw',
        height: 30,
        minHeight: 30,
        maxHeight: 30,
        background: 'var(--black-solid, #090d16)',
        borderBottom: '1.5px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        boxSizing: 'border-box',
        zIndex: 50,
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Left: Brand Logo & Title (Click to go to Cockpit HUD) */}
      <div 
        onClick={() => navigate('/')}
        title="Return to Cockpit Dashboard"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6,
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 2
        }}
      >
        <img 
          src="/assets/logo.svg" 
          alt="ESP-RC" 
          style={{ 
            width: 17, 
            height: 17, 
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)'
          }} 
        />
        <span 
          style={{ 
            fontSize: '0.74rem', 
            fontWeight: 900, 
            fontFamily: 'var(--font-rect, "Chakra Petch", sans-serif)', 
            color: '#ffffff',
            letterSpacing: '0.8px'
          }}
        >
          ESP-RC
        </span>
      </div>

      {/* Right: Status Indicators & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* 1. Ping / Latency Value (Direct numerical value: Red if connected, Dull if disconnected) */}
        <div 
          title={`Ping Latency: ${ble.isConnected && ble.latency > 0 ? ble.latency + ' ms' : 'Offline'}`}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'default',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.66rem',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: ble.isConnected ? activeColor : dullColor,
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap'
          }}
        >
          {ble.isConnected && ble.latency > 0 ? `${ble.latency} ms` : '-- ms'}
        </div>

        {/* 2. Wi-Fi Status (Icon Only: Red if connected, Dull if not connected) */}
        <button
          type="button"
          onClick={handleOpenWifi}
          title={
            ble.wifi.connected
              ? `Wi-Fi: Connected (${ble.wifi.ssid || 'ESP32-AP'}) - Click to open Wi-Fi settings`
              : ble.wifi.enabled
              ? 'Wi-Fi: Radio Standby (Disconnected) - Click to open Wi-Fi settings'
              : 'Wi-Fi: Radio OFF - Click to open Wi-Fi settings'
          }
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {ble.wifi.connected ? (
            <Wifi size={16} strokeWidth={2.4} color={activeColor} />
          ) : (
            <WifiOff size={16} strokeWidth={2.4} color={dullColor} />
          )}
        </button>

        {/* 3. Bluetooth Status (Click to view Bluetooth settings / status in Settings) */}
        <button
          type="button"
          onClick={() => navigate('/settings#bluetooth')}
          title={
            ble.isConnected
              ? `Bluetooth: Connected (${ble.deviceName}) - Click to open Bluetooth settings`
              : 'Bluetooth: Disconnected - Click to open Bluetooth settings'
          }
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {ble.isConnected ? (
            <BluetoothConnected
              size={16}
              strokeWidth={2.4}
              color={activeColor}
            />
          ) : (
            <Bluetooth
              size={16}
              strokeWidth={2.4}
              color={dullColor}
              className="animate-pulse"
            />
          )}
        </button>

        {/* 4. Battery Status (Icon Only: Red if connected, Dull if disconnected) */}
        <div
          title={
            !ble.hasBattery
              ? 'Battery: USB / External 5V Power'
              : `Battery: ${ble.batteryPct}% (${ble.batteryVolts.toFixed(1)}V)`
          }
          style={{ display: 'flex', alignItems: 'center', cursor: 'default' }}
        >
          {!ble.hasBattery ? (
            <BatteryCharging 
              size={18} 
              strokeWidth={2.4} 
              color={ble.isConnected ? activeColor : dullColor} 
            />
          ) : ble.batteryPct <= 15 ? (
            <BatteryWarning 
              size={18} 
              strokeWidth={2.4} 
              color={activeColor} 
              className="animate-pulse" 
            />
          ) : ble.batteryPct <= 35 ? (
            <BatteryLow 
              size={18} 
              strokeWidth={2.4} 
              color={ble.isConnected ? activeColor : dullColor} 
            />
          ) : ble.batteryPct <= 70 ? (
            <BatteryMedium 
              size={18} 
              strokeWidth={2.4} 
              color={ble.isConnected ? activeColor : dullColor} 
            />
          ) : (
            <BatteryFull 
              size={18} 
              strokeWidth={2.4} 
              color={ble.isConnected ? activeColor : dullColor} 
            />
          )}
        </div>

        {/* 5. Fullscreen Toggle (Beside Settings) */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#94a3b8',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
        >
          {isFullscreen ? (
            <Minimize size={16} strokeWidth={2.4} />
          ) : (
            <Maximize size={16} strokeWidth={2.4} />
          )}
        </button>

        {/* 6. Settings (At Most Right) */}
        <button
          type="button"
          onClick={handleOpenSettings}
          title="Open Settings"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: onOpenSettings ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            color: '#94a3b8',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
        >
          <Settings size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
