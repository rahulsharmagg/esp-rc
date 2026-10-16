import React from 'react';

export const Esp32PinoutSvg: React.FC = () => {
  return (
    <svg 
      viewBox="0 0 880 500" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', background: '#0a0f1d', borderRadius: 4, border: '2px solid #1e293b' }}
    >
      <defs>
        <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="metalShield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>

      {/* Grid Pattern */}
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      </pattern>
      <rect width="880" height="500" fill="url(#grid)" />

      {/* 1. ESP32-WROOM-32 DevKit Board (Center) */}
      <g transform="translate(330, 40)">
        {/* PCB Board */}
        <rect x="0" y="0" width="220" height="420" rx="10" fill="#064e3b" stroke="#059669" strokeWidth="2.5" />
        
        {/* Mounting Holes */}
        <circle cx="15" cy="15" r="5" fill="#0f172a" stroke="#d1fae5" strokeWidth="1.5" />
        <circle cx="205" cy="15" r="5" fill="#0f172a" stroke="#d1fae5" strokeWidth="1.5" />
        <circle cx="15" cy="405" r="5" fill="#0f172a" stroke="#d1fae5" strokeWidth="1.5" />
        <circle cx="205" cy="405" r="5" fill="#0f172a" stroke="#d1fae5" strokeWidth="1.5" />

        {/* Metal RF Shield */}
        <rect x="35" y="45" width="150" height="135" rx="4" fill="url(#metalShield)" stroke="#475569" strokeWidth="1.5" />
        <text x="110" y="100" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="monospace" textAnchor="middle">ESP-WROOM-32</text>
        <text x="110" y="118" fill="#1e293b" fontSize="9" fontWeight="700" fontFamily="monospace" textAnchor="middle">Wi-Fi &amp; BLE Dual Core</text>

        {/* Micro-USB / Type-C Port */}
        <rect x="85" y="390" width="50" height="35" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <rect x="95" y="402" width="30" height="14" rx="2" fill="#1e293b" />
        <text x="110" y="380" fill="#a7f3d0" fontSize="9" fontWeight="800" fontFamily="monospace" textAnchor="middle">USB / 5V IN</text>

        {/* CP2102 USB Bridge Chip */}
        <rect x="88" y="300" width="44" height="44" rx="2" fill="#1e293b" stroke="#475569" />
        <text x="110" y="325" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">CP2102</text>

        {/* Power Regulator */}
        <rect x="45" y="315" width="22" height="30" fill="#1e293b" stroke="#475569" />
        <text x="56" y="355" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">3.3V REG</text>

        {/* EN and BOOT Buttons */}
        <rect x="30" y="375" width="20" height="15" rx="2" fill="#334155" stroke="#94a3b8" />
        <text x="40" y="370" fill="#cbd5e1" fontSize="7" fontFamily="monospace" textAnchor="middle">EN</text>
        
        <rect x="170" y="375" width="20" height="15" rx="2" fill="#334155" stroke="#94a3b8" />
        <text x="180" y="370" fill="#cbd5e1" fontSize="7" fontFamily="monospace" textAnchor="middle">BOOT</text>

        {/* Left Pin Header */}
        {Array.from({ length: 19 }).map((_, i) => (
          <g key={`lpin-${i}`} transform={`translate(8, ${50 + i * 18})`}>
            <rect x="0" y="0" width="10" height="8" rx="1" fill="#e2e8f0" stroke="#0f172a" />
          </g>
        ))}

        {/* Right Pin Header */}
        {Array.from({ length: 19 }).map((_, i) => (
          <g key={`rpin-${i}`} transform={`translate(202, ${50 + i * 18})`}>
            <rect x="0" y="0" width="10" height="8" rx="1" fill="#e2e8f0" stroke="#0f172a" />
          </g>
        ))}
      </g>

      {/* 2. Left Peripheral: L298N Dual Motor Driver */}
      <g transform="translate(40, 70)">
        <rect x="0" y="0" width="200" height="170" rx="6" fill="#991b1b" stroke="#dc2626" strokeWidth="2" />
        <text x="100" y="24" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="monospace" textAnchor="middle">L298N DUAL H-BRIDGE</text>

        {/* Massive Aluminum Heat Sink */}
        <rect x="40" y="35" width="120" height="50" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
        <line x1="60" y1="35" x2="60" y2="85" stroke="#475569" strokeWidth="2" />
        <line x1="80" y1="35" x2="80" y2="85" stroke="#475569" strokeWidth="2" />
        <line x1="100" y1="35" x2="100" y2="85" stroke="#475569" strokeWidth="2" />
        <line x1="120" y1="35" x2="120" y2="85" stroke="#475569" strokeWidth="2" />
        <line x1="140" y1="35" x2="140" y2="85" stroke="#475569" strokeWidth="2" />

        {/* Terminal Blocks */}
        <rect x="10" y="105" width="45" height="24" fill="#15803d" />
        <text x="32" y="120" fill="#ffffff" fontSize="8" fontWeight="800" fontFamily="monospace" textAnchor="middle">OUT1/2</text>
        <text x="32" y="145" fill="#fca5a5" fontSize="7" fontFamily="monospace" textAnchor="middle">LEFT MOTOR</text>

        <rect x="145" y="105" width="45" height="24" fill="#15803d" />
        <text x="168" y="120" fill="#ffffff" fontSize="8" fontWeight="800" fontFamily="monospace" textAnchor="middle">OUT3/4</text>
        <text x="168" y="145" fill="#fca5a5" fontSize="7" fontFamily="monospace" textAnchor="middle">RIGHT MOTOR</text>

        {/* Logic Inputs */}
        <rect x="65" y="105" width="70" height="20" fill="#1e293b" />
        <text x="100" y="118" fill="#facc15" fontSize="8" fontWeight="800" fontFamily="monospace" textAnchor="middle">IN1 IN2 IN3 IN4</text>
      </g>

      {/* Wire Connection 1: Motor Driver to ESP32 */}
      <path d="M 165 175 C 240 175, 260 212, 338 212" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="4 2" />
      <text x="250" y="200" fill="#f59e0b" fontSize="8" fontFamily="monospace" fontWeight="800">GPIO 16,17,18,19</text>

      {/* 3. Left Lower Peripheral: Ultrasonic HC-SR04 */}
      <g transform="translate(40, 300)">
        <rect x="0" y="0" width="180" height="90" rx="4" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="50" cy="45" r="28" fill="#cbd5e1" stroke="#475569" strokeWidth="3" />
        <circle cx="50" cy="45" r="14" fill="#64748b" />
        <circle cx="130" cy="45" r="28" fill="#cbd5e1" stroke="#475569" strokeWidth="3" />
        <circle cx="130" cy="45" r="14" fill="#64748b" />
        <text x="90" y="20" fill="#93c5fd" fontSize="9" fontWeight="800" fontFamily="monospace" textAnchor="middle">HC-SR04 ULTRASONIC</text>
        <text x="90" y="82" fill="#ffffff" fontSize="8" fontFamily="monospace" textAnchor="middle">VCC • TRIG • ECHO • GND</text>
      </g>

      {/* Wire Connection 2: Ultrasonic to ESP32 */}
      <path d="M 220 345 C 260 345, 280 284, 338 284" fill="none" stroke="#06b6d4" strokeWidth="2.5" />
      <text x="245" y="325" fill="#06b6d4" fontSize="8" fontFamily="monospace" fontWeight="800">TRIG: G5 | ECHO: G18</text>

      {/* 4. Right Upper Peripheral: SG90 Micro Servo */}
      <g transform="translate(640, 60)">
        <rect x="0" y="0" width="160" height="90" rx="4" fill="#2563eb" stroke="#1d4ed8" strokeWidth="2" />
        <circle cx="110" cy="45" r="22" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
        <rect x="80" y="40" width="60" height="10" rx="2" fill="#e2e8f0" transform="rotate(30, 110, 45)" />
        <text x="80" y="22" fill="#ffffff" fontSize="10" fontWeight="800" fontFamily="monospace" textAnchor="middle">SG90 PAN SERVO</text>
        <text x="80" y="80" fill="#bfdbfe" fontSize="8" fontFamily="monospace" textAnchor="middle">PWM (GPIO 4) • 5V • GND</text>
      </g>

      {/* Wire Connection 3: Servo to ESP32 */}
      <path d="M 640 105 C 580 105, 570 122, 532 122" fill="none" stroke="#ec4899" strokeWidth="2.5" />
      <text x="560" y="115" fill="#ec4899" fontSize="8" fontFamily="monospace" fontWeight="800">SERVO: GPIO 4</text>

      {/* 5. Right Middle Peripheral: Dual TCRT5000 IR Sensors */}
      <g transform="translate(640, 190)">
        <rect x="0" y="0" width="160" height="100" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
        <text x="80" y="20" fill="#ef4444" fontSize="9" fontWeight="800" fontFamily="monospace" textAnchor="middle">TCRT5000 IR SENSORS</text>
        
        {/* Left IR Sensor */}
        <circle cx="45" cy="50" r="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <text x="45" y="75" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">LEFT (G34)</text>

        {/* Right IR Sensor */}
        <circle cx="115" cy="50" r="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <text x="115" y="75" fill="#94a3b8" fontSize="7" fontFamily="monospace" textAnchor="middle">RIGHT (G35)</text>

        <text x="80" y="92" fill="#64748b" fontSize="7" fontFamily="monospace" textAnchor="middle">OPTICAL LINE / OBSTACLE</text>
      </g>

      {/* Wire Connection 4: IR to ESP32 */}
      <path d="M 640 240 C 590 240, 570 230, 532 230" fill="none" stroke="#a855f7" strokeWidth="2.5" />
      <text x="555" y="245" fill="#a855f7" fontSize="8" fontFamily="monospace" fontWeight="800">IR L/R: G34, G35</text>

      {/* 6. Right Lower Peripheral: Li-ion Battery Pack */}
      <g transform="translate(640, 330)">
        <rect x="0" y="0" width="170" height="90" rx="6" fill="#15803d" stroke="#22c55e" strokeWidth="2" />
        <rect x="170" y="32" width="8" height="26" fill="#22c55e" />
        <text x="85" y="25" fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="monospace" textAnchor="middle">2S LI-ION 7.4V PACK</text>
        <text x="85" y="50" fill="#bbf7d0" fontSize="8" fontFamily="monospace" textAnchor="middle">18650 Cells (2000mAh)</text>
        <text x="85" y="75" fill="#ffffff" fontSize="8" fontFamily="monospace" textAnchor="middle">ADC VOLT DIVIDER (G36)</text>
      </g>

      {/* Wire Connection 5: Battery to ESP32 */}
      <path d="M 640 375 C 580 375, 570 338, 532 338" fill="none" stroke="#22c55e" strokeWidth="2.5" />
      <text x="560" y="365" fill="#22c55e" fontSize="8" fontFamily="monospace" fontWeight="800">VIN + ADC: G36</text>
    </svg>
  );
};

export default Esp32PinoutSvg;
