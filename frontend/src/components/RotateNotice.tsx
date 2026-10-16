import React from 'react';

export const RotateNotice: React.FC = () => {
  return (
    <div className="rotate-notice">
      <div className="rotate-hud-card">
        {/* Top HUD Badge */}
        <div className="rotate-badge">
          <span className="rotate-dot"></span>
          <span>ORIENTATION LOCK</span>
        </div>

        {/* Phone Rotation Visual Stage */}
        <div className="rotate-stage">
          {/* Background Circular Arc Guide */}
          <svg className="rotate-orbit-svg" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="46" fill="none" stroke="#e2e8f0" strokeWidth="2" />
            <path d="M 60 14 A 46 46 0 0 1 106 60" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
            <polygon points="106,53 113,64 100,64" fill="#dc2626" />
          </svg>

          {/* Smooth Rotating Smartphone Mockup */}
          <div className="rotating-phone-mockup">
            <div className="phone-screen">
              <div className="phone-notch"></div>
              <div className="phone-grid-preview"></div>
              <div className="phone-home-indicator"></div>
            </div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 className="rotate-title">ROTATE TO LANDSCAPE</h2>
        <p className="rotate-desc">
          <strong>ESP-RC</strong> requires horizontal landscape mode for two-handed flight instruments &amp; telemetry.
        </p>

        {/* Footer Specs */}
        <div className="rotate-footer-specs">
          <span>16:9 COCKPIT</span>
          <span>•</span>
          <span>DUAL THUMB STICKS</span>
        </div>
      </div>
    </div>
  );
};

export default RotateNotice;
