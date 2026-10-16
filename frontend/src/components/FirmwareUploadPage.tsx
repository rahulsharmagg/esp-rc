import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  Lock, 
  Eye, 
  EyeOff, 
  FileCode2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  Loader2, 
  HardDrive, 
  Tag, 
  Clock, 
  Copy, 
  Check, 
  DownloadCloud, 
  RefreshCw, 
  FileCheck, 
  FileText, 
  X 
} from 'lucide-react';
import type { FirmwareVersionInfo, FirmwareVersionsResponse } from '../lib/types';
import { globalBle, useBLE } from '../lib/ble';
import TopBar from './TopBar';

interface Props {
  onNavigateHome?: () => void;
}

export const FirmwareUploadPage: React.FC<Props> = ({ onNavigateHome }) => {
  const ble = useBLE(globalBle);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  // Form States
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [targetVersion, setTargetVersion] = useState('');
  const [releaseChannel, setReleaseChannel] = useState<'stable' | 'beta' | 'dev'>('stable');
  const [releaseDescription, setReleaseDescription] = useState('');
  const [isStable, setIsStable] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  // UI Interactive States
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);

  // Alerts & Notifications
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | ''>('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Versions Repository List
  const [existingVersions, setExistingVersions] = useState<FirmwareVersionInfo[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const latestVersion = existingVersions.length > 0 ? existingVersions[0].version : '1.0.0';
  const filteredVersions = existingVersions.filter((v) =>
    v.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.channel && v.channel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const fetchExistingVersions = async () => {
    setIsLoadingVersions(true);
    try {
      const res = await fetch('/api/firmware/versions?device=esp32-robot', { cache: 'no-store' });
      if (res.ok) {
        const data: FirmwareVersionsResponse = await res.json();
        if (data && Array.isArray(data.versions)) {
          setExistingVersions(data.versions);
        }
      }
    } catch (_) {
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const savedPwd = localStorage.getItem('esp_admin_pwd');
      if (savedPwd) setAdminPassword(savedPwd);
    }
    fetchExistingVersions();
  }, []);

  const suggestNextVersion = (type: 'patch' | 'minor' | 'major') => {
    const base = existingVersions.length > 0 ? existingVersions[0].version : '1.0.0';
    const parts = base.split('.').map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);

    if (type === 'patch') parts[2]++;
    else if (type === 'minor') { parts[1]++; parts[2] = 0; }
    else if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }

    setTargetVersion(`${parts[0]}.${parts[1]}.${parts[2]}`);
  };

  const handleFile = (file: File) => {
    setFileError('');
    setAlertMessage('');
    if (!file.name.toLowerCase().endsWith('.bin')) {
      setFileError('Invalid file format. Only compiled .bin binary files are accepted.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    const match = file.name.match(/(?:v|firmware[-_]?|esp[-_]rc[-_]?)(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/i);
    if (match && !targetVersion) {
      setTargetVersion(match[1]);
    } else if (!targetVersion && existingVersions.length > 0) {
      suggestNextVersion('patch');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFileError('');
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedSha(text);
      setTimeout(() => setCopiedSha(null), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const pwd = adminPassword.trim();
    const ver = targetVersion.trim();

    if (!pwd) {
      setAlertType('error');
      setAlertMessage('Admin Secret Password is required to publish firmware.');
      return;
    }

    if (!selectedFile) {
      setAlertType('error');
      setAlertMessage('Please select or drag & drop a valid .bin firmware binary.');
      return;
    }

    if (!ver || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.*)?$/.test(ver)) {
      setAlertType('error');
      setAlertMessage('Invalid SemVer format. Example: 1.0.8 or 1.1.0-beta.1');
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('esp_admin_pwd', pwd);
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);
    setAlertMessage('');
    setAlertType('');

    const fileToUpload = selectedFile;
    const reader = new FileReader();
    reader.onerror = () => {
      setIsUploading(false);
      setAlertType('error');
      setAlertMessage('Failed to read local firmware binary file.');
    };
    reader.onload = () => {
      try {
        const rawResult = reader.result as string;
        const base64Data = rawResult.includes(',') ? rawResult.split(',')[1] : rawResult;

        const payload = JSON.stringify({
          password: pwd,
          version: ver,
          channel: releaseChannel,
          description: releaseDescription.trim(),
          isStable: isStable,
          device: 'esp32-robot',
          data: base64Data
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/firmware/upload', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadedBytes(event.loaded);
            setTotalBytes(event.total);
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          setIsUploading(false);
          try {
            const res = JSON.parse(xhr.responseText);
            if (xhr.status === 200 && res.success) {
              setAlertType('success');
              setAlertMessage(`Firmware v${ver} published successfully! Size: ${(res.manifest.size / 1024).toFixed(1)} KB${isStable ? ' [STABLE RELEASE]' : ''}`);
              setSelectedFile(null);
              setReleaseDescription('');
              fetchExistingVersions();
            } else {
              setAlertType('error');
              setAlertMessage(res.error || res.message || 'Upload rejected by server.');
            }
          } catch (err: any) {
            setAlertType('error');
            setAlertMessage(`Server error (HTTP ${xhr.status}): ${xhr.statusText || err.message}`);
          }
        };

        xhr.onerror = () => {
          setIsUploading(false);
          setAlertType('error');
          setAlertMessage('Network error during upload. Ensure the backend server is running.');
        };

        xhr.send(payload);
      } catch (err: any) {
        setIsUploading(false);
        setAlertType('error');
        setAlertMessage(`Preparation error: ${err.message}`);
      }
    };
    reader.readAsDataURL(fileToUpload);
  };

  return (
    <div className="upload-root" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Unified Full-Width Status Bar at Very Top */}
      <TopBar ble={ble} />

      {/* HUD Top Bar */}
      <header className="hud-topbar">
        <div className="topbar-left">
          <button type="button" className="btn-cockpit-back" onClick={handleGoHome}>
            <ArrowLeft size={15} strokeWidth={2.5} />
            <span>COCKPIT HUD</span>
          </button>
          <div className="hud-divider"></div>
          <div className="hud-brand">
            <div className="live-dot"></div>
            <span className="hud-title">FIRMWARE DISPATCH TERMINAL</span>
            <span className="hud-sub">SYS//OTA-ADMIN</span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="hud-badge arch">
            <Cpu size={13} strokeWidth={2.5} />
            <span>ESP32-WROOM-32</span>
          </div>
          <div className="hud-badge security">
            <ShieldCheck size={13} strokeWidth={2.5} />
            <span>SECURE RELEASE PORTAL</span>
          </div>
        </div>
      </header>

      {/* Main Scrollable Viewport */}
      <div className="hud-viewport">
        <div className="hud-grid">
          {/* =========================================================
               LEFT COLUMN: INJECTION / UPLOAD FORM
               ========================================================= */}
          <section className="hud-panel main-panel">
            <div className="panel-header">
              <div className="panel-title-row">
                <div className="icon-chip primary">
                  <UploadCloud size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="panel-title">BINARY PAYLOAD INJECTION</h2>
                  <p className="panel-desc">Deploy and register over-the-air firmware binary packages</p>
                </div>
              </div>
              <span className="panel-tag">OTA v4</span>
            </div>

            <form className="panel-body" onSubmit={handleSubmit}>
              {/* Step 1: Security Token */}
              <div className="field-block">
                <div className="field-header">
                  <label htmlFor="rc_firmware_admin_password" className="field-label">
                    <Lock size={13} strokeWidth={2.5} className="text-orange" />
                    <span>ADMIN AUTHORIZATION SECRET</span>
                  </label>
                  <span className="field-req">REQUIRED</span>
                </div>

                <input 
                  type="hidden" 
                  id="rc_firmware_admin_username" 
                  name="rc_firmware_admin_username" 
                  value="firmware-admin" 
                  autoComplete="username" 
                />

                <div className="input-wrap">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    id="rc_firmware_admin_password"
                    name="rc_firmware_admin_password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter server admin password"
                    required
                    autoComplete="current-password"
                    className="hud-input password-input"
                  />
                  <button 
                    type="button" 
                    className="btn-toggle-eye" 
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={15} strokeWidth={2.2} />
                    ) : (
                      <Eye size={15} strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Binary Dropzone */}
              <div className="field-block">
                <div className="field-header">
                  <label htmlFor="rc_firmware_bin_file" className="field-label">
                    <FileCode2 size={13} strokeWidth={2.5} className="text-orange" />
                    <span>COMPILED BINARY PAYLOAD (.BIN)</span>
                  </label>
                  <span className="field-req">REQUIRED</span>
                </div>

                <div 
                  className={`cyber-dropzone ${isDragging ? 'dragover' : ''} ${selectedFile !== null ? 'has-file' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  role="region"
                  aria-label="Binary Dropzone"
                >
                  <input 
                    type="file" 
                    id="rc_firmware_bin_file" 
                    name="rc_firmware_bin_file"
                    accept=".bin" 
                    onChange={handleFileInputChange} 
                    className="hidden-file-input"
                  />

                  <span className="corner tl"></span>
                  <span className="corner tr"></span>
                  <span className="corner bl"></span>
                  <span className="corner br"></span>

                  {selectedFile ? (
                    <div className="file-loaded-view">
                      <div className="file-icon-box">
                        <FileCheck size={28} strokeWidth={2.5} className="text-green" />
                      </div>
                      <div className="file-details">
                        <span className="file-title">{selectedFile.name}</span>
                        <div className="file-meta-row">
                          <span className="meta-pill">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                          <span className="meta-pill">APPLICATION/OCTET-STREAM</span>
                          <span className="meta-pill ok">READY</span>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="btn-remove-file" 
                        onClick={removeSelectedFile}
                        title="Remove file"
                      >
                        <X size={15} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <div className="dropzone-idle-view">
                      <div className="idle-icon-wrap">
                        <UploadCloud size={30} strokeWidth={2.2} className="text-orange" />
                      </div>
                      <span className="idle-prompt">DROP COMPILED .BIN FILE HERE</span>
                      <span className="idle-sub">or click to browse local filesystem</span>
                      <span className="idle-hint">Arduino IDE &gt; Sketch &gt; Export Compiled Binary</span>
                    </div>
                  )}
                </div>

                {fileError && (
                  <div className="error-strip">
                    <AlertTriangle size={13} strokeWidth={2.5} />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>

              {/* Step 3: Target SemVer & Release Channel */}
              <div className="form-row-grid">
                <div className="field-block">
                  <div className="field-header">
                    <label htmlFor="rc_firmware_version" className="field-label">
                      <Tag size={13} strokeWidth={2.5} className="text-orange" />
                      <span>TARGET VERSION (SEMVER)</span>
                    </label>
                    <div className="quick-helpers">
                      <button type="button" className="helper-chip" onClick={() => suggestNextVersion('patch')}>+Patch</button>
                      <button type="button" className="helper-chip" onClick={() => suggestNextVersion('minor')}>+Minor</button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    id="rc_firmware_version" 
                    name="rc_firmware_version"
                    value={targetVersion} 
                    onChange={(e) => setTargetVersion(e.target.value)}
                    placeholder="e.g. 1.0.8"
                    pattern="^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.*)?$"
                    required
                    className="hud-input font-mono"
                  />
                </div>

                <div className="field-block">
                  <div className="field-header">
                    <span className="field-label">
                      <Layers size={13} strokeWidth={2.5} className="text-orange" />
                      <span>RELEASE CHANNEL</span>
                    </span>
                  </div>
                  <div className="channel-pills">
                    <button 
                      type="button" 
                      className={`pill-btn ${releaseChannel === 'stable' ? 'active' : ''}`} 
                      onClick={() => setReleaseChannel('stable')}
                    >
                      <span className="pill-dot stable"></span>
                      STABLE
                    </button>
                    <button 
                      type="button" 
                      className={`pill-btn ${releaseChannel === 'beta' ? 'active' : ''}`} 
                      onClick={() => setReleaseChannel('beta')}
                    >
                      <span className="pill-dot beta"></span>
                      BETA
                    </button>
                    <button 
                      type="button" 
                      className={`pill-btn ${releaseChannel === 'dev' ? 'active' : ''}`} 
                      onClick={() => setReleaseChannel('dev')}
                    >
                      <span className="pill-dot dev"></span>
                      DEV
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 4: Release Notes & New Features */}
              <div className="field-block">
                <div className="field-header">
                  <label htmlFor="rc_firmware_description" className="field-label">
                    <FileText size={13} strokeWidth={2.5} className="text-orange" />
                    <span>RELEASE NOTES &amp; NEW FEATURES</span>
                  </label>
                  <span className="field-opt">OPTIONAL</span>
                </div>
                <textarea 
                  id="rc_firmware_description" 
                  name="rc_firmware_description"
                  value={releaseDescription} 
                  onChange={(e) => setReleaseDescription(e.target.value)}
                  placeholder="Describe new features, bug fixes, or enhancements in this release..."
                  rows={2}
                  className="hud-input hud-textarea font-mono"
                ></textarea>
              </div>

              {/* Step 5: Promote to Stable Switch */}
              <label className="toggle-card" htmlFor="rc_firmware_promote_stable">
                <input 
                  type="checkbox" 
                  id="rc_firmware_promote_stable" 
                  name="rc_firmware_promote_stable" 
                  checked={isStable} 
                  onChange={(e) => setIsStable(e.target.checked)}
                />
                <div className="toggle-box">
                  <div className={`toggle-switch-ui ${isStable ? 'checked' : ''}`}>
                    <div className="toggle-knob"></div>
                  </div>
                </div>
                <div className="toggle-text">
                  <span className="toggle-title">PROMOTE AS LATEST STABLE RELEASE</span>
                  <span className="toggle-desc">All connected RC Car clients will automatically receive an update notification to install this version.</span>
                </div>
              </label>

              {/* Upload Live Streaming Progress */}
              {isUploading && (
                <div className="upload-meter-box">
                  <div className="meter-labels">
                    <div className="meter-status">
                      <Loader2 size={14} strokeWidth={2.5} className="animate-spin text-orange" />
                      <span>TRANSMITTING BINARY PAYLOAD...</span>
                    </div>
                    <span className="meter-pct font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <div className="meter-sub font-mono">
                    <span>{(uploadedBytes / 1024).toFixed(1)} KB / {(totalBytes / 1024).toFixed(1)} KB</span>
                    <span>STREAM: ACTIVE</span>
                  </div>
                </div>
              )}

              {/* Feedback Banners */}
              {alertMessage && (
                <div className={`hud-alert-banner ${alertType}`}>
                  {alertType === 'success' ? (
                    <CheckCircle2 size={18} strokeWidth={2.5} className="shrink-0 text-green" />
                  ) : (
                    <AlertTriangle size={18} strokeWidth={2.5} className="shrink-0 text-red" />
                  )}
                  <div className="alert-content">
                    <span className="alert-heading">{alertType === 'success' ? 'DISPATCH SUCCESSFUL' : 'TRANSMISSION ERROR'}</span>
                    <span className="alert-desc">{alertMessage}</span>
                  </div>
                </div>
              )}

              {/* Submit Tactical Button */}
              <button type="submit" className="btn-dispatch-submit" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                    <span>DISPATCHING PAYLOAD ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} strokeWidth={2.5} />
                    <span>UPLOAD &amp; PUBLISH FIRMWARE</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* =========================================================
               RIGHT COLUMN: ACTIVE REPOSITORY RELEASES
               ========================================================= */}
          <aside className="hud-panel sidebar-panel">
            <div className="panel-header">
              <div className="panel-title-row">
                <div className="icon-chip green">
                  <HardDrive size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="panel-title">ACTIVE REPOSITORY</h3>
                  <p className="panel-desc">Published firmware images in storage</p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-refresh-list" 
                onClick={fetchExistingVersions} 
                disabled={isLoadingVersions}
                title="Refresh list"
              >
                <RefreshCw size={13} strokeWidth={2.5} className={isLoadingVersions ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="search-wrap">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search version or channel..." 
                className="hud-input search-input font-mono"
              />
            </div>

            <div className="versions-feed">
              {isLoadingVersions && existingVersions.length === 0 ? (
                <div className="feed-empty">
                  <Loader2 size={22} strokeWidth={2.5} className="animate-spin text-orange" />
                  <span>Loading firmware repository...</span>
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="feed-empty">
                  <HardDrive size={28} strokeWidth={2} className="text-muted opacity-30" />
                  <span>No firmware releases match query.</span>
                </div>
              ) : (
                filteredVersions.map((ver, index) => (
                  <div key={ver.version} className="version-feed-item">
                    <div className="item-top">
                      <div className="item-tag-box">
                        <span className="item-ver-name">v{ver.version}</span>
                        <span className={`channel-pill ${ver.channel || 'stable'}`}>{(ver.channel || 'stable').toUpperCase()}</span>
                        {index === 0 && <span className="latest-pill">LATEST</span>}
                      </div>
                      <a 
                        href={`/firmware/esp32/${ver.version}/firmware.bin`} 
                        download={`firmware-${ver.version}.bin`}
                        className="btn-item-download"
                        title="Download binary"
                      >
                        <DownloadCloud size={14} strokeWidth={2.5} />
                      </a>
                    </div>

                    <div className="item-meta-grid">
                      <span className="meta-item">
                        <HardDrive size={11} strokeWidth={2.5} />
                        {(ver.size / 1024).toFixed(1)} KB
                      </span>
                      {ver.releasedAt && (
                        <span className="meta-item">
                          <Clock size={11} strokeWidth={2.5} />
                          {new Date(ver.releasedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {ver.description && (
                      <div className="item-desc-box">
                        <span className="item-desc-text">{ver.description}</span>
                      </div>
                    )}

                    {ver.sha256 && (
                      <div className="sha-box">
                        <span className="sha-label">SHA256:</span>
                        <code className="sha-hash" title={ver.sha256}>{ver.sha256.substring(0, 16)}...</code>
                        <button 
                          type="button" 
                          className="btn-copy-sha" 
                          onClick={() => copyToClipboard(ver.sha256)}
                          title="Copy SHA-256 Checksum"
                        >
                          {copiedSha === ver.sha256 ? (
                            <Check size={11} strokeWidth={2.5} className="text-green" />
                          ) : (
                            <Copy size={11} strokeWidth={2.5} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="telemetry-footer">
              <div className="tele-item">
                <span className="tele-lbl">TOTAL PACKAGES</span>
                <span className="tele-val font-mono">{existingVersions.length}</span>
              </div>
              <div className="tele-item">
                <span className="tele-lbl">LATEST STABLE</span>
                <span className="tele-val font-mono text-orange">v{latestVersion}</span>
              </div>
              <div className="tele-item">
                <span className="tele-lbl">SERVER STATUS</span>
                <span className="tele-val font-mono text-green">ONLINE</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default FirmwareUploadPage;
