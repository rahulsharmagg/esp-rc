import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BLEController } from '../../lib/ble';
import { useBLE } from '../../lib/ble';
import type { WifiNetwork } from '../../lib/types';
import { 
  ArrowLeft,
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Radio,
  Eye,
  EyeOff,
  KeyRound
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

export const SettingsWifiPage: React.FC<Props> = ({ ble: propBle }) => {
  const navigate = useNavigate();
  const ble = useBLE(propBle);
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', width: '100%' }}>
      {/* Back Link over Wi-Fi Settings */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => navigate('/settings')}
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
           1. WI-FI
           ================================================================= */}
      <div style={{ padding: '4px 0 14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Wifi size={15} strokeWidth={2.6} color="#2563eb" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1e3a8a', letterSpacing: '0.6px' }}>
            WI-FI
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Wi-Fi</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              {!ble.wifi.enabled
                ? 'Turned off'
                : ble.wifi.connected
                ? <>Connected to <strong style={{ color: '#090d16' }}>{ble.wifi.ssid}</strong> ({ble.wifi.ip})</>
                : 'Turned on (Not connected)'}
            </span>
          </div>
          <div>
            <CyberSwitch 
              checked={ble.wifi.enabled}
              onChange={(checked) => ble.setWifiPower(checked)}
              title="Toggle Wi-Fi"
            />
          </div>
        </div>
      </div>

      {/* =================================================================
           2. ACTIVE CONNECTION
           ================================================================= */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Radio size={15} strokeWidth={2.6} color="#0284c7" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#0369a1', letterSpacing: '0.6px' }}>
            ACTIVE CONNECTION
          </span>
        </div>

        {ble.wifi.enabled && ble.wifi.connected ? (
          <>
            {/* Row 1: SSID */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Connected Network</span>
                <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                  Active 2.4GHz Access Point
                </span>
              </div>
              <div>
                <span 
                  style={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '2px 8px',
                    letterSpacing: '0.4px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    color: '#16a34a',
                    border: '1px solid rgba(34, 197, 94, 0.35)'
                  }}
                >
                  {ble.wifi.ssid}
                </span>
              </div>
            </div>

            {/* Row 2: IP Address */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Assigned IP Address</span>
                <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                  DHCP Lease
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#16a34a' }}>
                  {ble.wifi.ip}
                </span>
              </div>
            </div>

            {/* Row 3: Signal RSSI */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Signal Strength (RSSI)</span>
                <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                  Antenna Reception
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#334155' }}>
                  {ble.wifi.rssi !== 0 ? `${ble.wifi.rssi} dBm` : '-- dBm'}
                </span>
              </div>
            </div>

            {/* Row 4: Disconnect Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Disconnect Wi-Fi</span>
                <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                  Release IP and drop current link
                </span>
              </div>
              <div>
                <button 
                  type="button" 
                  onClick={() => ble.disconnectWifi()}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #dc2626',
                    color: '#dc2626',
                    padding: '4px 12px',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono, monospace)',
                    cursor: 'pointer',
                    letterSpacing: '0.4px'
                  }}
                >
                  DISCONNECT
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Connection Status</span>
              <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                ESP32 is not associated with any wireless network
              </span>
            </div>
            <div>
              <span 
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '2px 8px',
                  letterSpacing: '0.4px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.35)'
                }}
              >
                DISCONNECTED
              </span>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================
           3. AVAILABLE 2.4GHz NETWORKS
           ================================================================= */}
      <div style={{ padding: '14px 0 6px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={15} strokeWidth={2.6} color="#ea580c" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#c2410c', letterSpacing: '0.6px' }}>
              AVAILABLE 2.4GHz NETWORKS
            </span>
          </div>

          {/* When scanning, hide the button completely and display only the spinner loader */}
          {ble.isScanningWifi && ble.wifi.enabled ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
              <RefreshCw size={14} className="animate-spin" color="#3b82f6" strokeWidth={2.5} />
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--font-mono, monospace)' }}>
                SCANNING...
              </span>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={() => ble.startWifiScan()}
              disabled={!ble.wifi.enabled}
              title={!ble.wifi.enabled ? 'Turn on Wi-Fi first' : 'Scan for nearby networks'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#ffffff',
                border: '1.5px solid #090d16',
                boxShadow: '1px 1px 0px rgba(0,0,0,0.12)',
                padding: '4px 10px',
                fontSize: '0.62rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#090d16',
                cursor: !ble.wifi.enabled ? 'not-allowed' : 'pointer',
                opacity: !ble.wifi.enabled ? 0.6 : 1,
                letterSpacing: '0.4px'
              }}
            >
              <RefreshCw size={11} strokeWidth={2.4} />
              <span>SCAN NETWORKS</span>
            </button>
          )}
        </div>

        {/* Network list rendering */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {!ble.wifi.enabled ? (
            <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <WifiOff size={24} color="#94a3b8" />
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>Wi-Fi is turned off</div>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                Enable Wi-Fi radio above to detect wireless access points.
              </div>
            </div>
          ) : ble.isScanningWifi ? (
            <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <RefreshCw size={24} className="animate-spin" color="#3b82f6" />
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb' }}>Scanning 2.4GHz spectrum...</div>
            </div>
          ) : ble.wifiNetworks.length === 0 ? (
            <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <Wifi size={24} color="#94a3b8" />
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>No networks discovered yet</div>
              <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                Click "SCAN NETWORKS" to discover local 2.4GHz routers.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ble.wifiNetworks.map((net, idx) => {
                const isCurrent = ble.wifi.connected && ble.wifi.ssid === net.ssid;
                const bars = getSignalBars(net.rssi);
                return (
                  <div 
                    key={net.ssid} 
                    onClick={() => { if (!isCurrent) handleSelectNetwork(net); }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: idx < ble.wifiNetworks.length - 1 ? '1px solid #f8fafc' : 'none',
                      cursor: isCurrent ? 'default' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="wifi-signal-bars" title={`${net.rssi} dBm`}>
                        <div className={`bar b1 ${bars >= 1 ? 'active' : ''}`}></div>
                        <div className={`bar b2 ${bars >= 2 ? 'active' : ''}`}></div>
                        <div className={`bar b3 ${bars >= 3 ? 'active' : ''}`}></div>
                        <div className={`bar b4 ${bars >= 4 ? 'active' : ''}`}></div>
                      </div>

                      {net.isEncrypted ? (
                        <Lock size={13} color="#64748b" />
                      ) : (
                        <Unlock size={13} color="#16a34a" />
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{net.ssid}</span>
                        <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                          {net.rssi} dBm • {net.isEncrypted ? 'WPA/WPA2' : 'OPEN'}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isCurrent ? (
                        <span 
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono, monospace)',
                            padding: '2px 8px',
                            letterSpacing: '0.4px',
                            background: 'rgba(34, 197, 94, 0.08)',
                            color: '#16a34a',
                            border: '1px solid rgba(34, 197, 94, 0.35)'
                          }}
                        >
                          CONNECTED
                        </span>
                      ) : (
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectNetwork(net);
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1.5px solid #090d16',
                            boxShadow: '1px 1px 0px rgba(0,0,0,0.12)',
                            color: '#090d16',
                            fontWeight: 900,
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.65rem',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            letterSpacing: '0.4px'
                          }}
                        >
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

      {/* PASSWORD MODAL OVERLAY (Guaranteed centered at device viewport) */}
      {showPasswordModal && selectedSsid && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(9, 13, 22, 0.72)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closePasswordModal(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closePasswordModal(); }}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label="Wi-Fi Password Dialog"
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); handleConnectSelected(); }}
            style={{
              width: '100%',
              maxWidth: 380,
              background: '#ffffff',
              border: '2px solid #090d16',
              boxShadow: '6px 6px 0px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* Modal Header */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#090d16',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <KeyRound size={15} color="#dc2626" strokeWidth={2.5} />
                <span style={{ fontSize: '0.72rem', fontWeight: 900, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.5px' }}>
                  CONNECT TO WI-FI
                </span>
              </div>
              <button 
                type="button" 
                onClick={closePasswordModal} 
                title="Cancel"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 16px 12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'var(--font-mono, monospace)' }}>
                Target Network: <strong style={{ color: '#090d16', fontSize: '0.78rem' }}>{selectedSsid}</strong>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  id="rc_wifi_password"
                  name="rc_wifi_password"
                  placeholder="Enter WPA/WPA2 password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 10px',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    border: '1.5px solid #090d16',
                    borderRadius: 0,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnectSelected()}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4
                  }}
                >
                  {showPassword ? <EyeOff size={15} color="#64748b" /> : <Eye size={15} color="#64748b" />}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div 
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px 14px 16px',
                borderTop: '1px solid #f1f5f9'
              }}
            >
              <button 
                type="button" 
                onClick={closePasswordModal}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #64748b',
                  color: '#334155',
                  padding: '6px 14px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button 
                type="submit" 
                style={{
                  background: '#dc2626',
                  border: '1.5px solid #dc2626',
                  color: '#ffffff',
                  padding: '6px 16px',
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                }}
              >
                CONNECT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SettingsWifiPage;
