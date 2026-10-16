import React, { useState } from 'react';
import type { BLEController } from '../lib/ble';
import type { WifiNetwork } from '../lib/types';
import { 
  X, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Lock, 
  Unlock, 
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';

interface Props {
  ble: BLEController;
  isOpen: boolean;
  onClose: () => void;
}

export const WifiModal: React.FC<Props> = ({ ble, isOpen, onClose }) => {
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (!isOpen) return null;

  const handleSelectNetwork = (net: WifiNetwork) => {
    if (net.isEncrypted) {
      setSelectedSsid(net.ssid);
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('wifi_pwd_' + net.ssid) : null;
      setPasswordInput(saved || '');
      setShowPassword(false);
      setShowPasswordModal(true);
    } else {
      ble.connectToWifi(net.ssid, '');
      setSelectedSsid(null);
      setShowPasswordModal(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedSsid(null);
    setPasswordInput('');
    setShowPassword(false);
  };

  const handleConnectSelected = () => {
    if (selectedSsid) {
      if (typeof localStorage !== 'undefined' && passwordInput) {
        localStorage.setItem('wifi_pwd_' + selectedSsid, passwordInput);
      }
      ble.connectToWifi(selectedSsid, passwordInput);
      closePasswordModal();
    }
  };

  const getSignalBars = (rssi: number) => {
    if (rssi >= -55) return 4;
    if (rssi >= -68) return 3;
    if (rssi >= -80) return 2;
    return 1;
  };

  return (
    <div className="sensor-modal open standard-modal">
      {/* Header */}
      <div className="modal-header">
        <div className="modal-title-box">
          <span className="modal-tag">NETWORK</span>
          <h2 className="modal-title">WI-FI</h2>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close Wi-Fi Window">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Body */}
      <div className="modal-body settings-list-scroll">
        {/* 1. Wi-Fi Power Switch Group */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
              <Wifi size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">WI-FI POWER</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Wi-Fi</span>
                <span className="settings-item-sub">
                  {!ble.wifi.enabled
                    ? 'Wi-Fi is turned off'
                    : ble.wifi.connected
                    ? <>Connected to <strong style={{ color: 'var(--black-solid)' }}>{ble.wifi.ssid}</strong></>
                    : 'Wi-Fi is turned on (Searching)'}
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
          </div>
        </div>

        {/* 2. Active Connection Group */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>
              <CheckCircle2 size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">ACTIVE CONNECTION</span>
          </div>

          <div className="settings-card">
            {ble.wifi.enabled && ble.wifi.connected ? (
              <>
                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Connected Network</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-badge ok">{ble.wifi.ssid}</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Assigned IP Address</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-value-mono" style={{ color: '#16a34a' }}>{ble.wifi.ip}</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title">Signal Strength</span>
                  </div>
                  <div className="settings-row-right">
                    <span className="settings-value-mono">{ble.wifi.rssi !== 0 ? `${ble.wifi.rssi} dBm` : '--'}</span>
                  </div>
                </div>

                <div className="settings-row settings-action-row">
                  <div className="settings-row-left">
                    <span className="settings-item-title" style={{ fontSize: '0.65rem' }}>Disconnect Network</span>
                    <span className="settings-item-sub">Release IP lease and disconnect</span>
                  </div>
                  <div className="settings-row-right">
                    <button type="button" className="test-btn" onClick={() => ble.disconnectWifi()}>
                      DISCONNECT
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="settings-row">
                <div className="settings-row-left">
                  <span className="settings-item-title">Status</span>
                  <span className="settings-item-sub">Not connected to any network</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-badge disabled">DISCONNECTED</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Available Networks Group */}
        <div className="settings-group">
          <div className="settings-group-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="settings-icon-chip" style={{ background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c' }}>
                <RefreshCw size={14} strokeWidth={2.5} />
              </div>
              <span className="settings-group-title">AVAILABLE NETWORKS</span>
            </div>

            <button 
              type="button"
              className="test-btn" 
              onClick={() => ble.startWifiScan()}
              disabled={!ble.wifi.enabled || ble.isScanningWifi}
              title={!ble.wifi.enabled ? 'Turn on Wi-Fi first' : 'Scan for nearby networks'}
            >
              <RefreshCw size={11} className={ble.isScanningWifi ? 'animate-spin' : ''} style={{ marginRight: 3 }} />
              {ble.isScanningWifi ? 'SCANNING...' : 'SCAN NETWORKS'}
            </button>
          </div>

          <div className="settings-card">
            {!ble.wifi.enabled ? (
              <div className="wifi-state-notice">
                <WifiOff size={22} color="#94a3b8" />
                <div>Wi-Fi is turned off.</div>
                <div style={{ fontSize: '0.58rem', color: '#94a3b8', marginTop: 2 }}>
                  Turn on Wi-Fi above to view available networks.
                </div>
              </div>
            ) : ble.isScanningWifi ? (
              <div className="wifi-state-notice">
                <RefreshCw size={22} className="animate-spin" color="#3b82f6" />
                <div>Scanning for available networks...</div>
              </div>
            ) : ble.wifiNetworks.length === 0 ? (
              <div className="wifi-state-notice">
                <Wifi size={22} color="#94a3b8" />
                <div>No networks discovered yet.</div>
                <div style={{ fontSize: '0.58rem', color: '#94a3b8', marginTop: 2 }}>
                  Click "SCAN NETWORKS" to search for access points.
                </div>
              </div>
            ) : (
              <div className="wifi-scan-list">
                {ble.wifiNetworks.map((net) => {
                  const isCurrent = ble.wifi.connected && ble.wifi.ssid === net.ssid;
                  const bars = getSignalBars(net.rssi);
                  return (
                    <div key={net.ssid} className={`settings-row ${isCurrent ? 'settings-action-row' : ''}`}>
                      <div className="settings-row-left" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <div className="wifi-signal-bars" title={`${net.rssi} dBm`}>
                          <div className={`bar b1 ${bars >= 1 ? 'active' : ''}`}></div>
                          <div className={`bar b2 ${bars >= 2 ? 'active' : ''}`}></div>
                          <div className={`bar b3 ${bars >= 3 ? 'active' : ''}`}></div>
                          <div className={`bar b4 ${bars >= 4 ? 'active' : ''}`}></div>
                        </div>

                        {net.isEncrypted ? (
                          <Lock size={12} color="#64748b" />
                        ) : (
                          <Unlock size={12} color="#16a34a" />
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="settings-item-title">{net.ssid}</span>
                          <span className="settings-item-sub">{net.rssi} dBm • {net.isEncrypted ? 'WPA/WPA2' : 'OPEN'}</span>
                        </div>
                      </div>

                      <div className="settings-row-right">
                        {isCurrent ? (
                          <span className="settings-badge ok">CONNECTED</span>
                        ) : (
                          <button type="button" className="test-btn" onClick={() => handleSelectNetwork(net)}>
                            CONNECT
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button type="button" className="test-btn primary" onClick={onClose} style={{ minWidth: 90 }}>
          DONE
        </button>
      </div>

      {/* PASSWORD MODAL OVERLAY */}
      {showPasswordModal && selectedSsid && (
        <div 
          className="pwd-modal-overlay" 
          onClick={(e) => { if (e.target === e.currentTarget) closePasswordModal(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closePasswordModal(); }}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label="Wi-Fi Password Dialog"
        >
          <form 
            className="pwd-modal-dialog" 
            onSubmit={(e) => { e.preventDefault(); handleConnectSelected(); }}
          >
            <div className="pwd-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <KeyRound size={15} color="#dc2626" strokeWidth={2.5} />
                <span className="pwd-modal-title">ENTER PASSWORD</span>
              </div>
              <button type="button" className="pwd-close-btn" onClick={closePasswordModal} title="Cancel">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            <div className="pwd-modal-body">
              <div className="pwd-ssid-target">
                Connect to <strong style={{ color: 'var(--black-solid)' }}>{selectedSsid}</strong>
              </div>

              <input 
                type="hidden" 
                id="rc_wifi_ssid" 
                name="rc_wifi_ssid" 
                value={selectedSsid} 
                autoComplete="username" 
              />

              <div className="pwd-input-wrap">
                <label htmlFor="rc_wifi_password" className="sr-only" style={{ display: 'none' }}>Wi-Fi Password</label>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  id="rc_wifi_password"
                  name="rc_wifi_password"
                  className="pwd-text-input"
                  placeholder="Enter WPA/WPA2 password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === 'Enter' && handleConnectSelected()}
                />
                <button 
                  type="button" 
                  className="pwd-eye-btn" 
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={14} color="#64748b" />
                  ) : (
                    <Eye size={14} color="#64748b" />
                  )}
                </button>
              </div>
            </div>

            <div className="pwd-modal-footer">
              <button type="button" className="test-btn" onClick={closePasswordModal}>
                CANCEL
              </button>
              <button type="submit" className="test-btn primary">
                CONNECT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default WifiModal;
