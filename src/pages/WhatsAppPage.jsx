import React, { useState, useEffect, useRef } from 'react';
import WhatsAppScannerCard from '../components/whatsapp/WhatsAppScannerCard';
import Button from '../components/common/Button';
import { whatsappApi } from '../services/api';
import { cleanPhoneInput } from '../utils/formatters';
import { useApp } from '../context/AppContext';

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

export default function WhatsAppPage() {
  const { state, updateSettings, showToast } = useApp();

  const [recipientText, setRecipientText] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  // Delay settings initialized from global settings
  const savedWa = state.settings?.whatsappSettings || {};
  const [initialDelay, setInitialDelay] = useState(savedWa.initialDelay ?? 2);
  const [messageDelay, setMessageDelay] = useState(savedWa.messageDelay ?? 3);

  // Broadcast state
  // status: 'idle' | 'initial_delay' | 'sending' | 'interval_delay' | 'paused' | 'completed' | 'cancelled'
  const [broadcastStatus, setBroadcastStatus] = useState('idle');
  const [countdown, setCountdown] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Cancellation and pause refs
  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);
  const elapsedTimerRef = useRef(null);

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

  // Recipient list parser
  const recipients = React.useMemo(() => {
    const rawTokens = recipientText.split(/[\s,;|\n\r]+/);
    const valid = [];
    const seen = new Set();

    for (const token of rawTokens) {
      const cleaned = cleanPhoneInput(token);
      if (cleaned.length >= 10 && !seen.has(cleaned)) {
        seen.add(cleaned);
        valid.push(cleaned);
      }
    }
    return valid;
  }, [recipientText]);

  // Total estimated calculation
  const totalCount = recipients.length;
  const numInitial = Math.max(0, Number(initialDelay) || 0);
  const numInterval = Math.max(1, Number(messageDelay) || 1);
  const totalEstimatedSec = totalCount > 0 ? numInitial + (totalCount - 1) * numInterval : 0;

  // Remaining ETA
  const remainingCount = Math.max(0, totalCount - (sentCount + failedCount));
  const remainingEstimatedSec = remainingCount > 0 ? remainingCount * numInterval : 0;

  // Countdown timer helper
  const runCountdown = (seconds, label) => {
    return new Promise((resolve) => {
      let current = seconds;
      setCountdown(current);
      if (current <= 0) {
        resolve();
        return;
      }
      const interval = setInterval(() => {
        if (isCancelledRef.current) {
          clearInterval(interval);
          resolve();
          return;
        }
        if (isPausedRef.current) {
          return; // pause ticking
        }
        current -= 1;
        setCountdown(current);
        if (current <= 0) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  };

  const handleSaveTimingSettings = async () => {
    await updateSettings({
      ...state.settings,
      whatsappSettings: {
        initialDelay: numInitial,
        messageDelay: numInterval
      }
    });
    showToast(`✅ Default timing saved: First ${numInitial}s, Interval ${numInterval}s`);
  };

  const handleStartBroadcast = async (e) => {
    e?.preventDefault();
    if (recipients.length === 0) {
      alert('Please enter at least 1 valid WhatsApp phone number.');
      return;
    }
    if (!bulkMessage.trim()) {
      alert('Please enter a message to send.');
      return;
    }

    // Reset controls
    isCancelledRef.current = false;
    isPausedRef.current = false;
    setSentCount(0);
    setFailedCount(0);
    setCurrentIdx(0);
    setDeliveryLogs([]);
    setElapsedSec(0);

    // Start elapsed stopwatch
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setElapsedSec((prev) => prev + 1);
      }
    }, 1000);

    const messageText = bulkMessage.trim();

    // 1. Initial Delay Phase (First message timer)
    if (numInitial > 0) {
      setBroadcastStatus('initial_delay');
      await runCountdown(numInitial, 'Starting initial delay');
    }

    if (isCancelledRef.current) {
      setBroadcastStatus('cancelled');
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      return;
    }

    // 2. Sequential Message Dispatch
    let sCount = 0;
    let fCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      if (isCancelledRef.current) {
        break;
      }

      // Handle pause waiting
      while (isPausedRef.current && !isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 400));
      }

      if (isCancelledRef.current) break;

      setCurrentIdx(i + 1);
      setBroadcastStatus('sending');

      const phone = recipients[i];
      const nowTime = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });

      try {
        const res = await whatsappApi.sendText(phone, messageText);
        sCount += 1;
        setSentCount(sCount);
        setDeliveryLogs((prev) => [
          {
            index: i + 1,
            phone,
            status: 'sent',
            time: nowTime,
            messageId: res?.result?.messageId || res?.messageId || 'SENT'
          },
          ...prev
        ]);
      } catch (err) {
        fCount += 1;
        setFailedCount(fCount);
        setDeliveryLogs((prev) => [
          {
            index: i + 1,
            phone,
            status: 'failed',
            time: nowTime,
            error: err.message || 'Failed to send'
          },
          ...prev
        ]);
        console.error(`WhatsApp send failed for ${phone}:`, err);
      }

      // 3. Inter-message Delay Phase (if more messages remaining)
      if (i < recipients.length - 1 && !isCancelledRef.current) {
        setBroadcastStatus('interval_delay');
        await runCountdown(numInterval, 'Interval delay');
      }
    }

    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

    if (isCancelledRef.current) {
      setBroadcastStatus('cancelled');
      showToast('⏹️ Bulk Broadcast stopped.');
    } else {
      setBroadcastStatus('completed');
      showToast(`🎉 Broadcast Finished: ${sCount} sent, ${fCount} failed.`);
    }
  };

  const handlePauseResume = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setBroadcastStatus('sending');
      showToast('▶️ Resumed bulk sending');
    } else {
      isPausedRef.current = true;
      setBroadcastStatus('paused');
      showToast('⏸️ Bulk sending paused');
    }
  };

  const handleStop = () => {
    if (confirm('Are you sure you want to stop the bulk WhatsApp broadcast?')) {
      isCancelledRef.current = true;
      isPausedRef.current = false;
      setBroadcastStatus('cancelled');
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
  };

  const isRunning = broadcastStatus === 'initial_delay' || broadcastStatus === 'sending' || broadcastStatus === 'interval_delay' || broadcastStatus === 'paused';
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round(((sentCount + failedCount) / totalCount) * 100)) : 0;

  return (
    <section id="whatsapp" className="page active">
      <div className="wa-page-layout">
        {/* Left Column: Scanner & Bulk Sender */}
        <div className="wa-main-col">
          <WhatsAppScannerCard isStandalone={false} />

          {/* Bulk WhatsApp Broadcast Console */}
          <div className="settings-card" style={{ marginTop: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📣 Bulk WhatsApp Broadcast &amp; Rate-Limiting Engine</span>
                </h4>
                <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '11.5px' }}>
                  Send personalized announcements or statements to 100+ contacts with configurable delays to avoid bans.
                </p>
              </div>

              {recipients.length > 0 && (
                <div style={{
                  background: '#eaf5ee',
                  border: '1px solid #d1fae5',
                  color: '#047857',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontWeight: '700',
                  fontSize: '12px'
                }}>
                  👥 {recipients.length} Valid Recipients
                </div>
              )}
            </div>

            <form onSubmit={handleStartBroadcast}>
              {/* Recipients Input Box */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontWeight: '700', fontSize: '12px', color: '#334155' }}>
                    Recipient Phone Numbers
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Comma, space, or new line separated (e.g. 03001234567)
                  </span>
                </div>
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="03001234567, 03111234567 or paste from Excel column..."
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                  disabled={isRunning}
                  style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.4' }}
                />
              </div>

              {/* Message Text Area */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontWeight: '700', fontSize: '12px', color: '#334155' }}>
                    Message Content
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {bulkMessage.length} characters
                  </span>
                </div>
                <textarea
                  className="textarea"
                  rows={5}
                  placeholder="Type your WhatsApp broadcast message here... E.g. Dear Valued Customer, your monthly invoice is ready."
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  disabled={isRunning}
                  style={{ fontSize: '12.5px', lineHeight: '1.45' }}
                />
              </div>

              {/* =========================================================================
                  LIVE TIMING CONFIGURATION BAR & TIME CALCULATOR
                 ========================================================================= */}
              <div style={{
                marginTop: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⏱️ Broadcast Speed &amp; Delay Timers</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#fff' }}
                    onClick={handleSaveTimingSettings}
                    disabled={isRunning}
                  >
                    Set as Default
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '10px'
                }}>
                  {/* First Message Timer */}
                  <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      🚀 1st Message Start Delay
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        className="input"
                        style={{ width: '70px', height: '30px', fontWeight: '700', fontSize: '13px' }}
                        value={initialDelay}
                        onChange={(e) => setInitialDelay(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        disabled={isRunning}
                      />
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>seconds</span>
                    </div>
                  </div>

                  {/* Delay Between Messages */}
                  <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      ⏳ Delay Between Contacts
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        className="input"
                        style={{ width: '70px', height: '30px', fontWeight: '700', fontSize: '13px' }}
                        value={messageDelay}
                        onChange={(e) => setMessageDelay(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        disabled={isRunning}
                      />
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>sec / message</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Calculation Summary Box */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '11.5px', color: '#166534' }}>
                    <strong>📊 Duration Estimate:</strong> {totalCount} recipients × {numInterval}s interval + {numInitial}s start delay =
                    <strong style={{ color: '#15803d', marginLeft: '4px', fontSize: '12.5px' }}>
                      ~{formatDuration(totalEstimatedSec)} Total Time
                    </strong>
                  </div>

                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>
                    {numInterval >= 3 ? '🛡️ Safe Anti-Ban Protection Active' : '⚡ High Speed Delivery'}
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  LIVE BROADCAST CONTROLS & PROGRESS MONITOR
                 ========================================================================= */}
              <div style={{ marginTop: '16px' }}>
                {!isRunning && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={recipients.length === 0 || !bulkMessage.trim()}
                      style={{ background: '#10b981', borderColor: '#10b981', padding: '9px 22px', fontSize: '13.5px', fontWeight: '700' }}
                    >
                      🚀 Start WhatsApp Broadcast ({recipients.length} Contacts)
                    </Button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setRecipientText('03001234567\n03111234567\n03211234567');
                        setBulkMessage('Hello! This is a test broadcast notification from Invoice Manager.');
                      }}
                    >
                      Fill Sample Data
                    </button>
                  </div>
                )}

                {isRunning && (
                  <div style={{
                    background: '#0f172a',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '16px 18px',
                    boxShadow: 'none',
                    border: '1px solid #334155'
                  }}>
                    {/* Header with status badge & controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: broadcastStatus === 'paused' ? '#eab308' : '#22c55e',
                          boxShadow: 'none'
                        }}></div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.3px' }}>
                            {broadcastStatus === 'initial_delay' && `⏳ Initializing 1st message in ${countdown}s...`}
                            {broadcastStatus === 'sending' && `📤 Dispatching Message ${currentIdx} of ${totalCount}...`}
                            {broadcastStatus === 'interval_delay' && `⏳ Pausing ${countdown}s before contact ${currentIdx + 1}...`}
                            {broadcastStatus === 'paused' && '⏸️ Broadcast Paused'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Elapsed: {formatDuration(elapsedSec)} • Remaining: ~{formatDuration(remainingEstimatedSec)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: broadcastStatus === 'paused' ? '#22c55e' : '#f59e0b',
                            color: '#fff',
                            border: 0,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}
                          onClick={handlePauseResume}
                        >
                          {broadcastStatus === 'paused' ? '▶️ Resume' : '⏸️ Pause'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 0,
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}
                          onClick={handleStop}
                        >
                          ⏹️ Stop
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      height: '10px',
                      borderRadius: '5px',
                      overflow: 'hidden',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>

                    {/* Metric Cards */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Total</div>
                        <div style={{ fontSize: '16px', fontWeight: '800' }}>{totalCount}</div>
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '8px', borderRadius: '6px', color: '#4ade80' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Sent</div>
                        <div style={{ fontSize: '16px', fontWeight: '800' }}>{sentCount}</div>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '8px', borderRadius: '6px', color: '#f87171' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Failed</div>
                        <div style={{ fontSize: '16px', fontWeight: '800' }}>{failedCount}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Progress</div>
                        <div style={{ fontSize: '16px', fontWeight: '800' }}>{progressPercent}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Live Delivery Activity Log Stream */}
            {deliveryLogs.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h5 style={{ margin: 0, fontSize: '12.5px', color: '#334155', fontWeight: '700' }}>
                    📋 Broadcast Activity Log ({deliveryLogs.length} Records)
                  </h5>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setDeliveryLogs([])}
                  >
                    Clear Logs
                  </button>
                </div>

                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: '#fff'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <tr>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Phone</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Time</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryLogs.map((log) => (
                        <tr key={log.index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{log.index}</td>
                          <td style={{ padding: '6px 10px', fontWeight: '600', fontFamily: 'monospace' }}>{log.phone}</td>
                          <td style={{ padding: '6px 10px' }}>
                            {log.status === 'sent' ? (
                              <span style={{ color: '#166534', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '10.5px' }}>
                                ✅ Sent
                              </span>
                            ) : (
                              <span style={{ color: '#991b1b', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '10.5px' }}>
                                ❌ Failed
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{log.time}</td>
                          <td style={{ padding: '6px 10px', color: '#64748b', fontSize: '11px' }}>
                            {log.messageId || log.error || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Information & Feature Cards */}
        <div className="wa-side-col">
          <div className="settings-card">
            <h4>⚡ WhatsApp Automation Features</h4>
            <ul className="wa-features-list">
              <li>
                <span className="wa-feat-icon">⏱️</span>
                <div>
                  <strong>Intelligent Rate Limiter &amp; Timers</strong>
                  <p>Configure custom initial delays &amp; safe interval gaps to send 100+ bulk messages safely.</p>
                </div>
              </li>
              <li>
                <span className="wa-feat-icon">🧾</span>
                <div>
                  <strong>Instant Bill &amp; Challan Delivery</strong>
                  <p>Invoices are automatically formatted with emojis, items table, balance due &amp; contact info.</p>
                </div>
              </li>
              <li>
                <span className="wa-feat-icon">🆓</span>
                <div>
                  <strong>100% Free Baileys Web Socket</strong>
                  <p>Direct device pairing using WhatsApp Web socket without third-party recurring charges.</p>
                </div>
              </li>
              <li>
                <span className="wa-feat-icon">💾</span>
                <div>
                  <strong>Permanent Session Memory</strong>
                  <p>Once paired, the device remains linked across server restarts and browser reloads.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="settings-card" style={{ marginTop: '16px' }}>
            <h4>📱 Quick Linking Instructions</h4>
            <ol className="wa-instructions-list">
              <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
              <li>Tap <strong>Menu (3 dots)</strong> or <strong>Settings</strong>.</li>
              <li>Select <strong>Linked Devices</strong> → Tap <strong>Link a Device</strong>.</li>
              <li>Point your phone camera at the QR code on the left to scan.</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
