import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BLEController } from '../../lib/ble';
import { useBLE } from '../../lib/ble';
import type { FirmwareVersionInfo, FirmwareVersionsResponse, Esp32VersionsListResponse } from '../../lib/types';
import { 
  ArrowLeft,
  UploadCloud, 
  Lock, 
  Eye, 
  EyeOff, 
  FileCode2, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  Tag, 
  Clock, 
  Copy, 
  Check, 
  DownloadCloud, 
  RefreshCw, 
  FileCheck, 
  FileText, 
  X,
  Layers,
  Loader2
} from 'lucide-react';

// Sleek Cyber Switch Component matching settings theme
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

interface Props {
  ble: BLEController;
}

export const SettingsUploadPage: React.FC<Props> = ({ ble: propBle }) => {
  const navigate = useNavigate();
  const ble = useBLE(propBle);

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

  const fetchExistingVersions = async () => {
    setIsLoadingVersions(true);
    try {
      let resolved = false;

      // 1. Primary endpoint: /firmware/versions/esp32
      try {
        const res = await fetch('/firmware/versions/esp32', { cache: 'no-store' });
        if (res.ok) {
          const data: Esp32VersionsListResponse = await res.json();
          if (data && Array.isArray(data.versions)) {
            const list: FirmwareVersionInfo[] = data.versions.map((v) => {
              if (typeof v === 'string') {
                return {
                  version: v,
                  isStable: true,
                  device: data.type || 'esp32',
                  size: 0,
                  sha256: '',
                  releasedAt: '',
                  description: '',
                  url: `/firmware/esp32/${v}`
                };
              }
              return v;
            });
            // Reverse so newest first
            setExistingVersions([...list].reverse());
            resolved = true;
          }
        }
      } catch (_) {}

      // 2. Fallback: /api/firmware/versions?device=esp32-robot
      if (!resolved) {
        const fallbackRes = await fetch('/api/firmware/versions?device=esp32-robot', { cache: 'no-store' });
        if (fallbackRes.ok) {
          const data: FirmwareVersionsResponse = await fallbackRes.json();
          if (data && Array.isArray(data.versions)) {
            setExistingVersions(data.versions);
          }
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
    const base = existingVersions.length > 0 ? existingVersions[0].version : (ble.currentFirmwareVer || '1.0.0');
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
      setAlertMessage('Admin secret password is required to publish firmware.');
      return;
    }

    if (!selectedFile) {
      setAlertType('error');
      setAlertMessage('Please select or drop a valid .bin firmware binary file.');
      return;
    }

    if (!ver || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.*)?$/.test(ver)) {
      setAlertType('error');
      setAlertMessage('Invalid SemVer format. Example: 1.1.7 or 1.2.0');
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
              setAlertMessage(`Firmware v${ver} published successfully! Size: ${((res.manifest?.size || selectedFile.size) / 1024).toFixed(1)} KB${isStable ? ' [STABLE RELEASE]' : ''}`);
              setSelectedFile(null);
              setReleaseDescription('');
              fetchExistingVersions();
              ble.fetchFirmwareVersions();
            } else {
              setAlertType('error');
              setAlertMessage(res.error || res.message || 'Upload rejected by server.');
            }
          } catch (err: any) {
            setAlertType('error');
            setAlertMessage(`Server response error: ${xhr.statusText || err.message}`);
          }
        };

        xhr.onerror = () => {
          setIsUploading(false);
          setAlertType('error');
          setAlertMessage('Network error during upload. Ensure the backend server is reachable.');
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

  const filteredVersions = existingVersions.filter((v) =>
    v.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.channel && v.channel.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', width: '100%' }}>
      {/* Back Link */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => navigate('/settings/update')}
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
          <span>Back to Updates</span>
        </button>
      </div>

      {/* =================================================================
           1. MANUAL BINARY DISPATCH & PUBLISH
           ================================================================= */}
      <div style={{ padding: '4px 0 16px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UploadCloud size={15} strokeWidth={2.6} color="#2563eb" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1e3a8a', letterSpacing: '0.6px' }}>
              MANUAL BINARY UPLOAD &amp; DISPATCH
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span 
              style={{
                fontSize: '0.55rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '2px 6px',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1'
              }}
            >
              ESP32-WROOM-32
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Step 1: Admin Secret */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label 
                htmlFor="upload_admin_pwd" 
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}
              >
                <Lock size={12} strokeWidth={2.4} color="#d97706" />
                <span>ADMIN AUTHORIZATION SECRET</span>
              </label>
              <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-mono, monospace)' }}>
                REQUIRED
              </span>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type={showPassword ? 'text' : 'password'}
                id="upload_admin_pwd"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter server admin password"
                required
                style={{
                  width: '100%',
                  padding: '7px 34px 7px 10px',
                  background: '#ffffff',
                  border: '1.5px solid #090d16',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#090d16',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: '#64748b'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} strokeWidth={2.2} /> : <Eye size={14} strokeWidth={2.2} />}
              </button>
            </div>
          </div>

          {/* Step 2: Binary File Dropzone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}>
                <FileCode2 size={12} strokeWidth={2.4} color="#d97706" />
                <span>COMPILED FIRMWARE BINARY (.BIN)</span>
              </span>
              <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-mono, monospace)' }}>
                REQUIRED
              </span>
            </div>

            <div 
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onClick={() => {
                const el = document.getElementById('upload_file_input');
                if (el) el.click();
              }}
              style={{
                border: isDragging ? '2px dashed #2563eb' : selectedFile ? '2px solid #16a34a' : '2px dashed #94a3b8',
                background: isDragging ? '#eff6ff' : selectedFile ? '#f0fdf4' : '#fafafa',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              <input 
                type="file" 
                id="upload_file_input" 
                accept=".bin" 
                onChange={handleFileInputChange} 
                style={{ display: 'none' }}
              />

              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ padding: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <FileCheck size={22} color="#16a34a" strokeWidth={2.4} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#090d16', fontFamily: 'var(--font-mono, monospace)' }}>
                        {selectedFile.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.58rem', fontFamily: 'var(--font-mono, monospace)', color: '#64748b' }}>
                        <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span style={{ color: '#16a34a', fontWeight: 800 }}>READY TO FLASH</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSelectedFile();
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid #cbd5e1',
                      padding: 4,
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Remove file"
                  >
                    <X size={14} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <UploadCloud size={24} color="#d97706" strokeWidth={2.2} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#090d16', fontFamily: 'var(--font-mono, monospace)' }}>
                    DROP COMPILED .BIN FILE HERE
                  </span>
                  <span style={{ fontSize: '0.58rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                    or click to browse local filesystem
                  </span>
                </div>
              )}
            </div>

            {fileError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#dc2626', fontSize: '0.62rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, marginTop: 2 }}>
                <AlertTriangle size={12} strokeWidth={2.4} />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          {/* Step 3: Target Version & Channel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {/* Target Version */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label 
                  htmlFor="upload_target_version"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}
                >
                  <Tag size={12} strokeWidth={2.4} color="#d97706" />
                  <span>TARGET VERSION (SEMVER)</span>
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button 
                    type="button" 
                    onClick={() => suggestNextVersion('patch')}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '1px 5px',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    +Patch
                  </button>
                  <button 
                    type="button" 
                    onClick={() => suggestNextVersion('minor')}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '1px 5px',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    +Minor
                  </button>
                </div>
              </div>

              <input 
                type="text" 
                id="upload_target_version"
                value={targetVersion}
                onChange={(e) => setTargetVersion(e.target.value)}
                placeholder="e.g. 1.1.7"
                pattern="^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.*)?$"
                required
                style={{
                  padding: '7px 10px',
                  background: '#ffffff',
                  border: '1.5px solid #090d16',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#090d16',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            {/* Release Channel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}>
                <Layers size={12} strokeWidth={2.4} color="#d97706" />
                <span>RELEASE CHANNEL</span>
              </span>

              <div style={{ display: 'flex', gap: 6, height: 32 }}>
                {(['stable', 'beta', 'dev'] as const).map((ch) => {
                  const isActive = releaseChannel === ch;
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setReleaseChannel(ch)}
                      style={{
                        flex: 1,
                        background: isActive ? '#090d16' : '#ffffff',
                        border: '1.5px solid #090d16',
                        color: isActive ? '#ffffff' : '#475569',
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        fontFamily: 'var(--font-mono, monospace)',
                        cursor: 'pointer',
                        letterSpacing: '0.4px',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      {ch.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 4: Release Notes & Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label 
                htmlFor="upload_release_desc" 
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}
              >
                <FileText size={12} strokeWidth={2.4} color="#d97706" />
                <span>RELEASE NOTES &amp; CHANGELOG</span>
              </label>
              <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                OPTIONAL
              </span>
            </div>

            <textarea 
              id="upload_release_desc"
              value={releaseDescription}
              onChange={(e) => setReleaseDescription(e.target.value)}
              placeholder="Describe new features, bug fixes, or OTA improvements..."
              rows={2}
              style={{
                width: '100%',
                padding: '7px 10px',
                background: '#ffffff',
                border: '1.5px solid #090d16',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.7rem',
                color: '#090d16',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Step 5: Promote as Latest Stable Release Switch */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono, monospace)' }}>
                PROMOTE AS LATEST STABLE RELEASE
              </span>
              <span style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                Connected robots will immediately receive this version as their recommended update.
              </span>
            </div>
            <CyberSwitch 
              checked={isStable}
              onChange={(c) => setIsStable(c)}
              title="Promote as latest stable release"
            />
          </div>

          {/* Live Upload Streaming Meter */}
          {isUploading && (
            <div style={{ padding: 12, background: '#090d16', border: '1.5px solid #090d16', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', color: '#ffffff' }}>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>TRANSMITTING BINARY PAYLOAD...</span>
                <span style={{ fontWeight: 900, color: '#38bdf8' }}>{uploadProgress}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#1e293b', overflow: 'hidden' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#dc2626', transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>
                <span>{(uploadedBytes / 1024).toFixed(1)} KB / {(totalBytes / 1024).toFixed(1)} KB</span>
                <span style={{ color: '#22c55e' }}>STREAM: ACTIVE</span>
              </div>
            </div>
          )}

          {/* Alert Message Banner */}
          {alertMessage && (
            <div 
              style={{
                padding: '10px 12px',
                background: alertType === 'success' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1.5px solid ${alertType === 'success' ? '#16a34a' : '#dc2626'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {alertType === 'success' ? (
                <CheckCircle2 size={16} color="#16a34a" />
              ) : (
                <AlertTriangle size={16} color="#dc2626" />
              )}
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: alertType === 'success' ? '#16a34a' : '#dc2626', fontFamily: 'var(--font-mono, monospace)' }}>
                {alertMessage}
              </span>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isUploading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'var(--red-primary, #dc2626)',
                border: '1.5px solid #090d16',
                color: '#ffffff',
                padding: '9px 16px',
                fontSize: '0.72rem',
                fontWeight: 900,
                fontFamily: 'var(--font-mono, monospace)',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
                letterSpacing: '0.6px'
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" strokeWidth={2.4} />
                  <span>TRANSMITTING FIRMWARE ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={15} strokeWidth={2.4} />
                  <span>UPLOAD &amp; PUBLISH FIRMWARE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* =================================================================
           2. ACTIVE FIRMWARE REPOSITORY (STORAGE)
           ================================================================= */}
      <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardDrive size={15} strokeWidth={2.6} color="#475569" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#334155', letterSpacing: '0.6px' }}>
              PUBLISHED REPOSITORY RELEASES
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.58rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#64748b' }}>
              {existingVersions.length} PACKAGES
            </span>
            <button
              type="button"
              onClick={fetchExistingVersions}
              disabled={isLoadingVersions}
              style={{
                background: 'none',
                border: '1px solid #cbd5e1',
                padding: '3px 6px',
                cursor: 'pointer',
                color: '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.58rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 800
              }}
              title="Refresh repository"
            >
              <RefreshCw size={11} className={isLoadingVersions ? 'animate-spin' : ''} strokeWidth={2.4} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        {/* Search Input Filter */}
        <div>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search version, channel, or notes..."
            style={{
              width: '100%',
              padding: '6px 10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono, monospace)',
              color: '#090d16',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {/* Versions Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoadingVersions && existingVersions.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: '#64748b', fontSize: '0.68rem', fontFamily: 'var(--font-mono, monospace)' }}>
              Loading firmware repository...
            </div>
          ) : filteredVersions.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: '#94a3b8', fontSize: '0.68rem', fontFamily: 'var(--font-mono, monospace)', background: '#fafafa', border: '1px solid #f1f5f9' }}>
              No firmware releases found matching query.
            </div>
          ) : (
            filteredVersions.map((ver, idx) => (
              <div 
                key={ver.version}
                style={{
                  padding: '10px 12px',
                  background: '#fafafa',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#090d16', fontFamily: 'var(--font-mono, monospace)' }}>
                      v{ver.version}
                    </span>
                    <span 
                      style={{
                        fontSize: '0.52rem',
                        fontWeight: 900,
                        fontFamily: 'var(--font-mono, monospace)',
                        padding: '1px 5px',
                        background: (ver.channel === 'beta' || ver.channel === 'dev') ? 'rgba(234, 88, 12, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: (ver.channel === 'beta' || ver.channel === 'dev') ? '#c2410c' : '#16a34a'
                      }}
                    >
                      {(ver.channel || 'STABLE').toUpperCase()}
                    </span>
                    {idx === 0 && (
                      <span 
                        style={{
                          fontSize: '0.52rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-mono, monospace)',
                          padding: '1px 5px',
                          background: '#090d16',
                          color: '#ffffff'
                        }}
                      >
                        LATEST
                      </span>
                    )}
                  </div>

                  <div>
                    <a 
                      href={`/firmware/esp32/${ver.version}/firmware.bin`}
                      download={`firmware-${ver.version}.bin`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#090d16',
                        textDecoration: 'none',
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono, monospace)'
                      }}
                      title="Download compiled binary"
                    >
                      <DownloadCloud size={11} strokeWidth={2.4} />
                      <span>DOWNLOAD .BIN</span>
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: '0.58rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                  {ver.size > 0 && <span>Size: <strong>{(ver.size / 1024).toFixed(1)} KB</strong></span>}
                  {ver.releasedAt && (
                    <span>
                      Released: <strong>{new Date(ver.releasedAt).toLocaleDateString()}</strong>
                    </span>
                  )}
                  {ver.sha256 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span>SHA: <strong style={{ color: '#0284c7' }}>{ver.sha256.substring(0, 14)}...</strong></span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ver.sha256)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: '#64748b' }}
                        title="Copy SHA-256"
                      >
                        {copiedSha === ver.sha256 ? <Check size={10} color="#16a34a" /> : <Copy size={10} />}
                      </button>
                    </div>
                  )}
                </div>

                {ver.description && (
                  <div style={{ fontSize: '0.62rem', color: '#334155', fontFamily: 'var(--font-mono, monospace)', background: '#ffffff', padding: '4px 6px', border: '1px solid #f1f5f9' }}>
                    {ver.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsUploadPage;
