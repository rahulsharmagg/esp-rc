import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBLE, type BLEController } from '../lib/ble';
import { Bluetooth, KeyRound, RefreshCw, BookOpen, ArrowLeft, X, Info } from 'lucide-react';

interface Props {
  ble: BLEController;
}

export const ConnectBluetoothPage: React.FC<Props> = ({ ble: propBle }) => {
  const navigate = useNavigate();
  const ble = useBLE(propBle);
  const [showCodeInput, setShowCodeInput] = useState(false);

  // 4-box code state
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null)
  ];

  // Top Status Notice Window
  const [showNotice, setShowNotice] = useState(false);
  const noticeTimerRef = useRef<any>(null);

  useEffect(() => {
    if (showCodeInput) {
      const timer = setTimeout(() => inputRefs[0].current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [showCodeInput]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const handleConnectBLE = async () => {
    setShowCodeInput(false);
    await ble.connect();
  };

  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1).toUpperCase();
    const updated = [...digits];
    updated[index] = char;
    setDigits(updated);

    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'Enter') {
      handleConnectRcCode();
    }
  };

  const handleConnectRcCode = () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setShowNotice(true);
    noticeTimerRef.current = setTimeout(() => {
      setShowNotice(false);
    }, 4500);
  };

  const handleCancelNotice = () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setShowNotice(false);
  };

  return (
    <div 
      style={{ 
        width: '100vw', 
        height: '100dvh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '20px 16px 16px 16px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Notice Window with Cancel Button */}
      {showNotice && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 280,
            background: 'var(--black-solid, #090d16)',
            border: '1.5px solid var(--red-primary, #dc2626)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 10px rgba(220, 38, 38, 0.25)',
            padding: '10px 12px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            boxSizing: 'border-box',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header Row: Title & Cancel Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={13} color="#00f0ff" />
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#ffffff',
                  letterSpacing: '0.5px'
                }}
              >
                RC CODE CONNECT
              </span>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancelNotice}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                background: 'transparent',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '0.58rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                cursor: 'pointer',
                borderRadius: 0,
                transition: 'all 0.1s ease'
              }}
            >
              <X size={10} strokeWidth={2.5} />
              <span>CANCEL</span>
            </button>
          </div>

          {/* Message content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: '0.66rem',
                color: '#f8fafc',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 800
              }}
            >
              This feature will be added soon.
            </span>
            <span
              style={{
                fontSize: '0.55rem',
                color: '#94a3b8',
                fontFamily: 'var(--font-mono, monospace)'
              }}
            >
              Please use Bluetooth to pair with your ESP32.
            </span>
          </div>
        </div>
      )}

      {/* Invisible spacer to balance vertical centering */}
      <div style={{ height: 16 }}></div>

      {/* Main Center Area */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 14,
          maxWidth: 230,
          width: '100%'
        }}
      >
        {/* ESP-RC Brand Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <img 
            src="/assets/logo.svg" 
            alt="ESP-RC Logo" 
            style={{ 
              width: 48, 
              height: 48, 
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' 
            }} 
          />
          <span 
            style={{ 
              fontSize: '0.84rem', 
              fontWeight: 900, 
              letterSpacing: '1.2px', 
              fontFamily: 'var(--font-rect, "Chakra Petch", sans-serif)',
              color: 'var(--black-solid, #090d16)'
            }}
          >
            ESP-RC
          </span>
        </div>

        {/* View 1: When NOT in Code Input -> Show Stacked Compact Themed Buttons */}
        {!showCodeInput ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {/* 1. Bluetooth Button (Themed Red Cockpit Button, Compact) */}
            <button
              type="button"
              onClick={handleConnectBLE}
              disabled={ble.isConnecting}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 12px',
                background: ble.isConnecting ? '#090d16' : 'var(--red-primary, #dc2626)',
                color: '#ffffff',
                border: '1.5px solid var(--black-solid, #090d16)',
                borderRadius: 0,
                fontSize: '0.68rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.5px',
                cursor: ble.isConnecting ? 'not-allowed' : 'pointer',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.18)',
                transition: 'all 0.1s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {ble.isConnecting ? (
                <>
                  <RefreshCw size={12} className="animate-spin" color="#ffffff" />
                  <span>PAIRING BLE...</span>
                </>
              ) : (
                <>
                  <Bluetooth size={14} strokeWidth={2.4} color="#ffffff" />
                  <span>BLUETOOTH</span>
                </>
              )}
            </button>

            {/* 2. Code Button (Themed Dark Mech Button, Compact) */}
            <button
              type="button"
              onClick={() => setShowCodeInput(true)}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 12px',
                background: 'var(--black-solid, #090d16)',
                color: '#ffffff',
                border: '1.5px solid var(--black-solid, #090d16)',
                borderRadius: 0,
                fontSize: '0.68rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.18)',
                transition: 'all 0.1s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <KeyRound size={13} strokeWidth={2.4} color="#38bdf8" />
              <span>RC CODE</span>
            </button>

            {/* Error display if pairing fails */}
            {ble.lastError && (
              <div 
                style={{ 
                  marginTop: 4,
                  padding: '6px 8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#dc2626',
                  fontSize: '0.6rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  lineHeight: 1.3,
                  textAlign: 'center'
                }}
              >
                {ble.lastError}
              </div>
            )}
          </div>
        ) : (
          /* View 2: Compact Code Container with <- Back Arrow, Transparent/Red Boxes & [Connect] */
          <div 
            style={{ 
              width: '100%', 
              background: '#ffffff', 
              border: '1.5px solid #090d16', 
              boxShadow: '2px 2px 0px rgba(0,0,0,0.15)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              animation: 'fadeIn 0.12s ease-out',
              boxSizing: 'border-box'
            }}
          >
            {/* Top row with <- Back button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false);
                  setDigits(['', '', '', '']);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  color: '#090d16',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 800,
                  fontSize: '0.62rem',
                  letterSpacing: '0.4px'
                }}
              >
                <ArrowLeft size={13} strokeWidth={2.6} />
                <span>BACK</span>
              </button>

              <span 
                style={{ 
                  fontSize: '0.56rem', 
                  fontWeight: 800, 
                  fontFamily: 'var(--font-mono, monospace)', 
                  color: '#64748b',
                  letterSpacing: '0.4px'
                }}
              >
                ENTER 4-DIGIT CODE
              </span>
            </div>

            {/* 4 Themed Square Code Boxes (Transparent background, black border, red text) */}
            <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'space-between' }}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--red-primary, #dc2626)';
                    e.target.style.boxShadow = '0 0 0 1px var(--red-primary, #dc2626)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--black-solid, #090d16)';
                    e.target.style.boxShadow = 'none';
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: 0,
                    maxWidth: 40,
                    aspectRatio: '1 / 1',
                    textAlign: 'center',
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono, monospace)',
                    background: 'transparent',
                    border: '1.5px solid var(--black-solid, #090d16)',
                    borderRadius: 0,
                    outline: 'none',
                    color: 'var(--red-primary, #dc2626)',
                    caretColor: 'var(--red-primary, #dc2626)',
                    padding: 0,
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                />
              ))}
            </div>

            {/* Single [Connect] Button (Compact & Themed) */}
            <button
              type="button"
              onClick={handleConnectRcCode}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '6px 10px',
                background: 'var(--red-primary, #dc2626)',
                color: '#ffffff',
                border: '1.5px solid var(--black-solid, #090d16)',
                borderRadius: 0,
                fontSize: '0.68rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px rgba(0,0,0,0.15)',
                transition: 'all 0.1s ease'
              }}
            >
              <span>CONNECT</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Guide Icon Link */}
      <div style={{ paddingBottom: 4 }}>
        <button
          type="button"
          onClick={() => navigate('/guide')}
          title="Open Wiring Diagram & User Guide"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '0.62rem',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 800,
            letterSpacing: '0.4px',
            padding: '4px 6px'
          }}
        >
          <BookOpen size={14} color="#dc2626" />
          <span>GUIDE &amp; WIRING</span>
        </button>
      </div>
    </div>
  );
};

export default ConnectBluetoothPage;
