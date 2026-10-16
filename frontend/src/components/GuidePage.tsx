import React from 'react';
import { ArrowLeft, Cpu, Compass, Wifi, Bluetooth, Zap } from 'lucide-react';
import Esp32PinoutSvg from './Esp32PinoutSvg';
import { globalBle, useBLE } from '../lib/ble';
import TopBar from './TopBar';

interface Props {
  onNavigateHome?: () => void;
}

export const GuidePage: React.FC<Props> = ({ onNavigateHome }) => {
  const ble = useBLE(globalBle);

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="upload-root" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Unified Full-Width Status Bar at Very Top */}
      <TopBar ble={ble} />

      {/* HUD Top Bar */}
      <header className="hud-topbar" style={{ flexShrink: 0 }}>
        <div className="topbar-left">
          <button type="button" className="btn-cockpit-back" onClick={handleGoHome}>
            <ArrowLeft size={15} strokeWidth={2.5} />
            <span>COCKPIT HUD</span>
          </button>
          <div className="hud-divider"></div>
          <div className="hud-brand">
            <div className="live-dot"></div>
            <span className="hud-title">HARDWARE WIRING &amp; AVIONICS GUIDE</span>
            <span className="hud-sub">DOCS//V4.1</span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="hud-badge arch">
            <Cpu size={13} strokeWidth={2.5} />
            <span>ESP32-WROOM-32</span>
          </div>
        </div>
      </header>

      {/* Main Container with smooth scrolling */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          WebkitOverflowScrolling: 'touch',
          padding: '12px 16px 32px 16px' 
        }}
      >
        <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Section 1: Interactive Pinout & Wiring Diagram */}
          <section className="hud-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={20} color="#dc2626" />
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>ESP32 ROBOTICS WIRING SCHEMATIC</h2>
                  <p style={{ fontSize: '0.62rem', color: '#64748b' }}>Complete pinout map connecting ESP32 to motor driver, sensors &amp; battery</p>
                </div>
              </div>
              <span className="panel-tag">SCHEMATIC v2.4</span>
            </div>

            {/* Render Vector SVG */}
            <Esp32PinoutSvg />

            {/* Quick Pinout Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 14 }}>
              <div style={{ background: '#f8fafc', padding: 8, borderLeft: '3px solid #f59e0b', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                <strong style={{ color: '#0f172a' }}>L298N DRIVER:</strong><br />
                IN1: GPIO 16 | IN2: GPIO 17<br />
                IN3: GPIO 18 | IN4: GPIO 19
              </div>

              <div style={{ background: '#f8fafc', padding: 8, borderLeft: '3px solid #06b6d4', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                <strong style={{ color: '#0f172a' }}>HC-SR04 RADAR:</strong><br />
                Trigger: GPIO 5<br />
                Echo: GPIO 18
              </div>

              <div style={{ background: '#f8fafc', padding: 8, borderLeft: '3px solid #ec4899', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                <strong style={{ color: '#0f172a' }}>SG90 SERVO:</strong><br />
                PWM Signal: GPIO 4<br />
                Power: 5V (Ext) / GND
              </div>

              <div style={{ background: '#f8fafc', padding: 8, borderLeft: '3px solid #a855f7', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                <strong style={{ color: '#0f172a' }}>IR SENSORS:</strong><br />
                Left: GPIO 34 (ADC)<br />
                Right: GPIO 35 (ADC)
              </div>

              <div style={{ background: '#f8fafc', padding: 8, borderLeft: '3px solid #22c55e', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                <strong style={{ color: '#0f172a' }}>BATTERY MONITOR:</strong><br />
                Divider: GPIO 36 (VP)<br />
                Scaling: 100kΩ / 22kΩ
              </div>
            </div>
          </section>

          {/* Section 2: Controls & Driving Modes */}
          <section className="hud-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Compass size={20} color="#dc2626" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Flight &amp; Driving Control Surfaces</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: '0.74rem', color: '#334155', lineHeight: 1.5 }}>
              <div style={{ border: '1px solid #e2e8f0', padding: 10 }}>
                <strong style={{ color: '#0f172a' }}>🎮 360° Vector Joystick</strong>
                <p style={{ color: '#64748b', marginTop: 4 }}>
                  Full proportional steering. Translates thumb deflection angle and radial displacement into 8 cardinal motor vector commands.
                </p>
              </div>
              <div style={{ border: '1px solid #e2e8f0', padding: 10 }}>
                <strong style={{ color: '#0f172a' }}>🔲 9-Key Tactile D-Pad</strong>
                <p style={{ color: '#64748b', marginTop: 4 }}>
                  Instant discrete button commands for high-precision robotic navigation in tight spaces. Center button performs immediate emergency stop.
                </p>
              </div>
              <div style={{ border: '1px solid #e2e8f0', padding: 10 }}>
                <strong style={{ color: '#0f172a' }}>⚡ Dual Differential Sliders</strong>
                <p style={{ color: '#64748b', marginTop: 4 }}>
                  Independent dual tank-tread throttles for true skid-steer maneuvers, 360° zero-radius pivot spinning, and exact torque balancing.
                </p>
              </div>
              <div style={{ border: '1px solid #e2e8f0', padding: 10 }}>
                <strong style={{ color: '#0f172a' }}>🤖 Autonomous Avoidance</strong>
                <p style={{ color: '#64748b', marginTop: 4 }}>
                  Hardware AI loop using the HC-SR04 Ultrasonic Ranger on a SG90 panning servo + left/right TCRT5000 IR optical proximity sensors.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Dual Transports (BLE & Wi-Fi LAN) */}
          <section className="hud-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Wifi size={20} color="#0284c7" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Dual-Transport Hybrid Telemetry</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              <div style={{ border: '1.5px solid #0284c7', background: 'rgba(2, 132, 199, 0.04)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.8rem', color: '#0284c7' }}>
                  <Bluetooth size={16} /> Web Bluetooth (BLE)
                </div>
                <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                  Direct peer-to-peer pairing using the Nordic UART GATT service. Requires no routers or internet connection.
                </p>
              </div>

              <div style={{ border: '1.5px solid #16a34a', background: 'rgba(22, 163, 74, 0.04)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.8rem', color: '#16a34a' }}>
                  <Wifi size={16} /> Wi-Fi LAN WebSocket
                </div>
                <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                  Connects directly to the ESP32 on port 81 over local Wi-Fi with &lt;5ms latency. Extends control range past Bluetooth limits.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Hotkeys & Keyboard Reference */}
          <section className="hud-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Zap size={20} color="#eab308" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Keyboard &amp; Gamepad Controls</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>W / ↑ : Drive Forward</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>S / ↓ : Reverse</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>A / ← : Turn Left</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>D / → : Turn Right</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0', color: '#dc2626', fontWeight: 800 }}>Space : Emergency Brake</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0', color: '#7c3aed', fontWeight: 800 }}>Shift : Turbo Boost</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>L : Toggle Headlights</div>
              <div style={{ background: '#f8fafc', padding: 8, border: '1px solid #e2e8f0' }}>H : Sound Horn Buzzer</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
