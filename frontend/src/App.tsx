import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { globalBle, useBLE } from './lib/ble';
import LoadingScreen from './components/LoadingScreen';
import RotateNotice from './components/RotateNotice';
import TopBar from './components/TopBar';
import LeftControls from './components/LeftControls';
import CenterPanel from './components/CenterPanel';
import RightPanel from './components/RightPanel';
import GuidePage from './components/GuidePage';
import ConnectBluetoothPage from './pages/ConnectBluetoothPage';
import CustomAlertModal from './components/CustomAlertModal';

// Multi-Route Settings Page Components
import SettingsLayout from './pages/settings/SettingsLayout';
import SettingsGeneralPage from './pages/settings/SettingsGeneralPage';
import SettingsWifiPage from './pages/settings/SettingsWifiPage';
import SettingsUpdatePage from './pages/settings/SettingsUpdatePage';
import SettingsUploadPage from './pages/settings/SettingsUploadPage';

function CockpitDashboard() {
  const ble = useBLE(globalBle);
  const navigate = useNavigate();

  // If the device is not connected, show the standalone Bluetooth Connect Page
  if (!ble.isConnected && !ble.isWifiWsConnected) {
    return <ConnectBluetoothPage ble={ble} />;
  }

  return (
    <>
      {/* Portrait Lock Warning Screen */}
      <RotateNotice />

      {/* Main Cockpit Landscape Shell */}
      <main className="cockpit-container" style={{ padding: 0, gap: 0, width: '100vw', height: '100dvh' }}>
        {/* Full-width, very-top Status Bar */}
        <TopBar 
          ble={ble} 
          onOpenWifi={() => navigate('/settings/wifi')}
          onOpenSettings={() => navigate('/settings')}
        />

        {/* Three-Column Cockpit Surface */}
        <div className="cockpit-workspace" style={{ padding: '6px 8px', flex: 1, minHeight: 0 }}>
          {/* Left Hand: Touch Joystick, D-Pad, Differential */}
          <LeftControls ble={ble} />

          {/* Center: Ultrasonic Radar, Headlights & Horn, Throttle Quadrant */}
          <CenterPanel ble={ble} />

          {/* Right Hand: Dead-Reckoning Minimap HUD & Telemetry Logs */}
          <RightPanel ble={ble} />
        </div>
      </main>
    </>
  );
}

function StandaloneUploadRedirect() {
  useEffect(() => {
    window.location.replace('/upload.html');
  }, []);
  return null;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const ble = useBLE(globalBle);

  const isNavigableRoute = useMemo(() => {
    return ['/settings', '/upload', '/admin', '/guide'].some((p) => location.pathname.startsWith(p));
  }, [location.pathname]);

  // Keyboard Shortcuts (WASD / Arrows / Space)
  const keysDownRef = useRef<Set<string>>(new Set());

  const computeDirection = (): string => {
    const keys = keysDownRef.current;
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');

    if (up && left) return 'G';
    if (up && right) return 'I';
    if (down && left) return 'H';
    if (down && right) return 'J';
    if (up) return 'F';
    if (down) return 'B';
    if (left) return 'L';
    if (right) return 'R';
    return 'S';
  };

  useEffect(() => {
    // Only capture controls if on cockpit and connected
    if (isNavigableRoute || (!ble.isConnected && !ble.isWifiWsConnected)) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.repeat) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'Space') {
        ble.setDriveMode('MANUAL');
        ble.sendCommand('S', true);
        return;
      }

      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        keysDownRef.current.add(e.code);
        if (ble.driveMode !== 'MANUAL') ble.setDriveMode('MANUAL');
        ble.sendCommand(computeDirection());
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        keysDownRef.current.delete(e.code);
        ble.sendCommand(computeDirection());
      }
    };

    let gamepadAnimId: number | null = null;
    let lastGamepadCmd = 'S';

    const pollGamepad = () => {
      if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

        if (gp && gp.connected) {
          const axisX = gp.axes[0] || 0;
          const axisY = gp.axes[1] || 0;
          const deadzone = 0.25;

          let cmd = 'S';
          if (Math.abs(axisX) > deadzone || Math.abs(axisY) > deadzone) {
            const normY = -axisY;
            const angle = Math.atan2(normY, axisX) * (180 / Math.PI);
            if (angle >= 67.5 && angle < 112.5) cmd = 'F';
            else if (angle >= 22.5 && angle < 67.5) cmd = 'I';
            else if (angle >= -22.5 && angle < 22.5) cmd = 'R';
            else if (angle >= -67.5 && angle < -22.5) cmd = 'J';
            else if (angle >= -112.5 && angle < -67.5) cmd = 'B';
            else if (angle >= -157.5 && angle < -112.5) cmd = 'H';
            else if (angle >= 112.5 && angle < 157.5) cmd = 'G';
            else cmd = 'L';
          }

          if (cmd !== lastGamepadCmd) {
            lastGamepadCmd = cmd;
            if (ble.driveMode !== 'MANUAL') ble.setDriveMode('MANUAL');
            ble.sendCommand(cmd);
          }
        }
      }
      gamepadAnimId = requestAnimationFrame(pollGamepad);
    };

    const preventDefaults = (e: Event) => {
      e.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        ble.requestWakeLock();
      }
    };

    const handleFirstUserInteraction = () => {
      ble.requestWakeLock();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('contextmenu', preventDefaults, { passive: false });
    window.addEventListener('selectstart', preventDefaults, { passive: false });
    window.addEventListener('gesturestart', preventDefaults, { passive: false });
    window.addEventListener('pointerdown', handleFirstUserInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstUserInteraction, { once: true, passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    ble.requestWakeLock();
    gamepadAnimId = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('contextmenu', preventDefaults);
      window.removeEventListener('selectstart', preventDefaults);
      window.removeEventListener('gesturestart', preventDefaults);
      window.removeEventListener('pointerdown', handleFirstUserInteraction);
      window.removeEventListener('touchstart', handleFirstUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      ble.releaseWakeLock();
      if (gamepadAnimId) cancelAnimationFrame(gamepadAnimId);
    };
  }, [isNavigableRoute, ble]);

  return (
    <>
      {/* Root-Level Splash Loading Screen: runs once on fresh app boot */}
      <LoadingScreen />

      <Routes>
        {/* Route: / -> Cockpit Dashboard or Standalone Connect Page */}
        <Route path="/" element={<CockpitDashboard />} />

        {/* Nested Settings Pages (/settings, /settings/wifi, /settings/update, /settings/upload) */}
        <Route path="/settings" element={<SettingsLayout ble={ble} />}>
          <Route index element={<SettingsGeneralPage ble={ble} />} />
          <Route path="wifi" element={<SettingsWifiPage ble={ble} />} />
          <Route path="update" element={<SettingsUpdatePage ble={ble} />} />
          <Route path="upload" element={<SettingsUploadPage ble={ble} />} />
        </Route>

        {/* Route: /upload & /admin -> Direct browser redirect to standalone upload.html */}
        <Route path="/upload" element={<StandaloneUploadRedirect />} />
        <Route path="/admin" element={<StandaloneUploadRedirect />} />

        {/* Route: /guide -> Avionics & ESP32 Wiring Diagram */}
        <Route path="/guide" element={<GuidePage onNavigateHome={() => navigate('/')} />} />

        {/* Fallback to Cockpit */}
        <Route path="*" element={<CockpitDashboard />} />
      </Routes>

      {/* Global Custom Alert Modal */}
      <CustomAlertModal ble={ble} />
    </>
  );
}