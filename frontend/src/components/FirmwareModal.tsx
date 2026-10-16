import React, { useEffect } from 'react';
import type { BLEController } from '../lib/ble';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  RotateCcw, 
  History, 
  DownloadCloud, 
  UploadCloud, 
  Wifi 
} from 'lucide-react';

interface Props {
  ble: BLEController;
  isOpen: boolean;
  onClose: () => void;
  onOpenWifi?: () => void;
  onOpenUpload?: () => void;
}

export const FirmwareModal: React.FC<Props> = ({
  ble,
  isOpen,
  onClose,
  onOpenWifi,
  onOpenUpload
}) => {
  useEffect(() => {
    if (isOpen) {
      ble.checkFirmwareUpdate();
    }
  }, [isOpen, ble]);

  if (!isOpen) return null;

  const selectedManifest = 
    !ble.availableVersions || ble.availableVersions.length === 0
      ? null
      : ble.availableVersions.find((v) => v.version === ble.selectedVersion) || ble.availableVersions[0];

  return (
    <div className="sensor-modal open standard-modal">
      {/* Header */}
      <div className="modal-header">
        <div className="modal-title-box">
          <span className="modal-tag">OTA SYSTEM</span>
          <h2 className="modal-title">FIRMWARE UPDATE</h2>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close Firmware Window">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Body */}
      <div className="modal-body settings-list-scroll">
        {/* 1. Status Overview Group */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
              <ShieldCheck size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">UPDATE STATUS</span>
            <a 
              href="/ota-test" 
              target="_blank" 
              rel="noreferrer"
              className="test-btn" 
              style={{
                marginLeft: 'auto',
                fontSize: '0.6rem',
                padding: '2px 8px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#3b82f6',
                borderRadius: 4
              }}
              title="Open Live WebSocket Monitor & Simulation Window"
            >
              📡 LIVE WS MONITOR
            </a>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">
                  {ble.otaStatus === 'UPDATING' ? (
                    'Flashing Firmware in Progress...'
                  ) : ble.hasFirmwareUpdate ? (
                    `New Firmware Release Available (v${ble.latestFirmwareVer})`
                  ) : (
                    'Firmware is Up to Date'
                  )}
                </span>
                <span className="settings-item-sub">
                  Installed: <strong>v{ble.currentFirmwareVer}</strong> • Server Stable: <strong>v{ble.latestFirmwareVer}</strong>
                </span>
              </div>
              <div className="settings-row-right">
                <button 
                  type="button"
                  className="test-btn" 
                  onClick={() => ble.checkFirmwareUpdate()}
                  disabled={ble.isCheckingFirmware || ble.otaStatus === 'UPDATING'}
                  title="Check latest releases"
                >
                  <RefreshCw size={11} className={ble.isCheckingFirmware ? 'animate-spin' : ''} style={{ marginRight: 3 }} />
                  {ble.isCheckingFirmware ? 'CHECKING...' : 'CHECK UPDATES'}
                </button>
              </div>
            </div>

            {/* Live Progress Bar when updating */}
            {ble.otaStatus === 'UPDATING' ? (
              <div style={{ margin: '8px 0', padding: 10, background: '#18181b', borderRadius: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: 4 }}>
                  <span style={{ color: '#60a5fa', fontWeight: 700 }}>WRITING TO ESP32 FLASH...</span>
                  <span>{ble.otaProgress}%</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 0, overflow: 'hidden' }}>
                  <div style={{ width: `${ble.otaProgress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.48s ease' }}></div>
                </div>
                <div style={{ fontSize: '0.55rem', color: '#a1a1aa', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  {ble.otaMessage || 'Streaming binary chunks over Wi-Fi...'}
                </div>
                {!ble.isConnected && (
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <button 
                      type="button"
                      className="test-btn primary" 
                      onClick={() => ble.connect()}
                      style={{ background: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8' }}
                    >
                      <RotateCcw size={11} style={{ marginRight: 3 }} />
                      RECONNECT BLUETOOTH
                    </button>
                  </div>
                )}
              </div>
            ) : ble.otaStatus === 'SUCCESS' ? (
              <div style={{ margin: '8px 0', padding: '8px 10px', background: '#f0fdf4', border: '1px solid #22c55e', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span style={{ fontSize: '0.62rem', color: '#16a34a', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{ble.otaMessage}</span>
              </div>
            ) : ble.otaStatus === 'ERROR' ? (
              <div style={{ margin: '8px 0', padding: '8px 10px', background: '#fef2f2', border: '1px solid #ef4444', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} color="#dc2626" />
                <span style={{ fontSize: '0.62rem', color: '#dc2626', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{ble.otaMessage}</span>
              </div>
            ) : null}

            {/* Direct Update Action if update available */}
            {ble.hasFirmwareUpdate && ble.otaStatus !== 'UPDATING' && (
              <div className="settings-row settings-action-row" style={{ borderTop: '1px solid #f1f5f9' }}>
                <div className="settings-row-left">
                  <span className="settings-item-title" style={{ color: '#c2410c' }}>Install Update v{ble.latestFirmwareVer}</span>
                  {ble.latestFirmwareDescription ? (
                    <span className="settings-item-sub font-mono" style={{ color: '#9a3412' }}>
                      Features: {ble.latestFirmwareDescription}
                    </span>
                  ) : (
                    <span className="settings-item-sub">Over-The-Air automatic flash and restart</span>
                  )}
                </div>
                <div className="settings-row-right">
                  <button 
                    type="button"
                    className="test-btn primary" 
                    onClick={() => ble.startFirmwareUpdate(ble.latestFirmwareVer)}
                    disabled={!ble.wifi.connected}
                  >
                    <DownloadCloud size={12} style={{ marginRight: 3 }} />
                    INSTALL NOW
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Version Catalog & Rollback Group */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#475569' }}>
              <History size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">VERSION CATALOG &amp; ROLLBACK</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">Target Version Selection</span>
                <span className="settings-item-sub">Choose any retained release to flash or downgrade</span>
              </div>
              <div className="settings-row-right">
                <span className="settings-badge ok">{ble.availableVersions.length} RELEASES</span>
              </div>
            </div>

            <div style={{ padding: '8px 0', background: 'transparent', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label htmlFor="fw-modal-select" style={{ display: 'block', fontSize: '0.55rem', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                    SELECT VERSION:
                  </label>
                  <select 
                    id="fw-modal-select" 
                    value={ble.selectedVersion}
                    onChange={(e) => {
                      ble.selectedVersion = e.target.value;
                      ble.notify();
                    }}
                    disabled={ble.otaStatus === 'UPDATING'}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: '#ffffff', border: '1.5px solid #0a0e17', borderRadius: 0 }}
                  >
                    {ble.availableVersions.length === 0 ? (
                      <option value={ble.latestFirmwareVer}>v{ble.latestFirmwareVer} (Stable)</option>
                    ) : (
                      ble.availableVersions.map((ver) => (
                        <option key={ver.version} value={ver.version}>
                          v{ver.version} {ver.isStable ? '★ STABLE' : ''} {ver.version === ble.currentFirmwareVer ? '(Installed)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <button 
                    type="button"
                    className="test-btn" 
                    onClick={() => ble.startFirmwareUpdate(ble.selectedVersion)}
                    disabled={!ble.wifi.connected || ble.otaStatus === 'UPDATING' || !ble.selectedVersion}
                    title={!ble.wifi.connected ? 'Connect ESP32 to Wi-Fi first' : `Flash v${ble.selectedVersion}`}
                  >
                    <RotateCcw size={11} style={{ marginRight: 3 }} />
                    FLASH v{ble.selectedVersion || ble.latestFirmwareVer}
                  </button>
                </div>
              </div>

              {selectedManifest && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
                  <div>
                    <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)', display: 'block' }}>Target Device:</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-mono)' }}>{selectedManifest.device || 'esp32-robot'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)', display: 'block' }}>Binary Size:</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1e293b', fontFamily: 'var(--font-mono)' }}>{(selectedManifest.size / 1024).toFixed(1)} KB</span>
                  </div>
                  {selectedManifest.sha256 && (
                    <div>
                      <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)', display: 'block' }}>SHA-256 Checksum:</span>
                      <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-mono)' }} title={selectedManifest.sha256}>
                        {selectedManifest.sha256.substring(0, 14)}...
                      </span>
                    </div>
                  )}
                  {selectedManifest.description && (
                    <div style={{ gridColumn: '1 / -1', marginTop: 4, paddingTop: 4, borderTop: '1px dashed #e2e8f0' }}>
                      <span style={{ fontSize: '0.52rem', fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)', display: 'block' }}>Release Notes:</span>
                      <span style={{ fontSize: '0.6rem', color: '#334155', fontFamily: 'var(--font-mono)' }}>{selectedManifest.description}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Network Requirement Group */}
        <div className="settings-group">
          <div className="settings-group-header">
            <div className="settings-icon-chip" style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>
              <Wifi size={14} strokeWidth={2.5} />
            </div>
            <span className="settings-group-title">NETWORK REQUIREMENT</span>
          </div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-item-title">
                  {ble.wifi.connected ? `Wi-Fi Connected (${ble.wifi.ssid})` : 'ESP32 Wi-Fi Disconnected'}
                </span>
                <span className="settings-item-sub">
                  {ble.wifi.connected 
                    ? `Assigned IP: ${ble.wifi.ip} • Ready for Over-The-Air downloads` 
                    : 'ESP32 must be connected to Wi-Fi to download firmware binaries.'}
                </span>
              </div>
              <div className="settings-row-right">
                {ble.wifi.connected ? (
                  <span className="settings-badge ok">READY</span>
                ) : onOpenWifi ? (
                  <button type="button" className="test-btn primary" onClick={() => { onClose(); onOpenWifi(); }}>
                    CONNECT WI-FI
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="test-btn" onClick={() => { onClose(); onOpenUpload?.(); }}>
          <UploadCloud size={12} style={{ marginRight: 4 }} />
          RELEASE PORTAL
        </button>
        <button type="button" className="test-btn primary" onClick={onClose} style={{ minWidth: 90 }}>
          DONE
        </button>
      </div>
    </div>
  );
};

export default FirmwareModal;
