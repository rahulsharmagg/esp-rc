import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { BLEController } from '../../lib/ble';
import { useBLE } from '../../lib/ble';
import { 
  ArrowLeft,
  Wifi, 
  Bluetooth, 
  Activity, 
  Sun, 
  Vibrate, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Cpu,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface Props {
  ble: BLEController;
}

const CyberSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}> = ({ checked, onChange, title }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 38,
        height: 20,
        padding: 0,
        margin: 0,
        border: '2px solid #090d16',
        borderRadius: 0,
        background: checked ? '#dc2626' : '#cbd5e1',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.15s ease',
        boxShadow: '1px 1px 0px rgba(0,0,0,0.15)',
        outline: 'none'
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 12,
          height: 12,
          background: checked ? '#ffffff' : '#090d16',
          transform: checked ? 'translateX(18px)' : 'translateX(0px)',
          transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1), background-color 0.15s ease',
          boxShadow: checked ? '1px 1px 0px rgba(0,0,0,0.2)' : 'none'
        }}
      />
    </button>
  );
};

export const SettingsGeneralPage: React.FC<Props> = ({ ble: propBle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const ble = useBLE(propBle);
  const [showAboutDetails, setShowAboutDetails] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    }
  }, [location.hash]);

  const forceUpdateApp = async () => {
    setIsPurging(true);
    ble.log('Purging Service Worker caches and hard-reloading...', 'warn');

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }

    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', width: '100%' }}>
      {/* Back Link over Network & Internet */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            color: '#090d16',
            border: 'none',
            padding: '4px 0',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} strokeWidth={2.4} />
          <span>Back</span>
        </button>
      </div>

      {/* =================================================================
           1. NETWORK & INTERNET
           ================================================================= */}
      <div style={{ padding: '4px 0 14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Wifi size={15} strokeWidth={2.6} color="#2563eb" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1e3a8a', letterSpacing: '0.6px' }}>
            NETWORK &amp; INTERNET
          </span>
        </div>

        {/* Row 1: Wi-Fi Power */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div 
            onClick={() => navigate('/settings/wifi')}
            style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer', flex: 1 }}
            title="Click to view Wi-Fi settings"
          >
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Wi-Fi</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              {!ble.wifi.enabled ? (
                'Turned off'
              ) : ble.wifi.connected ? (
                <span>Connected to <strong style={{ color: '#090d16' }}>{ble.wifi.ssid}</strong> ({ble.wifi.ip})</span>
              ) : (
                'Turned on (Not connected - click to configure)'
              )}
            </span>
          </div>
          <div>
            <CyberSwitch 
              checked={ble.wifi.enabled}
              onChange={(checked) => ble.setWifiPower(checked)}
              title="Toggle Wi-Fi Radio"
            />
          </div>
        </div>
      </div>

      {/* =================================================================
           2. CONNECTED DEVICES
           ================================================================= */}
      <div id="bluetooth" style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Bluetooth size={15} strokeWidth={2.6} color="#0284c7" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#0369a1', letterSpacing: '0.6px' }}>
            CONNECTED DEVICES
          </span>
        </div>

        {/* Row 1: Bluetooth Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Bluetooth Low Energy</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              {ble.isConnected ? `Connected to ${ble.deviceName} (Nordic UART)` : 'Nordic UART Service (UUID: 6E400001...)'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                letterSpacing: '0.4px',
                background: ble.isConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                color: ble.isConnected ? '#16a34a' : '#dc2626',
                border: ble.isConnected ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)'
              }}
            >
              {ble.isConnected ? 'PAIRED & CONNECTED' : 'DISCONNECTED'}
            </span>
            {ble.isConnected ? (
              <button
                type="button"
                onClick={() => ble.disconnect()}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #dc2626',
                  color: '#dc2626',
                  padding: '3px 8px',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: 'pointer'
                }}
              >
                DISCONNECT
              </button>
            ) : (
              <button
                type="button"
                onClick={() => ble.connect()}
                disabled={ble.isConnecting}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #090d16',
                  color: '#090d16',
                  padding: '3px 8px',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: ble.isConnecting ? 'not-allowed' : 'pointer'
                }}
              >
                {ble.isConnecting ? 'PAIRING...' : 'CONNECT'}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Link Latency */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Link Latency / Ping</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              Real-time round-trip command delay
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#334155' }}>
              {ble.isConnected && ble.latency > 0 ? `${ble.latency} ms` : '-- ms'}
            </span>
          </div>
        </div>
      </div>

      {/* =================================================================
           3. SENSORS & HARDWARE
           ================================================================= */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Activity size={15} strokeWidth={2.6} color="#dc2626" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#b91c1c', letterSpacing: '0.6px' }}>
            SENSORS &amp; HARDWARE
          </span>
        </div>

        {/* Sensor 1: Ultrasonic Ranger */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Ultrasonic Distance Ranger</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              HC-SR04 • Trigger: GPIO 18 | Echo: GPIO 19
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                background: ble.ultrasonicEnabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                color: ble.ultrasonicEnabled ? '#16a34a' : '#94a3b8'
              }}
            >
              {ble.ultrasonicEnabled ? (ble.distance >= 300 ? '>300 cm' : `${ble.distance} cm`) : 'OFF'}
            </span>
            <CyberSwitch 
              checked={ble.ultrasonicEnabled}
              onChange={(checked) => ble.setSensorEnabled('ultrasonic', checked)}
              title="Toggle Ultrasonic Ranger"
            />
          </div>
        </div>

        {/* Sensor 2: Left Proximity Sensor */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Left Proximity Sensor</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              TCRT5000 IR Sensor • GPIO 34
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                background: ble.irLeftEnabled ? (ble.irLeft ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)') : 'rgba(148, 163, 184, 0.15)',
                color: ble.irLeftEnabled ? (ble.irLeft ? '#dc2626' : '#16a34a') : '#94a3b8'
              }}
            >
              {ble.irLeftEnabled ? (ble.irLeft ? 'BLOCKED' : 'CLEAR') : 'OFF'}
            </span>
            <CyberSwitch 
              checked={ble.irLeftEnabled}
              onChange={(checked) => ble.setSensorEnabled('irLeft', checked)}
              title="Toggle Left IR Sensor"
            />
          </div>
        </div>

        {/* Sensor 3: Right Proximity Sensor */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Right Proximity Sensor</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              TCRT5000 IR Sensor • GPIO 35
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                background: ble.irRightEnabled ? (ble.irRight ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)') : 'rgba(148, 163, 184, 0.15)',
                color: ble.irRightEnabled ? (ble.irRight ? '#dc2626' : '#16a34a') : '#94a3b8'
              }}
            >
              {ble.irRightEnabled ? (ble.irRight ? 'BLOCKED' : 'CLEAR') : 'OFF'}
            </span>
            <CyberSwitch 
              checked={ble.irRightEnabled}
              onChange={(checked) => ble.setSensorEnabled('irRight', checked)}
              title="Toggle Right IR Sensor"
            />
          </div>
        </div>

        {/* Sensor 4: Radar Pan Gimbal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Radar Pan Gimbal</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              SG90 Micro Servo PWM • GPIO 5
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                background: ble.servoEnabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                color: ble.servoEnabled ? '#16a34a' : '#94a3b8'
              }}
            >
              {ble.servoEnabled ? `${ble.servoAngle}°` : 'OFF'}
            </span>
            <CyberSwitch 
              checked={ble.servoEnabled}
              onChange={(checked) => ble.setSensorEnabled('servo', checked)}
              title="Toggle Servo Gimbal"
            />
          </div>
        </div>
      </div>

      {/* =================================================================
           4. DISPLAY & SCREEN TIMEOUT
           ================================================================= */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Sun size={15} strokeWidth={2.6} color="#ca8a04" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#854d0e', letterSpacing: '0.6px' }}>
            DISPLAY &amp; SCREEN TIMEOUT
          </span>
        </div>

        {/* Row 1: Keep Screen Awake */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Keep Screen Awake (Always-On)</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              Prevent mobile display from sleeping, dimming, or auto-locking
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                background: ble.wakeLockActive ? 'rgba(34, 197, 94, 0.12)' : (ble.wakeLockEnabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.15)'),
                color: ble.wakeLockActive ? '#16a34a' : (ble.wakeLockEnabled ? '#16a34a' : '#94a3b8')
              }}
            >
              {ble.wakeLockActive ? 'ACTIVE' : (ble.wakeLockEnabled ? 'ACTIVE' : 'OFF')}
            </span>
            <CyberSwitch 
              checked={ble.wakeLockEnabled}
              onChange={(checked) => ble.setWakeLock(checked)}
              title="Toggle Keep Screen Awake"
            />
          </div>
        </div>
      </div>

      {/* =================================================================
           5. SOUND & HAPTICS
           ================================================================= */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Vibrate size={15} strokeWidth={2.6} color="#9333ea" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#6b21a8', letterSpacing: '0.6px' }}>
            SOUND &amp; HAPTICS
          </span>
        </div>

        {/* Row 1: Haptic Touch Vibration */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Haptic Touch Vibration</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              Vibrate device on button taps, steering, and commands
            </span>
          </div>
          <div>
            <CyberSwitch 
              checked={ble.hapticEnabled}
              onChange={(checked) => ble.setHaptic(checked)}
              title="Toggle Haptic Touch Vibration"
            />
          </div>
        </div>
      </div>

      {/* =================================================================
           6. ABOUT SYSTEM
           ================================================================= */}
      <div style={{ padding: '14px 0 6px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={15} strokeWidth={2.6} color="#475569" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#334155', letterSpacing: '0.6px' }}>
              ABOUT SYSTEM
            </span>
          </div>

          {/* Accordion Toggle [SHOW INFO ˅] */}
          <button
            type="button"
            onClick={() => setShowAboutDetails(!showAboutDetails)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '2px 8px',
              fontSize: '0.58rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono, monospace)',
              cursor: 'pointer',
              letterSpacing: '0.4px'
            }}
          >
            <span>{showAboutDetails ? 'HIDE DIAGNOSTICS' : 'DIAGNOSTICS'}</span>
            {showAboutDetails ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
          </button>
        </div>

        {/* Row 1: Device Info [Version & Check for update / Update Now] */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Device Info</span>
              <span 
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#dc2626',
                  background: 'rgba(220, 38, 38, 0.08)',
                  padding: '1px 6px',
                  borderRadius: 2
                }}
              >
                v{ble.currentFirmwareVer}
              </span>
            </div>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              ESP32 RC Hardware • {ble.isConnected ? ble.deviceName : 'Disconnected'}
            </span>
            {ble.hasFirmwareUpdate && ble.latestFirmwareDescription && (
              <span style={{ fontSize: '0.58rem', color: '#c2410c', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>
                ★ v{ble.latestFirmwareVer}: {ble.latestFirmwareDescription}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* If update available, show Update Now button leading to settings/update */}
            {ble.hasFirmwareUpdate ? (
              <button
                type="button"
                onClick={() => navigate('/settings/update')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--red-primary, #dc2626)',
                  border: '1.5px solid #090d16',
                  boxShadow: '1px 1px 0px rgba(0,0,0,0.18)',
                  padding: '4px 10px',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  letterSpacing: '0.4px'
                }}
              >
                <span>UPDATE NOW (v{ble.latestFirmwareVer})</span>
                <ArrowRight size={11} strokeWidth={2.4} />
              </button>
            ) : (
              <>
                {/* When check completed and no update available, show LATEST label badge */}
                {ble.hasCheckedFirmware && !ble.isCheckingFirmware && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.58rem',
                      fontWeight: 900,
                      fontFamily: 'var(--font-mono, monospace)',
                      padding: '3px 8px',
                      letterSpacing: '0.5px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#16a34a',
                      border: '1px solid rgba(34, 197, 94, 0.4)'
                    }}
                    title="Device is on the latest available firmware release"
                  >
                    <CheckCircle2 size={11} strokeWidth={2.6} />
                    <span>LATEST</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!ble.isConnected) {
                      ble.showBluetoothAlert('Please connect your ESP32 device via Bluetooth first before checking for updates.');
                      return;
                    }
                    ble.checkFirmwareUpdate();
                  }}
                  disabled={ble.isCheckingFirmware}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#ffffff',
                    border: '1.5px solid #090d16',
                    boxShadow: '1px 1px 0px rgba(0,0,0,0.15)',
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#090d16',
                    cursor: ble.isCheckingFirmware ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.4px'
                  }}
                >
                  <RefreshCw size={11} className={ble.isCheckingFirmware ? 'animate-spin' : ''} strokeWidth={2.4} />
                  <span>{ble.isCheckingFirmware ? 'CHECKING...' : 'CHECK FOR UPDATE'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Application Version */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Application Version</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              Web Cockpit PWA • React 19 Engine
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#0f172a' }}>
              v4.0.0
            </span>
          </div>
        </div>

        {/* Expandable System Diagnostics Panel */}
        {showAboutDetails && (
          <div 
            style={{ 
              marginTop: 10, 
              padding: '12px 14px', 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 10,
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.62rem', fontWeight: 800, color: '#475569', fontFamily: 'var(--font-mono, monospace)' }}>
              <Cpu size={14} color="#0284c7" />
              <span>DIAGNOSTICS &amp; CLIENT CACHE</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: '0.6rem', fontFamily: 'var(--font-mono, monospace)' }}>
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #cbd5e1' }}>
                <div style={{ color: '#64748b' }}>FIRMWARE VERSION</div>
                <div style={{ fontWeight: 800, color: '#0f172a', marginTop: 2 }}>v{ble.currentFirmwareVer}</div>
              </div>
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #cbd5e1' }}>
                <div style={{ color: '#64748b' }}>BATTERY HARDWARE</div>
                <div style={{ fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {ble.hasBattery ? `${ble.batteryPct}% (${ble.batteryVolts.toFixed(1)}V)` : 'USB 5V'}
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: '6px 8px', border: '1px solid #cbd5e1' }}>
                <div style={{ color: '#64748b' }}>CONNECTION MODE</div>
                <div style={{ fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{ble.activeConnectionMode}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={forceUpdateApp}
                disabled={isPurging}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  background: '#090d16',
                  color: '#ffffff',
                  border: '1.5px solid #090d16',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: isPurging ? 'not-allowed' : 'pointer'
                }}
              >
                <RotateCcw size={12} className={isPurging ? 'animate-spin' : ''} />
                <span>{isPurging ? 'PURGING CACHE...' : 'RESTART APPLICATION'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsGeneralPage;
