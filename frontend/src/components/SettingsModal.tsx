import React, { useState, useEffect } from 'react';
import type { BLEController } from '../lib/ble';
import { 
  X, 
  Wifi, 
  Bluetooth, 
  Activity, 
  BatteryCharging, 
  Vibrate, 
  ArrowUpCircle, 
  RefreshCw, 
  Info, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Sun, 
  Sparkles, 
  DownloadCloud, 
  UploadCloud, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface Props {
  ble: BLEController;
  isOpen: boolean;
  onClose: () => void;
  onOpenWifi?: () => void;
  onOpenFirmware?: () => void;
  onOpenUpload?: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  ble,
  isOpen,
  onClose,
  onOpenWifi,
  onOpenUpload
}) => {
  const [isPurging, setIsPurging] = useState(false);
  const [isInstallPromptOpen, setIsInstallPromptOpen] = useState(false);
  const [showAboutDetails, setShowAboutDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      ble.checkFirmwareUpdate();
    }
  }, [isOpen, ble]);

  if (!isOpen) return null;

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
    <div className="sensor-modal open standard-modal">
      {/* Header */}
      <div className="modal-header">
        <div className="modal-title-box">
          <span className="modal-tag">SYSTEM</span>
          <h2 className="modal-title">SETTINGS</h2>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close Settings">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Body / Categories List */}
      <div className="modal-body settings-list-scroll">
        {/* =================================================================
             1. NETWORK & INTERNET
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
              <Wifi size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">NETWORK &amp; INTERNET</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Wi-Fi</span>
                <span className="settings-item-sub">
                  {!ble.wifi.enabled
                    ? 'Turned off'
                    : ble.wifi.connected
                    ? <>Connected to <strong style={{ color: 'var(--black-solid)' }}>{ble.wifi.ssid}</strong> ({ble.wifi.ip})</>
                    : 'Turned on (Not connected)'}
                </span>
              </div>
              <div className="settings-row-right">
                <label className="cyber-switch-wrap" title="Toggle Wi-Fi">
                  <input 
                    type="checkbox" 
                    checked={ble.wifi.enabled}
                    onChange={(e) => ble.setWifiPower(e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>

            {onOpenWifi && (
              <div className="settings-row settings-action-row">
                <div className="settings-row-left">
                  <span className="settings-item-title" style={{ fontSize: '0.65rem' }}>Wi-Fi Networks &amp; Scanner</span>
                  <span className="settings-item-sub">Scan available 2.4GHz access points</span>
                </div>
                <div className="settings-row-right">
                  <button type="button" className="test-btn" onClick={() => { onClose(); onOpenWifi(); }}>
                    SCAN NETWORKS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================================
             2. CONNECTED DEVICES (BLUETOOTH)
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7' }}>
              <Bluetooth size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">CONNECTED DEVICES</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Bluetooth Low Energy</span>
                <span className="settings-item-sub">Nordic UART Service (UUID: 6E400001...)</span>
              </div>
              <div className="settings-row-right">
                <span className={`settings-badge ${ble.isConnected ? 'ok' : 'danger'}`}>
                  {ble.isConnected ? 'PAIRED & CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Link Latency / Ping</span>
                <span className="settings-item-sub">Real-time round-trip command delay</span>
              </div>
              <div className="settings-row-right">
                <span className="settings-value-mono">
                  {ble.latency > 0 ? `${ble.latency} ms` : '-- ms'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================
             3. SENSORS & HARDWARE
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}>
              <Activity size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">SENSORS &amp; HARDWARE</span>
          </div>

          <div className="settings-card">
            {/* 1. Ultrasonic Ranger */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Ultrasonic Distance Ranger</span>
                <span className="settings-item-sub">HC-SR04 • Trigger: GPIO 18 | Echo: GPIO 19</span>
              </div>
              <div className="settings-row-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`settings-value-pill ${ble.ultrasonicEnabled ? (ble.distance <= 22 ? 'danger' : 'ok') : 'disabled'}`}>
                  {ble.ultrasonicEnabled ? (ble.distance >= 300 ? '>300 cm' : `${ble.distance} cm`) : 'OFF'}
                </span>
                <label className="cyber-switch-wrap" title="Toggle Ultrasonic Ranger">
                  <input 
                    type="checkbox" 
                    checked={ble.ultrasonicEnabled}
                    onChange={(e) => ble.setSensorEnabled('ultrasonic', e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>

            {/* 2. Left IR Sensor */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Left Proximity Sensor</span>
                <span className="settings-item-sub">TCRT5000 IR Sensor • GPIO 34</span>
              </div>
              <div className="settings-row-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`settings-value-pill ${ble.irLeftEnabled ? (ble.irLeft ? 'danger' : 'ok') : 'disabled'}`}>
                  {ble.irLeftEnabled ? (ble.irLeft ? 'BLOCKED' : 'CLEAR') : 'OFF'}
                </span>
                <label className="cyber-switch-wrap" title="Toggle Left IR Sensor">
                  <input 
                    type="checkbox" 
                    checked={ble.irLeftEnabled}
                    onChange={(e) => ble.setSensorEnabled('irLeft', e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>

            {/* 3. Right IR Sensor */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Right Proximity Sensor</span>
                <span className="settings-item-sub">TCRT5000 IR Sensor • GPIO 35</span>
              </div>
              <div className="settings-row-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`settings-value-pill ${ble.irRightEnabled ? (ble.irRight ? 'danger' : 'ok') : 'disabled'}`}>
                  {ble.irRightEnabled ? (ble.irRight ? 'BLOCKED' : 'CLEAR') : 'OFF'}
                </span>
                <label className="cyber-switch-wrap" title="Toggle Right IR Sensor">
                  <input 
                    type="checkbox" 
                    checked={ble.irRightEnabled}
                    onChange={(e) => ble.setSensorEnabled('irRight', e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>

            {/* 4. Pan Servo Gimbal */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Radar Pan Gimbal</span>
                <span className="settings-item-sub">SG90 Micro Servo PWM • GPIO 5</span>
              </div>
              <div className="settings-row-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`settings-value-pill ${ble.servoEnabled ? 'ok' : 'disabled'}`}>
                  {ble.servoEnabled ? `${ble.servoAngle}°` : 'OFF'}
                </span>
                <label className="cyber-switch-wrap" title="Toggle Servo Gimbal">
                  <input 
                    type="checkbox" 
                    checked={ble.servoEnabled}
                    onChange={(e) => ble.setSensorEnabled('servo', e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================
             4. BATTERY & POWER
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>
              <BatteryCharging size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">BATTERY &amp; POWER</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">
                  {ble.hasBattery ? 'Charge Level & Voltage' : 'Power Source / Battery Status'}
                </span>
                <span className="settings-item-sub">
                  {ble.hasBattery 
                    ? '2S Li-ion Power Pack (7.4V Nominal / 8.4V Max)' 
                    : 'USB 5V / External Power (No battery voltage divider connected)'}
                </span>
              </div>
              <div className="settings-row-right" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: ble.hasBattery ? 'var(--black-solid)' : '#64748b' }}>
                  {ble.hasBattery ? `${ble.batteryPct}%` : 'NO BATTERY'}
                </div>
                <div style={{ fontSize: '0.58rem', color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                  {ble.hasBattery ? `${ble.batteryVolts.toFixed(2)} V` : 'USB 5.0V / UNMONITORED'}
                </div>
              </div>
            </div>

            {ble.hasBattery && (
              <div style={{ padding: '0 10px 10px 10px' }}>
                <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div 
                    style={{
                      width: `${Math.max(5, Math.min(100, ble.batteryPct))}%`,
                      height: '100%',
                      background: ble.batteryPct <= 20 ? '#ef4444' : (ble.batteryPct <= 50 ? '#eab308' : '#22c55e'),
                      transition: 'width 0.3s ease'
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================================
             5. DISPLAY & SCREEN TIMEOUT
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04' }}>
              <Sun size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">DISPLAY &amp; SCREEN TIMEOUT</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Keep Screen Awake (Always-On)</span>
                <span className="settings-item-sub">Prevent mobile display from sleeping, dimming, or auto-locking</span>
              </div>
              <div className="settings-row-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`settings-value-pill ${ble.wakeLockActive ? 'ok' : (ble.wakeLockEnabled ? 'ok' : 'disabled')}`}>
                  {ble.wakeLockActive ? 'ACTIVE' : (ble.wakeLockEnabled ? 'ARMED' : 'OFF')}
                </span>
                <label className="cyber-switch-wrap" title="Toggle Keep Screen Awake">
                  <input 
                    type="checkbox" 
                    checked={ble.wakeLockEnabled}
                    onChange={(e) => ble.setWakeLock(e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================
             6. SOUND & HAPTICS
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#9333ea' }}>
              <Vibrate size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">SOUND &amp; HAPTICS</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Haptic Touch Vibration</span>
                <span className="settings-item-sub">Vibrate device on button taps, steering, and commands</span>
              </div>
              <div className="settings-row-right">
                <label className="cyber-switch-wrap" title="Toggle Haptic Feedback">
                  <input 
                    type="checkbox" 
                    checked={ble.hapticEnabled}
                    onChange={(e) => ble.setHaptic(e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================
             7. ABOUT SYSTEM
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="settings-icon-chip" style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#475569' }}>
                <Info size={14} strokeWidth={2.5} />
              </div>
              <span className="settings-group-title">ABOUT SYSTEM</span>
            </div>

            <button 
              type="button" 
              className={`btn-accordion-toggle ${showAboutDetails ? 'active' : ''}`}
              onClick={() => setShowAboutDetails(!showAboutDetails)}
              title={showAboutDetails ? 'Hide system information' : 'Show system information'}
              aria-expanded={showAboutDetails}
            >
              <span className="accordion-lbl">{showAboutDetails ? 'HIDE INFO' : 'SHOW INFO'}</span>
              <div className="accordion-chevron-box">
                {showAboutDetails ? (
                  <ChevronUp size={13} strokeWidth={2.5} />
                ) : (
                  <ChevronDown size={13} strokeWidth={2.5} />
                )}
              </div>
            </button>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Device &amp; Controller</span>
                <span className="settings-item-sub">ESP32 RC Robot (esp32-robot)</span>
              </div>
              <div className="settings-row-right">
                <span className="settings-badge ok">{ble.isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Web Cockpit Version</span>
                <span className="settings-item-sub">React 19 &amp; Web Bluetooth API</span>
              </div>
              <div className="settings-row-right">
                <span className="settings-value-mono">v4.1.0-react</span>
              </div>
            </div>

            {showAboutDetails && (
              <>
                <div className="settings-sub-header">
                  <Cpu size={12} strokeWidth={2.5} className="text-muted" />
                  <span>HARDWARE SPECIFICATIONS</span>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Microcontroller</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-value-mono">ESP32 DevKit Core 3.x (240MHz)</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Motor Driver</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-value-mono">L298N Dual H-Bridge (20kHz PWM)</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Operating Mode</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-badge ok">{ble.driveMode}</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Hardware Uptime</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-value-mono">{ble.uptime}</span>
                  </div>
                </div>

                <div className="settings-sub-header">
                  <ArrowUpCircle size={12} strokeWidth={2.5} style={{ color: '#ea580c' }} />
                  <span>SYSTEM &amp; FIRMWARE UPDATE</span>
                </div>

                <div className="settings-row settings-action-row">
                  <div className="settings-row-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="settings-item-title">Over-The-Air Update</span>
                      {ble.hasFirmwareUpdate ? (
                        <span className="settings-badge danger">UPDATE AVAILABLE</span>
                      ) : (
                        <span className="settings-badge ok">UP TO DATE</span>
                      )}
                    </div>
                    <span className="settings-item-sub">
                      Installed: <strong>v{ble.currentFirmwareVer}</strong> • Latest: <strong>v{ble.latestFirmwareVer}</strong>
                    </span>
                  </div>
                  <div className="settings-row-right">
                    <button 
                      type="button"
                      className="test-btn" 
                      onClick={() => ble.checkFirmwareUpdate()}
                      disabled={ble.isCheckingFirmware}
                      title="Check latest releases from server"
                    >
                      <RefreshCw size={11} className={ble.isCheckingFirmware ? 'animate-spin' : ''} style={{ marginRight: 3 }} />
                      {ble.isCheckingFirmware ? 'CHECKING...' : 'CHECK FOR UPDATE'}
                    </button>
                  </div>
                </div>

                {ble.hasFirmwareUpdate && (
                  <div className="new-version-box">
                    <div className="settings-row-left">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Sparkles size={13} color="#ea580c" />
                        <span className="settings-item-title" style={{ color: '#c2410c', fontWeight: 800 }}>
                          New Version: v{ble.latestFirmwareVer}
                        </span>
                      </div>
                      {ble.latestFirmwareDescription ? (
                        <div className="new-version-feature-text font-mono">
                          {ble.latestFirmwareDescription}
                        </div>
                      ) : (
                        <span className="settings-item-sub">
                          An updated release is ready for Over-The-Air installation.
                        </span>
                      )}
                    </div>
                    <div className="settings-row-right">
                      <button 
                        type="button"
                        className="test-btn primary" 
                        style={{ background: '#ea580c', color: '#ffffff', borderColor: '#c2410c', fontWeight: 800, minWidth: 85 }}
                        onClick={() => setIsInstallPromptOpen(true)}
                      >
                        <ArrowUpCircle size={12} style={{ marginRight: 3 }} />
                        UPDATE
                      </button>
                    </div>
                  </div>
                )}

                <div className="settings-sub-header">
                  <RotateCcw size={12} strokeWidth={2.5} className="text-muted" />
                  <span>APPLICATION MAINTENANCE</span>
                </div>

                <div className="settings-row settings-action-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title" style={{ fontSize: '0.65rem' }}>Restart Application</span>
                    <span className="settings-item-sub">Purge offline Service Worker cache &amp; restart web cockpit</span>
                  </div>
                  <div className="settings-row-right">
                    <button type="button" className="test-btn" onClick={forceUpdateApp} disabled={isPurging}>
                      <RotateCcw size={11} className={isPurging ? 'animate-spin' : ''} style={{ marginRight: 3 }} />
                      {isPurging ? 'PURGING...' : 'RESTART APPLICATION'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* =================================================================
             8. FIRMWARE DISPATCH / DEVELOPER PORTAL
             ================================================================= */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c' }}>
              <UploadCloud size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">FIRMWARE DISPATCH TERMINAL</span>
          </div>

          <div className="settings-card">
            <div className="settings-row settings-action-row">
              <div className="settings-row-left">
                <span className="settings-item-title" style={{ fontSize: '0.65rem' }}>Firmware Release Portal</span>
                <span className="settings-item-sub">Publish compiled .bin firmware images directly to server storage</span>
              </div>
              <div className="settings-row-right">
                <button type="button" className="test-btn primary" onClick={() => { onClose(); onOpenUpload?.(); }}>
                  <UploadCloud size={11} style={{ marginRight: 3 }} />
                  UPLOAD PORTAL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" className="test-btn primary" onClick={onClose} style={{ minWidth: 90 }}>
          DONE
        </button>
      </div>

      {/* INSTALL OVERLAY DIALOG */}
      {isInstallPromptOpen && (
        <div 
          className="nested-modal-backdrop" 
          onClick={() => { if (ble.otaStatus !== 'UPDATING') setIsInstallPromptOpen(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && ble.otaStatus !== 'UPDATING') setIsInstallPromptOpen(false); }}
          role="button"
          tabIndex={0}
          aria-label="Close installation dialog"
        >
          <div 
            className="nested-modal-dialog" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="nested-install-title"
          >
            <div className="nested-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="modal-tag" style={{ background: '#ea580c', color: '#ffffff' }}>OTA UPDATE</span>
                <h3 id="nested-install-title" className="nested-modal-title">FIRMWARE INSTALLATION</h3>
              </div>
              {ble.otaStatus !== 'UPDATING' && (
                <button 
                  type="button"
                  className="modal-close-btn" 
                  onClick={() => setIsInstallPromptOpen(false)} 
                  title="Close"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="nested-modal-body">
              <div className="install-version-card">
                <div className="ver-col">
                  <span className="ver-lbl">CURRENT INSTALLED</span>
                  <span className="ver-val">v{ble.currentFirmwareVer}</span>
                </div>
                <div className="ver-arrow">➔</div>
                <div className="ver-col">
                  <span className="ver-lbl" style={{ color: '#ea580c' }}>TARGET RELEASE</span>
                  <span className="ver-val target">v{ble.latestFirmwareVer}</span>
                </div>
              </div>

              {ble.latestFirmwareDescription && (
                <div className="install-feature-notes">
                  <div className="feature-notes-header">
                    <Sparkles size={11} color="#ea580c" />
                    <span className="feature-notes-lbl">WHAT'S NEW IN THIS VERSION:</span>
                  </div>
                  <div className="feature-notes-text font-mono">{ble.latestFirmwareDescription}</div>
                </div>
              )}

              <div className={`install-status-card ${ble.wifi.connected ? 'ready' : 'warning'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="status-icon-wrap">
                    {ble.wifi.connected ? (
                      <Wifi size={16} color="#16a34a" />
                    ) : (
                      <AlertCircle size={16} color="#d97706" />
                    )}
                  </div>
                  <div>
                    <div className="status-heading">
                      {ble.wifi.connected ? `Wi-Fi Connected (${ble.wifi.ssid})` : 'ESP32 Wi-Fi Not Connected'}
                    </div>
                    <div className="status-detail">
                      {ble.wifi.connected 
                        ? `IP: ${ble.wifi.ip} • Ready to download and flash binary.` 
                        : 'Connecting to Wi-Fi is required. Clicking Install will open Wi-Fi network scanner.'}
                    </div>
                  </div>
                </div>
              </div>

              {ble.otaStatus === 'UPDATING' ? (
                <div className="ota-live-box">
                  <div className="ota-live-header">
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>FLASHING TO ESP32...</span>
                    <span>{ble.otaProgress}%</span>
                  </div>
                  <div className="ota-live-bar">
                    <div className="ota-live-bar-fill" style={{ width: `${ble.otaProgress}%` }}></div>
                  </div>
                  <div className="ota-live-msg">
                    {ble.otaMessage || 'Streaming binary chunks over Wi-Fi...'}
                  </div>
                  {!ble.isConnected && (
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <button 
                        type="button"
                        className="test-btn primary" 
                        onClick={() => ble.connect()}
                        style={{ background: '#2563eb', color: '#ffffff' }}
                      >
                        <RotateCcw size={11} style={{ marginRight: 3 }} />
                        RECONNECT BLUETOOTH
                      </button>
                    </div>
                  )}
                </div>
              ) : ble.otaStatus === 'SUCCESS' ? (
                <div className="ota-alert-box success">
                  <CheckCircle2 size={15} color="#16a34a" />
                  <span>{ble.otaMessage || 'Firmware update completed successfully!'}</span>
                </div>
              ) : ble.otaStatus === 'ERROR' ? (
                <div className="ota-alert-box error">
                  <AlertCircle size={15} color="#dc2626" />
                  <span>{ble.otaMessage || 'Firmware installation failed.'}</span>
                </div>
              ) : null}
            </div>

            <div className="nested-modal-footer">
              <button 
                type="button" 
                className="test-btn" 
                onClick={() => setIsInstallPromptOpen(false)}
                disabled={ble.otaStatus === 'UPDATING'}
              >
                CANCEL
              </button>
              <button 
                type="button" 
                className="test-btn primary"
                style={{ background: '#ea580c', color: '#ffffff', borderColor: '#c2410c', fontWeight: 800, minWidth: 110 }}
                disabled={ble.otaStatus === 'UPDATING'}
                onClick={() => {
                  if (ble.wifi.connected) {
                    ble.startFirmwareUpdate(ble.latestFirmwareVer);
                  } else {
                    onOpenWifi?.();
                  }
                }}
              >
                <DownloadCloud size={13} style={{ marginRight: 3 }} />
                {ble.otaStatus === 'UPDATING' ? 'INSTALLING...' : 'INSTALL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;
