import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BLEController } from '../../lib/ble';
import { useBLE } from '../../lib/ble';
import { 
  ArrowLeft,
  ShieldCheck, 
  RefreshCw, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  DownloadCloud, 
  UploadCloud, 
  History, 
  Wifi,
  ExternalLink,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';

interface Props {
  ble: BLEController;
}

export const SettingsUpdatePage: React.FC<Props> = ({ ble: propBle }) => {
  const navigate = useNavigate();
  const ble = useBLE(propBle);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ble.checkFirmwareUpdate();
    ble.fetchFirmwareVersions();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedManifest = 
    !ble.availableVersions || ble.availableVersions.length === 0
      ? null
      : ble.availableVersions.find((v) => v.version === ble.selectedVersion) || ble.availableVersions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', width: '100%' }}>
      {/* Back Link over OTA Update */}
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
           1. FIRMWARE & UPDATES
           ================================================================= */}
      <div style={{ padding: '4px 0 14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={15} strokeWidth={2.6} color="#2563eb" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1e3a8a', letterSpacing: '0.6px' }}>
              FIRMWARE &amp; UPDATES
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a 
              href="/upload.html"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '2px 8px',
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#475569',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
              title="Open Standalone Binary Upload Portal"
            >
              <UploadCloud size={11} strokeWidth={2.4} />
              <span>UPLOAD BINARY</span>
            </a>

            <button 
              type="button" 
              onClick={() => {
                if (!ble.isConnected) {
                  ble.showBluetoothAlert('Please connect your ESP32 device via Bluetooth first before checking for updates.');
                  return;
                }
                ble.checkFirmwareUpdate();
              }}
              disabled={ble.isCheckingFirmware || ble.otaStatus === 'UPDATING'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#ffffff',
                border: '1.5px solid #090d16',
                boxShadow: '1px 1px 0px rgba(0,0,0,0.12)',
                padding: '3px 9px',
                fontSize: '0.62rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#090d16',
                cursor: (ble.isCheckingFirmware || ble.otaStatus === 'UPDATING') ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={11} className={ble.isCheckingFirmware ? 'animate-spin' : ''} strokeWidth={2.4} />
              <span>{ble.isCheckingFirmware ? 'CHECKING...' : 'CHECK FOR UPDATE'}</span>
            </button>
          </div>
        </div>

        {/* Row 1: Installed Version */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Installed Firmware</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              Currently executing on ESP32 flash memory
            </span>
          </div>
          <div>
            <span 
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 8px',
                letterSpacing: '0.4px',
                background: 'rgba(15, 23, 42, 0.06)',
                color: '#0f172a',
                border: '1px solid rgba(15, 23, 42, 0.2)'
              }}
            >
              v{ble.currentFirmwareVer}
            </span>
          </div>
        </div>

        {/* Row 2: Status & Latest Available */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Release Channel Status</span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              Server stable: <strong>v{ble.latestFirmwareVer}</strong>
            </span>
          </div>
          <div>
            {ble.hasFirmwareUpdate ? (
              <span 
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '2px 8px',
                  letterSpacing: '0.4px',
                  background: 'rgba(234, 88, 12, 0.1)',
                  color: '#c2410c',
                  border: '1px solid rgba(234, 88, 12, 0.35)'
                }}
              >
                UPDATE AVAILABLE (v{ble.latestFirmwareVer})
              </span>
            ) : (
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.58rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  padding: '2px 8px',
                  letterSpacing: '0.4px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  color: '#16a34a',
                  border: '1px solid rgba(34, 197, 94, 0.35)'
                }}
              >
                <CheckCircle2 size={11} strokeWidth={2.6} />
                <span>UP TO DATE</span>
              </span>
            )}
          </div>
        </div>

        {/* Live Progress Bar when updating */}
        {ble.otaStatus === 'UPDATING' && (
          <div style={{ margin: '8px 0', padding: 12, background: '#090d16', border: '1.5px solid #090d16' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', color: '#ffffff', marginBottom: 6 }}>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>FLASHING FIRMWARE VIA WI-FI...</span>
              <span style={{ fontWeight: 900, color: '#38bdf8' }}>{ble.otaProgress}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#1e293b', overflow: 'hidden' }}>
              <div style={{ width: `${ble.otaProgress}%`, height: '100%', background: '#dc2626', transition: 'width 0.45s ease' }} />
            </div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: 6, fontFamily: 'var(--font-mono, monospace)' }}>
              {ble.otaMessage || 'Streaming binary chunks over Wi-Fi...'}
            </div>
          </div>
        )}

        {/* Success Notice */}
        {ble.otaStatus === 'SUCCESS' && (
          <div style={{ margin: '8px 0', padding: '10px 12px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} color="#16a34a" />
            <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
              {ble.otaMessage}
            </span>
          </div>
        )}

        {/* Error Notice */}
        {ble.otaStatus === 'ERROR' && (
          <div style={{ margin: '8px 0', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="#dc2626" />
            <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
              {ble.otaMessage}
            </span>
          </div>
        )}

        {/* Update Card if update is available */}
        {ble.hasFirmwareUpdate && ble.otaStatus !== 'UPDATING' && (
          <div style={{ margin: '6px 0', padding: '12px 14px', background: '#fafafa', border: '1.5px solid #090d16', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#090d16' }}>
                    Firmware Release v{ble.latestFirmwareVer}
                  </span>
                  <span 
                    style={{
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      fontFamily: 'var(--font-mono, monospace)',
                      padding: '1px 6px',
                      background: 'rgba(234, 88, 12, 0.1)',
                      color: '#c2410c',
                      border: '1px solid rgba(234, 88, 12, 0.3)'
                    }}
                  >
                    RECOMMENDED
                  </span>
                </div>

                {/* Release Notes / Description Block */}
                {ble.latestFirmwareDescription && (
                  <div 
                    style={{
                      padding: '8px 10px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.5px' }}>
                        CHANGELOG &amp; RELEASE NOTES:
                      </span>
                      {ble.latestFirmwareReleasedAt && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.55rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                          <Calendar size={10} color="#94a3b8" />
                          <span>
                            {new Date(ble.latestFirmwareReleasedAt).toLocaleString(undefined, { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.66rem', color: '#1e293b', fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.4, fontWeight: 600 }}>
                      {ble.latestFirmwareDescription}
                    </span>
                  </div>
                )}

                {ble.latestFirmwareSize > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.58rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                    <span>Binary: <strong>{(ble.latestFirmwareSize / 1024).toFixed(1)} KB</strong></span>
                    {ble.latestFirmwareSha256 && (
                      <span title={ble.latestFirmwareSha256}>
                        SHA-256: <strong style={{ color: '#0369a1' }}>{ble.latestFirmwareSha256.substring(0, 16)}...</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <button 
                  type="button"
                  onClick={() => {
                    if (!ble.wifi.connected) {
                      navigate('/settings/wifi');
                      return;
                    }
                    ble.startFirmwareUpdate(ble.latestFirmwareVer);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'var(--red-primary, #dc2626)',
                    border: '1.5px solid #090d16',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono, monospace)',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px rgba(0,0,0,0.18)',
                    letterSpacing: '0.4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <DownloadCloud size={13} strokeWidth={2.4} />
                  <span>DOWNLOAD &amp; INSTALL</span>
                </button>
              </div>
            </div>

            {/* Wi-Fi Alert if disconnected */}
            {!ble.wifi.connected && (
              <div 
                style={{
                  background: '#fffbeb',
                  border: '1px solid #f59e0b',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wifi size={13} color="#d97706" />
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#b45309', fontFamily: 'var(--font-mono, monospace)' }}>
                    Wi-Fi connection is required to download &amp; install firmware.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/settings/wifi')}
                  style={{
                    background: '#d97706',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.56rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '2px 6px',
                    cursor: 'pointer'
                  }}
                >
                  CONNECT WI-FI
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =================================================================
           2. WI-FI STATUS FOR OTA
           ================================================================= */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <Wifi size={15} strokeWidth={2.6} color="#0284c7" />
          <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#0369a1', letterSpacing: '0.6px' }}>
            WI-FI TRANSPORT STATUS
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {ble.wifi.connected ? `Connected (${ble.wifi.ssid})` : 'Wi-Fi Disconnected'}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
              {ble.wifi.connected 
                ? `Assigned IP: ${ble.wifi.ip} • Ready to stream firmware image` 
                : 'ESP32 must be connected to Wi-Fi to download and flash firmware.'}
            </span>
          </div>
          <div>
            {ble.wifi.connected ? (
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
                READY
              </span>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/settings/wifi')}
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
                CONFIGURE WI-FI
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================
           3. VERSION CATALOG & ROLLBACK
           ================================================================= */}
      <div style={{ padding: '14px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={15} strokeWidth={2.6} color="#475569" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#334155', letterSpacing: '0.6px' }}>
              VERSION CATALOG &amp; ROLLBACK
            </span>
          </div>
          <div>
            <span 
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 6px',
                background: '#f1f5f9',
                color: '#475569'
              }}
            >
              {ble.availableVersions.length} RELEASES
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
            {/* Custom Select Box */}
            <div ref={selectRef} style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <span style={{ display: 'block', fontSize: '0.58rem', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-mono, monospace)', marginBottom: 3 }}>
                SELECT TARGET VERSION:
              </span>

              {/* Select Trigger */}
              <button
                type="button"
                onClick={() => {
                  if (ble.otaStatus !== 'UPDATING') {
                    setIsSelectOpen(!isSelectOpen);
                  }
                }}
                disabled={ble.otaStatus === 'UPDATING'}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1.5px solid #090d16',
                  cursor: ble.otaStatus === 'UPDATING' ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#090d16',
                  boxSizing: 'border-box'
                }}
              >
                <span>
                  v{ble.selectedVersion || ble.latestFirmwareVer}
                  {ble.selectedVersion === ble.currentFirmwareVer ? ' (Installed)' : ''}
                </span>
                {isSelectOpen ? <ChevronUp size={13} strokeWidth={2.4} /> : <ChevronDown size={13} strokeWidth={2.4} />}
              </button>

              {/* Custom Dropdown Menu */}
              {isSelectOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 2px)',
                    left: 0,
                    width: '100%',
                    background: '#ffffff',
                    border: '1.5px solid #090d16',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 999,
                    maxHeight: 180,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {ble.availableVersions.length === 0 ? (
                    <div
                      onClick={() => {
                        ble.selectedVersion = ble.latestFirmwareVer;
                        ble.notify();
                        setIsSelectOpen(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: '#f8fafc',
                        color: '#090d16'
                      }}
                    >
                      v{ble.latestFirmwareVer} ★ STABLE
                    </div>
                  ) : (
                    ble.availableVersions.map((ver) => {
                      const isSelected = ver.version === (ble.selectedVersion || ble.latestFirmwareVer);
                      const isInstalled = ver.version === ble.currentFirmwareVer;
                      return (
                        <div
                          key={ver.version}
                          onClick={() => {
                            ble.selectedVersion = ver.version;
                            ble.notify();
                            setIsSelectOpen(false);
                          }}
                          style={{
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            background: isSelected ? '#f1f5f9' : '#ffffff',
                            borderBottom: '1px solid #f1f5f9',
                            fontFamily: 'var(--font-mono, monospace)',
                            transition: 'background 0.1s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#090d16' }}>
                              v{ver.version}
                            </span>
                            {ver.version === ble.latestFirmwareVer && (
                              <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#16a34a', background: 'rgba(34,197,94,0.1)', padding: '1px 4px' }}>
                                LATEST
                              </span>
                            )}
                            {isInstalled && (
                              <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '1px 4px' }}>
                                INSTALLED
                              </span>
                            )}
                          </div>
                          {isSelected && <Check size={12} strokeWidth={2.6} color="#090d16" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Action: ROLLBACK */}
            <div>
              <button 
                type="button" 
                onClick={() => {
                  if (!ble.isConnected) {
                    ble.showBluetoothAlert('Please connect your ESP32 device via Bluetooth first.');
                    return;
                  }
                  if (!ble.wifi.connected) {
                    navigate('/settings/wifi');
                    return;
                  }
                  ble.startFirmwareUpdate(ble.selectedVersion || ble.latestFirmwareVer);
                }}
                disabled={ble.otaStatus === 'UPDATING' || !(ble.selectedVersion || ble.latestFirmwareVer)}
                title={!ble.wifi.connected ? 'Connect ESP32 to Wi-Fi first' : `Rollback to v${ble.selectedVersion || ble.latestFirmwareVer}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#090d16',
                  border: '1.5px solid #090d16',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  cursor: (ble.otaStatus === 'UPDATING' || !(ble.selectedVersion || ble.latestFirmwareVer)) ? 'not-allowed' : 'pointer',
                  opacity: (ble.otaStatus === 'UPDATING') ? 0.6 : 1,
                  boxShadow: '1px 1px 0px rgba(0,0,0,0.15)',
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <RotateCcw size={12} strokeWidth={2.4} />
                <span>ROLLBACK TO v{ble.selectedVersion || ble.latestFirmwareVer}</span>
              </button>
            </div>
          </div>

          {selectedManifest && (
            <div style={{ marginTop: 4, padding: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
              <div>
                <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)', display: 'block' }}>Target Device:</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-mono, monospace)' }}>{selectedManifest.device || 'esp32'}</span>
              </div>
              {selectedManifest.size > 0 && (
                <div>
                  <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)', display: 'block' }}>Binary Size:</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-mono, monospace)' }}>{(selectedManifest.size / 1024).toFixed(1)} KB</span>
                </div>
              )}
              {selectedManifest.sha256 ? (
                <div>
                  <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)', display: 'block' }}>SHA-256:</span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-mono, monospace)' }} title={selectedManifest.sha256}>
                    {selectedManifest.sha256.substring(0, 14)}...
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsUpdatePage;
