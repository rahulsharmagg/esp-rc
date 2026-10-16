import { useSyncExternalStore } from 'react';
import type { 
  DriveMode, 
  LogEntry, 
  WifiNetwork, 
  WifiStatus,
  OtaStatus,
  FirmwareVersionInfo,
  FirmwareLatestResponse,
  FirmwareVersionsResponse,
  Esp32FirmwareCheckResponse,
  Esp32VersionsListResponse,
  CustomAlertConfig,
  Esp32FirmwareSessionResponse
} from './types';

const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export class BLEController {
  private listeners = new Set<() => void>();
  version = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  notify = () => {
    this.version++;
    this.listeners.forEach((l) => l());
  };

  // Connection State (Real Device BLE Operation)
  isConnected = false;
  isConnecting = false;
  deviceName = 'DISCONNECTED';
  latency = 0;
  autoReconnect = false;

  // Direct LAN Wi-Fi WebSocket Link
  isWifiWsConnected = false;
  isConnectingWifiWs = false;
  private wifiWs: WebSocket | null = null;
  get activeConnectionMode(): 'BLE' | 'LAN' | 'HYBRID' | 'OFFLINE' {
    if (this.isConnected && this.isWifiWsConnected) return 'HYBRID';
    if (this.isWifiWsConnected) return 'LAN';
    if (this.isConnected) return 'BLE';
    return 'OFFLINE';
  }

  // Telemetry (Realistic initial mock data for cockpit development)
  uptime = '05:22';
  driveMode: DriveMode = 'MANUAL';
  batteryPct = 88;
  batteryVolts = 7.8;
  get hasBattery(): boolean {
    return this.batteryPct >= 0 && this.batteryVolts >= 5.0;
  }
  distance = 145;
  irLeft = false;
  irRight = false;
  servoAngle = 90;

  // Actuator & Driving
  currentSpeed = 200;
  preTurboSpeed = 200;
  isTurbo = false;
  isLightsOn = false;
  isHornOn = false;

  // Logs
  logs: LogEntry[] = [];
  private nextLogId = 0;

  // Preferences
  hapticEnabled = true;
  wakeLockEnabled = true;
  wakeLockActive = false;
  private wakeLockSentinel: any = null;

  // Hardware Sensor On/Off Toggles
  ultrasonicEnabled = true;
  irLeftEnabled = true;
  irRightEnabled = true;
  servoEnabled = true;

  setSensorEnabled(sensor: 'ultrasonic' | 'irLeft' | 'irRight' | 'servo', enabled: boolean) {
    if (sensor === 'ultrasonic') {
      this.ultrasonicEnabled = enabled;
      this.sendCommand(enabled ? 'E:US:1' : 'E:US:0', true);
      this.log(`Ultrasonic Ranger ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
    } else if (sensor === 'irLeft') {
      this.irLeftEnabled = enabled;
      this.sendCommand(enabled ? 'E:IRL:1' : 'E:IRL:0', true);
      this.log(`Left IR Sensor ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
    } else if (sensor === 'irRight') {
      this.irRightEnabled = enabled;
      this.sendCommand(enabled ? 'E:IRR:1' : 'E:IRR:0', true);
      this.log(`Right IR Sensor ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
    } else if (sensor === 'servo') {
      this.servoEnabled = enabled;
      this.sendCommand(enabled ? 'E:SRV:1' : 'E:SRV:0', true);
      this.log(`Radar Servo Gimbal ${enabled ? 'ENABLED' : 'DISABLED'}`, 'info');
    }
    this.vibrate(10);
    this.notify();
  }

  // Wi-Fi State
  wifi: WifiStatus = {
    enabled: false,
    connected: false,
    ssid: '',
    ip: '0.0.0.0',
    rssi: 0
  };
  wifiNetworks: WifiNetwork[] = [];
  isScanningWifi = false;

  // OTA Firmware Update State
  otaStatus: OtaStatus = 'IDLE';
  otaProgress = 0;
  otaMessage = '';
  currentFirmwareVer = '1.0.2';
  latestFirmwareVer = '1.0.2';
  latestFirmwareUrl = '';
  latestFirmwareSize = 0;
  latestFirmwareSha256 = '';
  latestFirmwareReleasedAt = '';
  targetFlashingVersion = '';
  hasFirmwareUpdate = false;
  hasCheckedFirmware = false;
  latestFirmwareDescription = '';
  availableVersions: FirmwareVersionInfo[] = [];
  selectedVersion = '';
  isCheckingFirmware = false;

  // Internal Bluetooth primitives
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;

  // Transmission Rate Limiting & Queue
  private pendingCommand: string | null = null;
  private lastSentCommand: string = '';
  private lastSentTimestamp: number = 0;
  private minSendIntervalMs: number = 40;
  private sendTimer: any = null;
  private pingStartTime: number = 0;

  // Minimap callback hook
  onMovementChange?: (cmd: string, speed: number) => void;

  // Custom Alert Modal State
  alertConfig: CustomAlertConfig | null = null;

  showAlert(config: CustomAlertConfig | string) {
    if (typeof config === 'string') {
      this.alertConfig = {
        title: 'NOTIFICATION',
        message: config,
        type: 'warning',
        confirmText: 'OK'
      };
    } else {
      this.alertConfig = {
        confirmText: 'OK',
        ...config
      };
    }
    this.notify();
  }

  showBluetoothAlert(message = 'Please connect your ESP32 device via Bluetooth first.') {
    this.alertConfig = {
      title: 'BLUETOOTH REQUIRED',
      message,
      type: 'bluetooth',
      confirmText: 'PAIR & CONNECT',
      cancelText: 'DISMISS',
      onConfirm: () => {
        this.connect();
      }
    };
    this.notify();
  }

  closeAlert() {
    this.alertConfig = null;
    this.notify();
  }

  constructor() {
    if (typeof window !== 'undefined') {
      // Intercept window.alert so all calls cleanly render our custom cyber modal
      try {
        window.alert = (msg: string) => {
          this.showAlert(msg);
        };
      } catch (_) {}

      const savedHaptic = localStorage.getItem('esp32_rc_haptic');
      if (savedHaptic !== null) {
        this.hapticEnabled = savedHaptic !== 'false';
      }
      const savedWakeLock = localStorage.getItem('esp32_rc_wakelock');
      if (savedWakeLock !== null) {
        this.wakeLockEnabled = savedWakeLock !== 'false';
      }
    }
  }

  async requestWakeLock() {
    if (!this.wakeLockEnabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }
    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
        this.wakeLockActive = true;
        this.notify();
        return;
      }
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockActive = true;
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockActive = false;
        this.notify();
      });
      this.log('💡 Screen Wake Lock active (Always On)', 'info');
      this.notify();
    } catch (err: any) {
      this.wakeLockActive = false;
      console.warn('[WakeLock] Could not acquire lock:', err.message);
      this.notify();
    }
  }

  async releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch (err) {}
      this.wakeLockSentinel = null;
    }
    this.wakeLockActive = false;
    this.notify();
  }

  setWakeLock(enable: boolean) {
    this.wakeLockEnabled = enable;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('esp32_rc_wakelock', enable.toString());
    }
    if (enable) {
      this.requestWakeLock();
    } else {
      this.releaseWakeLock();
      this.log('Screen Wake Lock disabled', 'info');
    }
    this.notify();
  }

  setHaptic(enable: boolean) {
    this.hapticEnabled = enable;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('esp32_rc_haptic', enable.toString());
    }
    if (enable) {
      this.vibrate(20);
    }
    this.notify();
  }

  log(msg: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const time = new Date().toTimeString().split(' ')[0];
    const entry: LogEntry = {
      id: ++this.nextLogId,
      timestamp: time,
      message: msg,
      type
    };
    this.logs = [entry, ...this.logs.slice(0, 49)];
    this.notify();
  }

  vibrate(pattern: number | number[]) {
    if (!this.hapticEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (navigator.userActivation && !navigator.userActivation.isActive && !navigator.userActivation.hasBeenActive) {
          return;
        }
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  connectMock(name = 'ESP32_ROBOT_DEV') {
    this.isConnected = true;
    this.isConnecting = false;
    this.deviceName = name;
    this.latency = 12;
    this.batteryPct = 88;
    this.batteryVolts = 7.8;
    this.distance = 145;
    this.uptime = '05:22';
    this.log(`Connected to simulated device [${name}] for development.`, 'success');
    this.notify();
  }

  lastError: string | null = null;

  async connect() {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      this.lastError = 'Web Bluetooth is not supported on this browser (Chrome / Edge / Bluefy required)';
      this.log(this.lastError, 'error');
      this.notify();
      return;
    }

    try {
      this.isManuallyDisconnected = false;
      this.lastError = null;
      this.isConnecting = true;
      this.notify();
      this.log('Scanning for ESP32 BLE UART device...');

      // Attempt with common name prefixes or acceptAllDevices if filters fail
      try {
        this.device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: 'ESP32' },
            { namePrefix: 'RC' },
            { namePrefix: 'ESP' },
            { services: [NORDIC_UART_SERVICE_UUID] }
          ],
          optionalServices: [NORDIC_UART_SERVICE_UUID, 'device_information', 0x180a]
        });
      } catch (filterErr: any) {
        // If user cancelled, rethrow
        if (filterErr.name === 'NotFoundError') {
          throw filterErr;
        }
        // Fallback: accept all devices with optional Nordic UART service
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [NORDIC_UART_SERVICE_UUID, 'device_information', 0x180a]
        });
      }

      this.device.addEventListener('gattserverdisconnected', () => this.handleDisconnected());

      this.log(`Connecting to GATT Server [${this.device.name || 'ESP32'}]...`);
      this.server = await this.device.gatt!.connect();

      try {
        const disService = await this.server.getPrimaryService(0x180a);
        if (disService) {
          const fwChar = await disService.getCharacteristic(0x2a26);
          if (fwChar) {
            const fwVal = await fwChar.readValue();
            const fwStr = new TextDecoder().decode(fwVal).trim();
            if (fwStr) {
              this.currentFirmwareVer = fwStr;
              this.log(`Device reported Firmware: v${fwStr} via DIS`, 'info');
            }
          }
        }
      } catch (_) {}

      this.log('Accessing Nordic UART Primary Service...');
      const service = await this.server.getPrimaryService(NORDIC_UART_SERVICE_UUID);

      this.log('Locating RX & TX Characteristics...');
      this.rxChar = await service.getCharacteristic(NORDIC_UART_RX_CHAR_UUID);
      this.txChar = await service.getCharacteristic(NORDIC_UART_TX_CHAR_UUID);

      this.log('Subscribing to TX Telemetry Notifications...');
      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', (e: Event) => this.handleTelemetryNotification(e));

      this.isConnected = true;
      this.isConnecting = false;
      this.deviceName = this.device.name || 'ESP32-RC';
      this.log(`Connected to ${this.deviceName} successfully!`, 'success');
      this.vibrate([30, 40, 30]);

      this.sendSpeed(this.currentSpeed);
      this.setDriveMode('MANUAL');
      this.sendCommand('OTA:VERSION', true);
      this.sendCommand('WIFI:STATUS', true);
      this.notify();
    } catch (err: any) {
      this.isConnecting = false;
      if (err.name === 'NotFoundError') {
        this.log('Bluetooth pairing cancelled by user', 'info');
      } else {
        this.lastError = err.message || 'Failed to connect to Bluetooth device';
        this.log(`Bluetooth connection error: ${this.lastError}`, 'error');
      }
      this.notify();
    }
  }

  private reconnectTimer: any = null;
  private isManuallyDisconnected = false;

  async reconnectGatt(): Promise<boolean> {
    if (!this.device || !this.device.gatt) return false;
    if (this.isConnected || this.isConnecting) return true;

    try {
      this.isConnecting = true;
      this.notify();
      this.log(`Silent auto-reconnecting to GATT server [${this.device.name || 'ESP32'}]...`, 'info');

      this.server = await this.device.gatt.connect();

      const service = await this.server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
      this.rxChar = await service.getCharacteristic(NORDIC_UART_RX_CHAR_UUID);
      this.txChar = await service.getCharacteristic(NORDIC_UART_TX_CHAR_UUID);

      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', (e: Event) => this.handleTelemetryNotification(e));

      this.isConnected = true;
      this.isConnecting = false;
      this.lastError = null;
      this.deviceName = this.device.name || 'ESP32-RC';
      this.log(`Reconnected to ${this.deviceName} silently!`, 'success');
      this.vibrate([20, 20]);

      this.sendSpeed(this.currentSpeed);
      this.setDriveMode('MANUAL');
      this.sendCommand('WIFI:STATUS', true);
      this.notify();
      return true;
    } catch (err: any) {
      this.isConnecting = false;
      this.notify();
      return false;
    }
  }

  async disconnect() {
    this.isManuallyDisconnected = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.log('Disconnecting from ESP32...');
      this.sendCommand('S', true);
      this.device.gatt.disconnect();
    }
    this.handleDisconnected();
  }

  private handleDisconnected() {
    this.isConnected = false;
    this.isConnecting = false;
    this.deviceName = 'DISCONNECTED';
    this.latency = 0;
    this.uptime = '00:00';
    this.distance = 300;
    this.log('ESP32 Bluetooth Disconnected', 'warn');
    this.vibrate([100, 50, 100]);

    if (this.otaStatus === 'UPDATING') {
      if (this.cloudWs && this.cloudWs.readyState === WebSocket.OPEN) {
        this.otaMessage = 'Bluetooth closed to allocate RAM. Streaming live progress via WebSocket relay...';
        this.log('📡 BLE disconnected (RAM freed for OTA). Live WebSocket stream active.', 'info');
      } else {
        this.otaProgress = Math.max(this.otaProgress, 10);
        this.otaMessage = 'ESP32 is downloading and flashing over Wi-Fi. It will auto-reboot in ~15-20s. Click RECONNECT once rebooted.';
        this.log('ℹ️ BLE disconnected while ESP32 updates over Wi-Fi.', 'info');
      }
    }

    // Silent background auto-reconnect if disconnection was unexpected
    if (!this.isManuallyDisconnected && this.device) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      const attemptSilentReconnect = async () => {
        if (this.isConnected || this.isManuallyDisconnected) return;
        const ok = await this.reconnectGatt();
        if (!ok && !this.isManuallyDisconnected) {
          // Retry again silently in 2.5 seconds
          this.reconnectTimer = setTimeout(attemptSilentReconnect, 2500);
        }
      };
      this.reconnectTimer = setTimeout(attemptSilentReconnect, 1500);
    }

    this.notify();
  }

  connectWifiLan(targetIp?: string) {
    const ip = targetIp || this.wifi.ip;
    if (!ip || ip === '0.0.0.0') {
      this.log('Cannot connect LAN WebSocket: ESP32 has no valid IP address', 'error');
      return;
    }
    if (this.wifiWs) {
      this.wifiWs.close();
      this.wifiWs = null;
    }

    try {
      this.isConnectingWifiWs = true;
      this.notify();
      const wsUrl = `ws://${ip}:81`;
      this.log(`Connecting directly to ESP32 over Wi-Fi LAN [${wsUrl}]...`, 'info');
      this.wifiWs = new WebSocket(wsUrl);

      this.wifiWs.onopen = () => {
        this.isWifiWsConnected = true;
        this.isConnectingWifiWs = false;
        this.log(`✅ Direct Wi-Fi LAN Connected (${ip}:81)! Long-range control active.`, 'success');
        this.vibrate([30, 40, 30]);
        this.sendCommand('OTA:VERSION', true);
        this.sendCommand('WIFI:STATUS', true);
        this.notify();
      };

      this.wifiWs.onmessage = (e) => {
        if (typeof e.data === 'string') {
          this.handleIncomingMessage(e.data.trim());
        }
      };

      this.wifiWs.onerror = () => {
        this.isConnectingWifiWs = false;
        this.log(`Could not connect LAN WebSocket to ${ip}:81.`, 'warn');
        this.notify();
      };

      this.wifiWs.onclose = () => {
        this.isWifiWsConnected = false;
        this.isConnectingWifiWs = false;
        this.wifiWs = null;
        this.log('LAN Wi-Fi WebSocket disconnected.', 'info');
        this.notify();
      };
    } catch (err: any) {
      this.isConnectingWifiWs = false;
      this.log(`LAN WebSocket error: ${err.message}`, 'error');
      this.notify();
    }
  }

  connectWithRcCode(code: string) {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    if (this.wifiWs) {
      this.wifiWs.close();
      this.wifiWs = null;
    }

    try {
      this.isConnectingWifiWs = true;
      this.notify();

      let host = 'rc.codeblaze.in';
      let protocol = 'wss:';
      if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h && h !== 'localhost' && h !== '127.0.0.1') {
          host = window.location.host;
          protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        }
      }

      const wsUrl = `${protocol}//${host}/ws?role=controller&code=${encodeURIComponent(cleanCode)}`;
      this.log(`Linking with RC Code [${cleanCode}] via ${wsUrl}...`, 'info');
      this.wifiWs = new WebSocket(wsUrl);

      this.wifiWs.onopen = () => {
        this.isWifiWsConnected = true;
        this.isConnectingWifiWs = false;
        this.deviceName = `RC-${cleanCode}`;
        this.log(`✅ Linked with RC Robot [${cleanCode}]! Cockpit active.`, 'success');
        this.vibrate([40, 30, 40]);
        this.wifiWs?.send(JSON.stringify({ type: 'JOIN_SESSION', code: cleanCode, role: 'controller' }));
        this.notify();
      };

      this.wifiWs.onmessage = (e) => {
        if (typeof e.data === 'string') {
          if (e.data.startsWith('{')) {
            try {
              const parsed = JSON.parse(e.data);
              if (parsed.message) this.handleIncomingMessage(parsed.message);
              if (parsed.cmd) this.handleIncomingMessage(parsed.cmd);
            } catch (_) {}
          } else {
            this.handleIncomingMessage(e.data.trim());
          }
        }
      };

      this.wifiWs.onerror = () => {
        this.isConnectingWifiWs = false;
        this.log(`Failed to link with RC Code ${cleanCode}.`, 'error');
        this.notify();
      };

      this.wifiWs.onclose = () => {
        this.isWifiWsConnected = false;
        this.isConnectingWifiWs = false;
        this.wifiWs = null;
        this.log(`RC Link [${cleanCode}] disconnected.`, 'warn');
        this.notify();
      };
    } catch (err: any) {
      this.isConnectingWifiWs = false;
      this.log(`Connection error: ${err.message}`, 'error');
      this.notify();
    }
  }

  disconnectWifiLan() {
    if (this.wifiWs) {
      this.wifiWs.close();
      this.wifiWs = null;
    }
    this.isWifiWsConnected = false;
    this.isConnectingWifiWs = false;
    this.notify();
  }

  private isWriting = false;

  sendCommand(cmd: string, force = false) {
    if (!cmd) return;

    if (this.onMovementChange && !cmd.startsWith('E:') && !cmd.startsWith('V') && !cmd.startsWith('P:') && !cmd.startsWith('WIFI:') && !cmd.startsWith('OTA:')) {
      this.onMovementChange(cmd, this.currentSpeed);
    }

    if (!force && cmd === this.lastSentCommand && (Date.now() - this.lastSentTimestamp) < 120) {
      return;
    }

    if (this.isWifiWsConnected && this.wifiWs && this.wifiWs.readyState === WebSocket.OPEN) {
      try {
        this.wifiWs.send(cmd);
      } catch (_) {}
    }

    if (this.isConnected && this.rxChar) {
      this.pendingCommand = cmd;
      const now = Date.now();
      const elapsed = now - this.lastSentTimestamp;

      if (elapsed >= this.minSendIntervalMs && !this.isWriting) {
        this.flushCommand();
      } else if (!this.sendTimer) {
        this.sendTimer = setTimeout(() => {
          this.sendTimer = null;
          this.flushCommand();
        }, Math.max(10, this.minSendIntervalMs - elapsed));
      }
    }
  }

  private async flushCommand() {
    if (!this.pendingCommand || this.isWriting) return;
    const cmd = this.pendingCommand;
    this.pendingCommand = null;
    this.lastSentCommand = cmd;
    this.lastSentTimestamp = Date.now();

    if (!this.isConnected || !this.rxChar) return;

    this.isWriting = true;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(cmd + '\n');
      this.pingStartTime = performance.now();

      if (this.rxChar.writeValueWithoutResponse) {
        await this.rxChar.writeValueWithoutResponse(data);
      } else {
        await this.rxChar.writeValue(data);
      }
    } catch (err: any) {
      if (!err.message?.includes('already in progress')) {
        this.log(`Transmit error: ${err.message}`, 'error');
      }
    } finally {
      this.isWriting = false;
      if (this.pendingCommand) {
        setTimeout(() => this.flushCommand(), 10);
      }
    }
  }

  sendSpeed(val: number) {
    this.currentSpeed = Math.max(0, Math.min(255, val));
    this.sendCommand(`V${this.currentSpeed}`, true);
    this.notify();
  }

  setDriveMode(mode: DriveMode) {
    this.driveMode = mode;
    this.sendCommand(mode === 'AUTOMATIC' ? 'X' : 'M', true);
    this.log(`Drive mode set to: ${mode}`, 'info');
    this.notify();
  }

  toggleLights() {
    this.isLightsOn = !this.isLightsOn;
    this.sendCommand(this.isLightsOn ? 'W' : 'w', true);
    this.vibrate(15);
    this.log(`Headlights ${this.isLightsOn ? 'ON' : 'OFF'}`, 'info');
    this.notify();
  }

  setHorn(on: boolean) {
    this.isHornOn = on;
    this.sendCommand(on ? 'U' : 'u', true);
    if (on) this.vibrate([20, 20]);
    this.notify();
  }

  setServoAngle(angle: number) {
    const clamped = Math.max(0, Math.min(180, Math.round(angle)));
    this.servoAngle = clamped;
    this.sendCommand(`P:${clamped}`, true);
    this.notify();
  }

  setTurbo(enable: boolean) {
    if (enable && !this.isTurbo) {
      this.isTurbo = true;
      this.preTurboSpeed = this.currentSpeed;
      this.sendSpeed(255);
      this.vibrate([40, 30, 40]);
      this.log('⚡ TURBO BOOST ENGAGED (255 PWM / 100%)', 'warn');
    } else if (!enable && this.isTurbo) {
      this.isTurbo = false;
      const restored = this.preTurboSpeed || 200;
      this.sendSpeed(restored);
      this.log(`⚡ Turbo released. Restored to ${restored} PWM`, 'info');
    }
    this.notify();
  }

  setWifiPower(enable: boolean) {
    if (enable) {
      this.wifi.enabled = true;
      this.sendCommand('WIFI:ON', true);
      this.log('Wi-Fi Radio Enabled on ESP32', 'info');
      setTimeout(() => this.scanWifi(), 350);
    } else {
      this.wifi.enabled = false;
      this.wifi.connected = false;
      this.isScanningWifi = false;
      this.sendCommand('WIFI:OFF', true);
      this.log('Wi-Fi Radio Disabled (Battery Saver Mode)', 'warn');
    }
    this.notify();
  }

  scanWifi() {
    if (!this.wifi.enabled) this.setWifiPower(true);
    this.isScanningWifi = true;
    this.sendCommand('WIFI:SCAN', true);
    this.log('Scanning 2.4GHz Wi-Fi airwaves...', 'info');
    this.notify();

    if (!this.isConnected) {
      setTimeout(() => {
        this.isScanningWifi = false;
        this.wifiNetworks = [
          { ssid: 'Home_WiFi_2.4G', rssi: -48, isEncrypted: true },
          { ssid: 'ESP32_Test_Lab', rssi: -62, isEncrypted: true },
          { ssid: 'Open_Hotspot_Guest', rssi: -75, isEncrypted: false },
          { ssid: 'Workshop_AP', rssi: -83, isEncrypted: true }
        ];
        this.notify();
      }, 800);
    }
  }

  startWifiScan() {
    this.scanWifi();
  }

  connectToWifi(ssid: string, pass: string) {
    this.log(`Connecting ESP32 to Wi-Fi SSID [${ssid}]...`, 'info');
    try {
      const b64Ssid = btoa(unescape(encodeURIComponent(ssid)));
      const b64Pass = pass ? btoa(unescape(encodeURIComponent(pass))) : '';
      this.sendCommand(`WIFI:CONNB:${b64Ssid}:${b64Pass}`, true);
    } catch (_) {
      this.sendCommand(`WIFI:CONN:${ssid}:${pass}`, true);
    }
  }

  disconnectWifi() {
    this.sendCommand('WIFI:DISC', true);
    this.log('Disconnecting ESP32 from Wi-Fi AP...', 'warn');
    this.notify();
  }

  autoConnectWifi() {
    this.sendCommand('WIFI:AUTO', true);
    this.log('Requesting ESP32 to auto-connect to saved Wi-Fi...', 'info');
  }

  clearSavedWifi() {
    this.sendCommand('WIFI:CLEAR', true);
    this.log('Clearing saved Wi-Fi credentials on ESP32...', 'warn');
  }

  private isFetchingVersions = false;

  async checkFirmwareUpdate() {
    if (this.isCheckingFirmware) return;
    this.isCheckingFirmware = true;
    this.otaStatus = 'CHECKING';
    this.otaMessage = 'Querying firmware repository for releases...';
    const currentVer = this.currentFirmwareVer || '1.0.2';
    const checkUrl = `/firmware/esp32/check?current=${encodeURIComponent(currentVer)}`;
    this.log(`Checking firmware backend (${checkUrl})...`, 'info');
    this.notify();

    if (this.isConnected) {
      this.sendCommand('OTA:VERSION', true);
    }

    try {
      let resolved = false;

      // 1. Primary endpoint: /firmware/esp32/check?current=<currentVer>
      try {
        const checkRes = await fetch(checkUrl, { cache: 'no-store' });
        if (checkRes.ok) {
          const data: Esp32FirmwareCheckResponse = await checkRes.json();
          if (data && (data.stable || data.current)) {
            resolved = true;
            if (data.current) {
              this.currentFirmwareVer = data.current;
            }
            this.latestFirmwareVer = data.stable || data.current || this.currentFirmwareVer;
            this.latestFirmwareDescription = data.notes || '';
            this.latestFirmwareUrl = data.url || '';
            this.latestFirmwareSize = data.size || 0;
            this.latestFirmwareSha256 = data.sha256 || '';
            this.latestFirmwareReleasedAt = data.releasedAt || '';
            
            this.hasFirmwareUpdate = typeof data.updateAvailable === 'boolean'
              ? data.updateAvailable
              : this.latestFirmwareVer !== this.currentFirmwareVer;

            this.otaStatus = this.hasFirmwareUpdate ? 'AVAILABLE' : 'IDLE';
            this.otaMessage = this.hasFirmwareUpdate 
              ? `New stable firmware v${this.latestFirmwareVer} is available!`
              : `Firmware is up to date (v${this.currentFirmwareVer}).`;
            
            // Add or update entry in availableVersions catalog
            const existingIdx = this.availableVersions.findIndex(v => v.version === this.latestFirmwareVer);
            const verInfo: FirmwareVersionInfo = {
              version: this.latestFirmwareVer,
              isStable: true,
              device: 'esp32',
              size: this.latestFirmwareSize,
              sha256: this.latestFirmwareSha256,
              url: this.latestFirmwareUrl,
              description: this.latestFirmwareDescription,
              releasedAt: this.latestFirmwareReleasedAt || new Date().toISOString()
            };
            if (existingIdx >= 0) {
              this.availableVersions[existingIdx] = verInfo;
            } else {
              this.availableVersions = [verInfo, ...this.availableVersions];
            }
            if (!this.selectedVersion) {
              this.selectedVersion = this.latestFirmwareVer;
            }
          }
        }
      } catch (err: any) {
        this.log(`Endpoint ${checkUrl} error: ${err.message}`, 'warn');
      }

      // 2. Fallback to /api/firmware/latest if primary was not available
      if (!resolved) {
        const latestRes = await fetch('/api/firmware/latest?device=esp32-robot', { cache: 'no-store' })
          .catch(() => null);

        if (latestRes && latestRes.ok) {
          const latest: FirmwareLatestResponse = await latestRes.json();
          if (latest && latest.version) {
            this.latestFirmwareVer = latest.version;
            this.latestFirmwareDescription = latest.description || '';
            this.latestFirmwareUrl = latest.firmware || '';
            this.latestFirmwareSize = latest.size || 0;
            this.latestFirmwareSha256 = latest.sha256 || '';
            this.hasFirmwareUpdate = this.latestFirmwareVer !== this.currentFirmwareVer;
            this.otaStatus = this.hasFirmwareUpdate ? 'AVAILABLE' : 'IDLE';
            this.otaMessage = this.hasFirmwareUpdate 
              ? `New stable firmware v${this.latestFirmwareVer} is available!`
              : `Firmware is up to date (v${this.currentFirmwareVer}).`;
          }
        }
      }

      await this.fetchFirmwareVersions();
    } catch (err: any) {
      this.otaStatus = 'IDLE';
      this.otaMessage = 'Firmware update server checked.';
    } finally {
      this.isCheckingFirmware = false;
      this.hasCheckedFirmware = true;
      this.notify();
    }
  }

  async fetchFirmwareVersions() {
    if (this.isFetchingVersions) return;
    this.isFetchingVersions = true;
    try {
      let resolved = false;

      // 1. Primary endpoint: /firmware/versions/esp32
      // Expected response format:
      // {
      //   type: "esp32",
      //   versions: ["1.0.3", "1.0.5", "1.0.6", "1.0.7", "1.1.5", "1.1.6"]
      // }
      try {
        const res = await fetch('/firmware/versions/esp32', { cache: 'no-store' });
        if (res.ok) {
          const data: Esp32VersionsListResponse = await res.json();
          if (data && Array.isArray(data.versions)) {
            const list: FirmwareVersionInfo[] = data.versions.map((v) => {
              if (typeof v === 'string') {
                const isLatest = v === this.latestFirmwareVer;
                return {
                  version: v,
                  isStable: true,
                  device: data.type || 'esp32',
                  size: isLatest ? this.latestFirmwareSize : 0,
                  sha256: isLatest ? this.latestFirmwareSha256 : '',
                  releasedAt: isLatest ? this.latestFirmwareReleasedAt : '',
                  description: isLatest ? this.latestFirmwareDescription : '',
                  url: isLatest && this.latestFirmwareUrl ? this.latestFirmwareUrl : `/firmware/esp32/${v}`
                };
              }
              return v;
            });

            // Ensure discovered latest firmware is present in catalog if available
            if (this.latestFirmwareVer && !list.some(v => v.version === this.latestFirmwareVer)) {
              list.push({
                version: this.latestFirmwareVer,
                isStable: true,
                device: data.type || 'esp32',
                size: this.latestFirmwareSize,
                sha256: this.latestFirmwareSha256,
                releasedAt: this.latestFirmwareReleasedAt,
                description: this.latestFirmwareDescription,
                url: this.latestFirmwareUrl
              });
            }

            // Sort versions descending (newest first)
            const semverCompareDesc = (a: string, b: string) => {
              const pa = a.split('.').map(n => parseInt(n, 10) || 0);
              const pb = b.split('.').map(n => parseInt(n, 10) || 0);
              for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const na = pa[i] || 0;
                const nb = pb[i] || 0;
                if (na !== nb) return nb - na;
              }
              return 0;
            };

            list.sort((a, b) => semverCompareDesc(a.version, b.version));
            this.availableVersions = list;
            resolved = true;

            if (!this.selectedVersion && this.availableVersions.length > 0) {
              this.selectedVersion = this.availableVersions[0].version;
            }
          }
        }
      } catch (err: any) {
        this.log(`Endpoint /firmware/versions/esp32 error: ${err.message}`, 'warn');
      }

      // 2. Fallback to /api/firmware/versions?device=esp32-robot
      if (!resolved) {
        const fallbackRes = await fetch('/api/firmware/versions?device=esp32-robot', { cache: 'no-store' });
        if (fallbackRes.ok) {
          const data: FirmwareVersionsResponse = await fallbackRes.json();
          if (data && Array.isArray(data.versions)) {
            this.availableVersions = data.versions;
            if (!this.selectedVersion && this.availableVersions.length > 0) {
              this.selectedVersion = this.availableVersions[0].version;
            }
          }
        }
      }
    } catch (err: any) {
      this.log(`Could not load firmware version history: ${err.message}`, 'warn');
    } finally {
      this.isFetchingVersions = false;
      this.notify();
    }
  }

  private cloudWs: WebSocket | null = null;
  private currentOtaSessionCode: string = '';
  private otaThrottleTimer: any = null;
  private pendingOtaPct: number | null = null;
  private pendingOtaMsg: string | null = null;
  private lastOtaNotifyTime = 0;

  private queueThrottledOtaProgress(pct: number, message: string) {
    this.otaStatus = 'UPDATING';
    this.pendingOtaPct = pct;
    this.pendingOtaMsg = message;

    // Immediately flush if reached 100% or final phase
    if (pct >= 100) {
      if (this.otaThrottleTimer) {
        clearTimeout(this.otaThrottleTimer);
        this.otaThrottleTimer = null;
      }
      this.otaProgress = 100;
      this.otaMessage = message;
      this.lastOtaNotifyTime = Date.now();
      this.notify();
      return;
    }

    // Schedule update with 500ms delay / throttling to prevent UI flooding
    if (!this.otaThrottleTimer) {
      const now = Date.now();
      const elapsed = now - this.lastOtaNotifyTime;
      const delay = Math.max(0, 500 - elapsed);

      this.otaThrottleTimer = setTimeout(() => {
        this.otaThrottleTimer = null;
        if (this.pendingOtaPct !== null) {
          this.otaProgress = this.pendingOtaPct;
          if (this.pendingOtaMsg) {
            this.otaMessage = this.pendingOtaMsg;
          }
          this.pendingOtaPct = null;
          this.pendingOtaMsg = null;
          this.lastOtaNotifyTime = Date.now();
          this.notify();
        }
      }, delay);
    }
  }

  private connectWsProgress(code: string, givenWsUrl?: string) {
    if (typeof window === 'undefined') return;
    if (this.otaThrottleTimer) {
      clearTimeout(this.otaThrottleTimer);
      this.otaThrottleTimer = null;
    }
    if (this.cloudWs) {
      this.cloudWs.close();
      this.cloudWs = null;
    }

    try {
      // Always uses the exact same base url (host and protocol) as the web application
      const host = window.location.host;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      let wsUrl = '';
      if (givenWsUrl) {
        if (givenWsUrl.startsWith('/')) {
          wsUrl = `${protocol}//${host}${givenWsUrl}`;
        } else if (givenWsUrl.startsWith('ws://') || givenWsUrl.startsWith('wss://') || givenWsUrl.startsWith('http://') || givenWsUrl.startsWith('https://')) {
          try {
            // Keep the pathname and search from the returned url, but bind to current host and protocol
            const parsed = new URL(givenWsUrl);
            wsUrl = `${protocol}//${host}${parsed.pathname}${parsed.search}`;
          } catch (_) {
            wsUrl = `${protocol}//${host}/${givenWsUrl}`;
          }
        } else {
          wsUrl = `${protocol}//${host}/${givenWsUrl}`;
        }
      } else {
        // Default to /progress/<code>
        wsUrl = `${protocol}//${host}/progress/${encodeURIComponent(code)}`;
      }

      this.log(`Connecting to OTA Progress stream [${wsUrl}]...`, 'info');
      this.cloudWs = new WebSocket(wsUrl);

      this.cloudWs.onopen = () => {
        this.log(`🔗 Connected to OTA Progress WebSocket: ${code}`, 'info');
      };

      this.cloudWs.onmessage = (e) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (!data) return;

          if (data.type === 'ESP_ATTACHED') {
            this.log(`ESP32 attached to OTA session [${code}]. Flash starting...`, 'info');
            this.otaStatus = 'UPDATING';
            this.otaProgress = Math.max(5, this.otaProgress);
            this.otaMessage = 'ESP32 connected to OTA session! Beginning binary stream...';
            this.notify();
          } else if (data.type === 'OTA_START' || data.status === 'START') {
            this.otaProgress = 5;
            this.otaStatus = 'UPDATING';
            this.otaMessage = data.message || 'ESP32 connected! Streaming firmware...';
            this.log(`📡 [WS OTA] ${this.otaMessage}`, 'info');
            this.notify();
          } else if (
            data.type === 'error' || 
            data.type === 'OTA_ERROR' || 
            data.status === 'error' || 
            data.status === 'ERROR'
          ) {
            if (this.otaThrottleTimer) {
              clearTimeout(this.otaThrottleTimer);
              this.otaThrottleTimer = null;
            }
            this.otaStatus = 'ERROR';
            this.otaMessage = data.error || data.message || 'OTA Update Failed';
            this.log(`❌ OTA Streaming Error: ${this.otaMessage}`, 'error');
            if (this.cloudWs) {
              this.cloudWs.close();
              this.cloudWs = null;
            }
            this.notify();
          } else if (
            data.type === 'OTA_COMPLETE' || 
            data.status === 'complete' || 
            data.status === 'SUCCESS' || 
            data.status === 'COMPLETE' || 
            data.status === 'rebooting' || 
            data.status === 'REBOOTING'
          ) {
            if (this.otaThrottleTimer) {
              clearTimeout(this.otaThrottleTimer);
              this.otaThrottleTimer = null;
            }
            this.otaProgress = 100;
            this.otaStatus = 'SUCCESS';
            this.otaMessage = 'Firmware 100% written to Flash! ESP32 is rebooting...';
            this.log('✅ ESP32 Firmware OTA Complete! Rebooting...', 'success');
            this.vibrate([100, 50, 100, 50, 200]);
            if (this.cloudWs) {
              this.cloudWs.close();
              this.cloudWs = null;
            }
            this.notify();
          } else if (
            data.type === 'download' || 
            data.status === 'downloading' || 
            data.type === 'OTA_PROGRESS' || 
            typeof data.percent !== 'undefined' || 
            typeof data.progress !== 'undefined' || 
            typeof data.pct !== 'undefined'
          ) {
            // Parse message fields from:
            // { type: "download", deviceId: "ESP32-RC-CAR", deviceType: "esp32", version: "1.1.6", total: 1834064, limit: 20, percent: 18, sent: 331776, status: "downloading" }
            const rawPct = typeof data.percent !== 'undefined' ? data.percent : (typeof data.progress !== 'undefined' ? data.progress : data.pct);
            const pct = Math.min(100, Math.max(0, Number(rawPct) || 0));

            const sentBytes = Number(data.sent ?? data.bytesSent) || 0;
            const totalBytes = Number(data.total ?? data.totalSize ?? data.size) || 0;
            const kbSent = Math.round(sentBytes / 1024);
            const kbTotal = Math.round(totalBytes / 1024);
            const limitStr = data.limit ? ` @ ${data.limit}KB/s` : '';
            const verStr = data.version ? `v${data.version} ` : '';

            let msg = '';
            if (pct >= 100) {
              msg = 'Flashing complete! ESP32 is rebooting...';
            } else if (kbTotal > 0 && kbSent > 0) {
              msg = `Downloading ${verStr}(${pct}%): ${kbSent} KB / ${kbTotal} KB${limitStr}`;
            } else {
              msg = `Streaming firmware ${verStr}${pct}%...`;
            }

            this.log(`📡 [WS OTA] ${pct}% - ${msg}`, 'info');

            // Queue throttled progress update with 500ms delay
            this.queueThrottledOtaProgress(pct, msg);
          }
        } catch (_) {}
      };

      this.cloudWs.onerror = (err) => {
        console.warn('[OTA Progress WS Error]', err);
      };

      this.cloudWs.onclose = () => {
        if (this.otaThrottleTimer) {
          clearTimeout(this.otaThrottleTimer);
          this.otaThrottleTimer = null;
        }
        this.cloudWs = null;
      };
    } catch (err: any) {
      this.log(`OTA Progress WebSocket connection error: ${err.message}`, 'warn');
    }
  }

  async startFirmwareUpdate(targetVersionOrUrl?: string) {
    if (!this.isConnected) {
      this.log('Cannot perform OTA: Device is not connected via Bluetooth!', 'error');
      this.otaStatus = 'ERROR';
      this.otaMessage = 'Please connect your ESP32 via Bluetooth first.';
      this.notify();
      return;
    }

    if (!this.wifi.connected) {
      this.log('Cannot perform OTA: ESP32 is not connected to Wi-Fi!', 'error');
      this.otaStatus = 'ERROR';
      this.otaMessage = 'Connect ESP32 to Wi-Fi with internet access first.';
      this.notify();
      return;
    }

    const versionToFlash = targetVersionOrUrl || this.selectedVersion || this.latestFirmwareVer;
    this.targetFlashingVersion = versionToFlash;
    this.otaStatus = 'UPDATING';
    if (this.otaThrottleTimer) {
      clearTimeout(this.otaThrottleTimer);
      this.otaThrottleTimer = null;
    }
    this.pendingOtaPct = null;
    this.pendingOtaMsg = null;
    this.lastOtaNotifyTime = 0;
    this.otaProgress = 2;
    this.otaMessage = `Creating firmware session for v${versionToFlash}...`;
    this.log(`🚀 Requesting OTA session for firmware v${versionToFlash}...`, 'warn');
    this.vibrate([50, 50, 50]);
    this.notify();

    let sessionCode = '';
    let socketUrl = '';

    // Step 1: POST /firmware/sessions { type, version, deviceId }
    try {
      const res = await fetch('/firmware/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'esp32',
          version: versionToFlash,
          deviceId: this.deviceName || 'esp32'
        })
      });

      if (res.ok) {
        const body: Esp32FirmwareSessionResponse = await res.json();
        sessionCode = body.code || body.sessionId || body.sessionCode || '';
        socketUrl = body.ws || body.wsUrl || body.socketUrl || '';
        this.log(`Received OTA Session Code: ${sessionCode}${socketUrl ? ` (WS: ${socketUrl})` : ''}`, 'info');
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      this.log(`Session creation fallback (${err.message}). Generating local session code...`, 'warn');
      sessionCode = 'ota_' + Math.random().toString(36).substring(2, 8);
    }

    this.currentOtaSessionCode = sessionCode;

    // Step 2: Connect to progress stream using same base url
    this.connectWsProgress(sessionCode, socketUrl);

    // Step 3: Send the code to ESP32 by bluetooth
    this.otaProgress = 5;
    this.otaMessage = `Sending session code [${sessionCode}] to ESP32 via Bluetooth...`;
    this.log(`📡 Transmitting OTA code [${sessionCode}] to ESP32 via BLE...`, 'info');
    this.sendCommand(`OTA:${sessionCode}`, true);
    this.notify();
  }

  private handleTelemetryNotification(e: Event) {
    const char = e.target as BluetoothRemoteGATTCharacteristic;
    if (!char || !char.value) return;

    if (this.pingStartTime > 0) {
      this.latency = Math.round(performance.now() - this.pingStartTime);
      this.pingStartTime = 0;
    }

    const decoder = new TextDecoder('utf-8');
    const message = decoder.decode(char.value).trim();
    if (!message) return;
    this.handleIncomingMessage(message);
  }

  handleIncomingMessage(message: string) {
    if (!message) return;

    if (message.startsWith('T:')) {
      const parts = message.substring(2).split(',');
      if (parts.length >= 8) {
        const uptimeSec = parseInt(parts[0], 10) || 0;
        this.distance = parseInt(parts[1], 10) || 0;
        this.irLeft = parseInt(parts[2], 10) === 1;
        this.irRight = parseInt(parts[3], 10) === 1;
        this.servoAngle = parseInt(parts[4], 10) || 90;
        const rawBatPct = parseInt(parts[5], 10);
        this.batteryPct = isNaN(rawBatPct) ? -1 : rawBatPct;
        this.batteryVolts = parseFloat(parts[6]) || 0;
        const mode = parts[7];

        const m = Math.floor(uptimeSec / 60);
        const s = uptimeSec % 60;
        this.uptime = `${m}:${s < 10 ? '0' : ''}${s}`;

        if (mode === 'A' && this.driveMode !== 'AUTOMATIC') this.driveMode = 'AUTOMATIC';
        else if (mode === 'M' && this.driveMode !== 'MANUAL') this.driveMode = 'MANUAL';
        this.notify();
      }
    } 
    else if (message.startsWith('WIFI_SCAN_START')) {
      this.isScanningWifi = true;
      this.wifiNetworks = [];
      this.log('Listening for Wi-Fi beacon packets from ESP32...', 'info');
      this.notify();
    }
    else if (message.startsWith('WIFI_NETB:')) {
      const parts = message.substring(10).split(':');
      if (parts.length >= 3) {
        let ssid = parts[0];
        try {
          ssid = decodeURIComponent(escape(atob(parts[0])));
        } catch (_) {
          try { ssid = atob(parts[0]); } catch (_) {}
        }
        if (ssid.trim().length > 0) {
          const rssi = parseInt(parts[1], 10) || -80;
          const isEncrypted = parts[2] === '1';
          const existingIdx = this.wifiNetworks.findIndex(n => n.ssid === ssid);
          if (existingIdx !== -1) {
            this.wifiNetworks[existingIdx].rssi = rssi;
          } else {
            this.wifiNetworks.push({ ssid, rssi, isEncrypted });
          }
          this.wifiNetworks.sort((a, b) => b.rssi - a.rssi);
          this.notify();
        }
      }
    }
    else if (message.startsWith('WIFI_NET:')) {
      const parts = message.substring(9).split(':');
      if (parts.length >= 3 && parts[0].trim().length > 0) {
        const ssid = parts[0];
        const rssi = parseInt(parts[1], 10) || -80;
        const isEncrypted = parts[2] === '1';

        const existingIdx = this.wifiNetworks.findIndex(n => n.ssid === ssid);
        if (existingIdx !== -1) {
          this.wifiNetworks[existingIdx].rssi = rssi;
        } else {
          this.wifiNetworks.push({ ssid, rssi, isEncrypted });
        }
        this.wifiNetworks.sort((a, b) => b.rssi - a.rssi);
        this.notify();
      }
    }
    else if (message.startsWith('WIFI_SCAN_END')) {
      this.isScanningWifi = false;
      this.wifiNetworks.sort((a, b) => b.rssi - a.rssi);
      this.log(`Wi-Fi Scan Complete: ${this.wifiNetworks.length} network(s) found.`, 'success');
      this.notify();
    }
    else if (message.startsWith('WIFI_SCAN:')) {
      this.isScanningWifi = false;
      const rest = message.substring(10);
      const colonIdx = rest.indexOf(':');
      if (colonIdx !== -1) {
        const data = rest.substring(colonIdx + 1);
        const items = data.split('|');
        const nets: WifiNetwork[] = [];
        items.forEach(item => {
          const p = item.split(',');
          if (p.length >= 2 && p[0].trim().length > 0) {
            nets.push({
              ssid: p[0],
              rssi: parseInt(p[1], 10) || 0,
              isEncrypted: p[2] === '1'
            });
          }
        });
        nets.sort((a, b) => b.rssi - a.rssi);
        this.wifiNetworks = nets;
        this.log(`Wi-Fi Scan: ${this.wifiNetworks.length} network(s) found.`, 'success');
        this.notify();
      }
    }
    else if (message.startsWith('WIFI_STATUS:')) {
      const parts = message.substring(12).split(':');
      const state = parts[0];
      const ip = parts[1] || '0.0.0.0';
      const rssi = parseInt(parts[2] || '0', 10);
      const ssid = parts.slice(3).join(':');

      if (state === 'OFF') {
        this.wifi = { enabled: false, connected: false, ssid: '', ip: '0.0.0.0', rssi: 0 };
        this.disconnectWifiLan();
      } else if (state === 'CONNECTED') {
        this.wifi = { enabled: true, connected: true, ssid, ip, rssi };
        this.log(`Wi-Fi Connected! IP: ${ip} (SSID: ${ssid})`, 'success');
        this.checkFirmwareUpdate();
      } else {
        this.wifi = { enabled: true, connected: false, ssid: '', ip: '0.0.0.0', rssi: 0 };
        this.disconnectWifiLan();
      }
      this.notify();
    }
    else if (message.startsWith('OTA_READY:')) {
      this.otaStatus = 'UPDATING';
      this.otaProgress = 5;
      this.otaMessage = 'ESP32 preparing Over-The-Air flash stream...';
      this.notify();
    }
    else if (message.startsWith('OTA_PROGRESS:')) {
      const parts = message.substring(13).split(':');
      this.otaProgress = parseInt(parts[0], 10) || 0;
      this.otaStatus = 'UPDATING';
      this.otaMessage = parts.slice(1).join(':') || `Flashing ESP32: ${this.otaProgress}%`;
      this.log(`[OTA Flash] ${this.otaProgress}% - ${this.otaMessage}`, 'info');
      this.notify();
    }
    else if (message.startsWith('OTA_COMPLETE')) {
      this.otaProgress = 100;
      this.otaStatus = 'SUCCESS';
      this.otaMessage = 'Firmware flashed successfully! ESP32 is rebooting...';
      this.log('✅ ESP32 Firmware OTA Flash Complete! Rebooting...', 'success');
      this.vibrate([100, 50, 100, 50, 200]);
      this.notify();
    }
    else if (message.startsWith('OTA_ERROR:')) {
      this.otaStatus = 'ERROR';
      this.otaMessage = message.substring(10) || 'OTA Update Failed';
      this.log(`❌ OTA Update Failed: ${this.otaMessage}`, 'error');
      this.notify();
    }
    else if (message.startsWith('FIRMWARE_VER:')) {
      this.currentFirmwareVer = message.substring(13).trim();
      this.hasFirmwareUpdate = this.latestFirmwareVer !== this.currentFirmwareVer;
      if (this.targetFlashingVersion && this.currentFirmwareVer === this.targetFlashingVersion) {
        this.otaStatus = 'SUCCESS';
        this.otaProgress = 100;
        this.otaMessage = `Updated to v${this.currentFirmwareVer} successfully!`;
        this.log(`🎉 OTA Flash Verified: ESP32 running v${this.currentFirmwareVer}!`, 'success');
        this.targetFlashingVersion = '';
      } else if (!this.hasFirmwareUpdate) {
        this.otaStatus = 'IDLE';
        this.otaMessage = `Firmware is up to date (v${this.currentFirmwareVer}).`;
      }
      this.log(`ESP32 Running Firmware: v${this.currentFirmwareVer}`, 'info');
      this.notify();
    }
    else {
      this.log(`ESP32: ${message}`);
      this.notify();
    }
  }
}

export const globalBle = new BLEController();

export function useBLE(instance: BLEController = globalBle): BLEController {
  useSyncExternalStore(instance.subscribe, () => instance.version);
  return instance;
}
