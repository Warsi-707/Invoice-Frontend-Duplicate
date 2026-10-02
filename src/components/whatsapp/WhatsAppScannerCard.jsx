import React, { useState, useEffect, useRef, useCallback } from 'react';
import { whatsappApi } from '../../services/api';
import { cleanPhoneInput } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

function formatSeconds(sec) {
  const total = Math.max(0, Math.round(sec));
  if (total < 60) return `${total} sec`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s > 0 ? `${m} min ${s} sec` : `${m} min`;
}

export default function WhatsAppScannerCard({ isStandalone = false, compact = false }) {
  const { state, updateSettings, showToast, setCurrentPage } = useApp();

  const [status, setStatus] = useState('SCAN_QR'); // 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED'
  const [qrCode, setQrCode] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsgSent, setTestMsgSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkMode, setLinkMode] = useState('qr'); // 'qr' | 'pairing'
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const pollTimerRef = useRef(null);

  // Timing & Speed settings state
  const savedWaSettings = state.settings?.whatsappSettings || {};
  const [initialDelay, setInitialDelay] = useState(savedWaSettings.initialDelay ?? 2);
  const [messageDelay, setMessageDelay] = useState(savedWaSettings.messageDelay ?? 3);
  const [timerSaved, setTimerSaved] = useState(false);

  useEffect(() => {
    if (state.settings?.whatsappSettings) {
      if (state.settings.whatsappSettings.initialDelay !== undefined) {
        setInitialDelay(state.settings.whatsappSettings.initialDelay);
      }
      if (state.settings.whatsappSettings.messageDelay !== undefined) {
        setMessageDelay(state.settings.whatsappSettings.messageDelay);
      }
    }
  }, [state.settings?.whatsappSettings]);

  const handleSaveTimers = async (e) => {
    e?.preventDefault();
    const cleanInitial = Math.max(0, Number(initialDelay) || 0);
    const cleanInterval = Math.max(1, Number(messageDelay) || 1);

    await updateSettings({
      ...state.settings,
      whatsappSettings: {
        initialDelay: cleanInitial,
        messageDelay: cleanInterval
      }
    });

    setTimerSaved(true);
    showToast(`✅ WhatsApp timing saved: First message ${cleanInitial}s, Interval ${cleanInterval}s`);
    setTimeout(() => setTimerSaved(false), 3000);
  };

  const handleApplyPreset = (initSec, intervalSec) => {
    setInitialDelay(initSec);
    setMessageDelay(intervalSec);
  };

  // Calculation for 100 recipients simulator
  const sampleCount = 100;
  const numInitial = Math.max(0, Number(initialDelay) || 0);
  const numInterval = Math.max(1, Number(messageDelay) || 1);
  const totalSimulatedSec = sampleCount > 0 ? numInitial + (sampleCount - 1) * numInterval : 0;

  const handleRequestPairingCode = async (e) => {
    if (e) e.preventDefault();
    if (!pairingPhone) return;
    setPairingLoading(true);
    setErrorMsg('');
    try {
      const res = await whatsappApi.requestPairingCode(pairingPhone);
      if (res && res.code) {
        setPairingCode(res.code);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Linking code nahi ban saka. Phone number check karein.');
    } finally {
      setPairingLoading(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await whatsappApi.getStatus();
      if (res) {
        setStatus(res.status);
        if (res.qrCode) setQrCode(res.qrCode);
        if (res.user) setUser(res.user);
        setErrorMsg('');
      }
    } catch (err) {
      console.warn('WhatsApp status poll error:', err.message);
    }
  }, []);

  const handleConnect = async (force = false) => {
    setLoading(true);
    setErrorMsg('');
    if (force) {
      setQrCode(null);
    }
    try {
      const res = await whatsappApi.connect(force);
      if (res) {
        setStatus(res.status);
        if (res.qrCode) setQrCode(res.qrCode);
        if (res.user) setUser(res.user);
      }
    } catch (err) {
      console.warn('Failed to connect WhatsApp:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    setLoading(true);
    try {
      await whatsappApi.logout();
      setStatus('SCAN_QR');
      setQrCode(null);
      setUser(null);
    } catch (err) {
      alert('Logout error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openNewTabScanner = () => {
    window.open('/?page=whatsapp-scan', '_blank');
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone) return;
    setLoading(true);
    setTestMsgSent(false);
    try {
      await whatsappApi.sendText(
        testPhone,
        `✅ *Test Message from Invoice Manager*\n\nWhatsApp API connection is working perfectly!`
      );
      setTestMsgSent(true);
      setTimeout(() => setTestMsgSent(false), 4000);
    } catch (err) {
      alert('Error sending test message: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleConnect(false);
    fetchStatus();

    pollTimerRef.current = setInterval(() => {
      fetchStatus();
    }, 1200);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchStatus]);

  const isConnected = status === 'CONNECTED';

  return (
    <div className={`wa-scanner-card ${isStandalone ? 'standalone' : ''} ${compact ? 'compact' : ''}`}>
      {/* Top Header */}
      <div className="wa-card-header">
        <div className="wa-title-group">
          <div className="wa-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div>
            <h3>WhatsApp Automatic Delivery & Timers</h3>
            <p className="wa-subtitle">Bilkut Free — apna WhatsApp connect karo, bills & bulk messages auto jayenge</p>
          </div>
        </div>

        <div>
          {isConnected ? (
            <span className="wa-status-badge connected">
              <span className="dot"></span> Connected {user?.phone ? `(${user.phone})` : ''}
            </span>
          ) : (
            <span className="wa-status-badge scan" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
              <span className="dot" style={{ background: '#f59e0b' }}></span> Scan QR Code
            </span>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="wa-card-body">
        {isConnected ? (
          <div className="wa-connected-box">
            <div className="wa-check-circle">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h4>WhatsApp is Connected!</h4>
            <p>Linked Phone: <strong>{user?.phone || 'Linked'}</strong></p>
            <p className="wa-connected-sub">Invoices generate hote hi direct customer ke WhatsApp par chali jayengi.</p>

            <form onSubmit={handleSendTestMessage} className="wa-test-form">
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                className="input phone11"
                placeholder="03001234567"
                value={testPhone}
                onChange={(e) => setTestPhone(cleanPhoneInput(e.target.value))}
                style={{ maxWidth: '180px', height: '36px', fontSize: '13px' }}
              />
              <button type="submit" className="btn btn-outline" style={{ height: '36px', fontSize: '13px' }} disabled={loading || !testPhone}>
                {loading ? '...' : 'Send Test'}
              </button>
            </form>
            {testMsgSent && <div className="wa-success-alert">✅ Test message sent successfully!</div>}
          </div>
        ) : (
          <div className="wa-qr-container">
            {/* Dual Mode Switcher Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', justifyContent: 'center' }}>
              <button
                type="button"
                className={`btn ${linkMode === 'qr' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px' }}
                onClick={() => setLinkMode('qr')}
              >
                📷 Scan QR Code
              </button>
              <button
                type="button"
                className={`btn ${linkMode === 'pairing' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px' }}
                onClick={() => setLinkMode('pairing')}
              >
                🔢 Link with Phone Number (Code)
              </button>
            </div>

            {linkMode === 'qr' ? (
              <>
                <div className="wa-qr-frame">
                  {qrCode ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="wa-qr-img" />
                  ) : (
                    <div className="wa-qr-placeholder">
                      <div className="spinner" style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#10b981' }}></div>
                      <p style={{ fontSize: '13px', marginTop: '10px', color: '#64748b', fontWeight: '500' }}>
                        Generating QR Code...
                      </p>
                    </div>
                  )}
                </div>

                <div className="wa-instructions">
                  <div className="wa-step-highlight">
                    <strong>WhatsApp Kholein</strong> → <strong>3 Dots</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong>
                  </div>
                  <div className="wa-step-sub">
                    Agar scan me problem aaye to upar <strong>"Link with Phone Number"</strong> select karein.
                  </div>
                </div>
              </>
            ) : (
              <div className="wa-pairing-box" style={{ maxWidth: '380px', margin: '0 auto', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                  Apna WhatsApp number daalein aur 8-digit linking code hasil karein:
                </p>
                <form onSubmit={handleRequestPairingCode} style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    className="input phone11"
                    placeholder="03001234567"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(cleanPhoneInput(e.target.value))}
                    style={{ maxWidth: '170px', height: '38px', fontSize: '13.5px' }}
                    disabled={pairingLoading}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ height: '38px', fontSize: '12.5px', whiteSpace: 'nowrap' }}
                    disabled={pairingLoading || !pairingPhone}
                  >
                    {pairingLoading ? 'Generating...' : 'Get Code'}
                  </button>
                </form>

                {pairingCode && (
                  <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px', padding: '12px', margin: '12px 0' }}>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>
                      Aapka WhatsApp Linking Code:
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', letterSpacing: '4px', margin: '6px 0', fontFamily: 'monospace' }}>
                      {pairingCode}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#166534', lineHeight: '1.4' }}>
                      Mobile WhatsApp me <strong>"Link with phone number instead"</strong> par click karke yeh code enter karein.
                    </div>
                  </div>
                )}

                <div className="wa-instructions" style={{ marginTop: '8px' }}>
                  <div className="wa-step-highlight">
                    <strong>WhatsApp</strong> → <strong>3 Dots</strong> → <strong>Linked Devices</strong> → <strong>Link with phone number instead</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {errorMsg && <div className="wa-error-alert">{errorMsg}</div>}

        {/* =========================================================================
            WHATSAPP TIMER & INTERVAL RATE-LIMIT SETTINGS (100 Contacts Simulator)
           ========================================================================= */}
        <div className="wa-timer-config-card" style={{
          marginTop: '18px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#dbeafe', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: '700', fontSize: '14px' }}>
                ⏱️
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '13.5px', color: '#0f172a', fontWeight: '700' }}>
                  WhatsApp Timing &amp; Speed Controls
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Select 1st message start timer &amp; interval between bulk contacts
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#fff' }}
                onClick={() => handleApplyPreset(1, 2)}
                title="Fast delivery speed"
              >
                ⚡ Fast (1s/2s)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#fff', borderColor: '#86efac', color: '#15803d' }}
                onClick={() => handleApplyPreset(2, 3)}
                title="Recommended anti-ban timing"
              >
                🛡️ Safe (2s/3s)
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', background: '#fff' }}
                onClick={() => handleApplyPreset(3, 5)}
                title="Extra safe for large lists"
              >
                🔒 Strict (3s/5s)
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveTimers}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '14px'
            }}>
              {/* First Message Timer */}
              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  🚀 First Message Start Delay (Seconds)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    className="input"
                    style={{ width: '90px', fontWeight: '700', fontSize: '14px' }}
                    value={initialDelay}
                    onChange={(e) => setInitialDelay(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>sec</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', lineHeight: '1.3' }}>
                  Pehla message <strong>{numInitial} sec</strong> baad dispatch hoga.
                </div>
              </div>

              {/* Per-Message Interval */}
              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  ⏳ Delay Between Messages (Per Message)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    className="input"
                    style={{ width: '90px', fontWeight: '700', fontSize: '14px' }}
                    value={messageDelay}
                    onChange={(e) => setMessageDelay(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>sec / msg</span>
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', lineHeight: '1.3' }}>
                  Har contact ke beech <strong>{numInterval} sec</strong> ka waqfa (delay) rahega.
                </div>
              </div>
            </div>

            {/* Live 100 Contacts Simulator Breakdown */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    📊 100 Contacts Delivery Estimation:
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>
                    100 Messages Total Time: ~{formatSeconds(totalSimulatedSec)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                    Breakdown: 1st msg in <strong>{numInitial}s</strong> + remaining 99 msgs × <strong>{numInterval}s</strong> = <strong>{totalSimulatedSec} seconds</strong>.
                  </div>
                </div>

                <div style={{
                  background: numInterval >= 3 ? '#dcfce7' : '#fef9c3',
                  border: `1px solid ${numInterval >= 3 ? '#86efac' : '#fde047'}`,
                  color: numInterval >= 3 ? '#166534' : '#854d0e',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {numInterval >= 3 ? '🟢 Anti-Ban Safe' : '⚠️ Fast Speed'}
                </div>
              </div>
            </div>

            {/* Save Timers Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '12.5px', padding: '7px 16px', background: '#059669', borderColor: '#059669', borderRadius: '8px', color: '#ffffff', fontWeight: 600 }}
              >
                💾 Save Timing Settings
              </button>

              {timerSaved && (
                <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: '700' }}>
                  ✅ Timing configuration saved!
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="wa-card-actions">
        {!isStandalone && (
          <>
            <button
              type="button"
              className="wa-btn-primary"
              onClick={openNewTabScanner}
              title="Connect WhatsApp in new tab"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span>Connect WhatsApp (Open New Tab) ↗</span>
            </button>
            <button
              type="button"
              className="wa-btn-outline-green"
              onClick={openNewTabScanner}
              title="Open scanner in new tab"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Open Scanner in New Tab ↗</span>
            </button>
          </>
        )}

        <button
          type="button"
          className="wa-btn-refresh"
          onClick={() => handleConnect(true)}
          disabled={loading}
          title="Refresh QR Code"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Refresh</span>
        </button>

        {isConnected && (
          <button
            type="button"
            className="wa-btn-logout"
            onClick={handleLogout}
            disabled={loading}
          >
            <span>Disconnect</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="wa-card-footer">
        <span>Click karne se naya tab khulega jahan se mobile WhatsApp se QR code scan kar sakte hain.</span>
      </div>
    </div>
  );
}
