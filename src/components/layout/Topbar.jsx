import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  businesses: 'Business / Client',
  generator: 'Invoice Generator',
  collections: 'Invoice Collection',
  ledger: 'Client Ledger',
  reversals: 'Reversals',
  reports: 'Reports',
  settings: 'Settings'
};

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function Topbar() {
  const {
    currentPage,
    setCurrentPage,
    state,
    setIsAdminModalOpen,
    isDbConnected,
    notifications,
    unreadNotificationsCount,
    markAllNotificationsRead,
    deleteNotification,
    handleNotificationClick
  } = useApp();

  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard';
  const adminName = state.settings?.admin || 'Admin';

  const [bellOpen, setBellOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [bellOpen]);

  const handleBellClick = () => {
    setBellOpen((prev) => !prev);
  };

  const handleNotifItemClick = (notif) => {
    setBellOpen(false);
    handleNotificationClick(notif);
  };

  return (
    <header className="topbar">
      <div>
        <h2>{pageTitle}</h2>
        <div className="sub">Manage finances, transactions, and invoices</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* DB Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '600',
          background: isDbConnected ? '#eaf5ee' : '#fef2f2',
          color: isDbConnected ? '#059669' : '#dc2626',
          border: `1px solid ${isDbConnected ? '#a7f3d0' : '#fecaca'}`
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isDbConnected ? '#10b981' : '#ef4444',
            display: 'inline-block'
          }}></span>
          <span>{isDbConnected ? 'Neon DB Live' : 'Offline Mode'}</span>
        </div>

        {/* 🔔 Notification Bell */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            id="notification-bell-btn"
            onClick={handleBellClick}
            title="Subscription Notifications"
            style={{
              position: 'relative',
              background: bellOpen ? '#f4f4f5' : '#ffffff',
              border: `1px solid ${bellOpen ? '#18181b' : '#e4e4e7'}`,
              borderRadius: '9999px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: bellOpen ? '#18181b' : '#71717a',
              transition: 'all 0.15s ease',
              boxShadow: 'none'
            }}
          >
            <BellIcon />
            {unreadNotificationsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#ef4444',
                color: '#fff',
                fontSize: '10px',
                fontWeight: '700',
                lineHeight: 1,
                minWidth: '17px',
                height: '17px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                border: '2px solid var(--bg, #fff)'
              }}>
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {bellOpen && (
            <div id="notification-dropdown" style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '360px',
              background: '#ffffff',
              borderRadius: '12px',
              boxShadow: 'none',
              border: '1px solid #cbd5e1',
              zIndex: 9999,
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(100,116,139,0.1)',
                background: 'rgba(248,250,252,0.9)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <BellIcon />
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>Notifications</strong>
                  {unreadNotificationsCount > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '1px 6px',
                      borderRadius: '8px'
                    }}>
                      {unreadNotificationsCount} new
                    </span>
                  )}
                </div>
                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      textDecoration: 'underline'
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔔</div>
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifItemClick(notif)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '11px 14px',
                        borderBottom: '1px solid rgba(100,116,139,0.07)',
                        cursor: 'pointer',
                        background: notif.isRead ? 'transparent' : 'rgba(99,102,241,0.04)',
                        transition: 'background 0.12s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = notif.isRead ? 'transparent' : 'rgba(99,102,241,0.04)'}
                    >
                      {/* Unread dot */}
                      {!notif.isRead && (
                        <span style={{
                          position: 'absolute',
                          left: '5px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#6366f1',
                          flexShrink: 0
                        }} />
                      )}

                      {/* Icon */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(245,158,11,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        flexShrink: 0,
                        marginLeft: !notif.isRead ? '8px' : '0'
                      }}>
                        🔔
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '11px',
                          color: '#6366f1',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          marginBottom: '2px'
                        }}>
                          Subscription Reminder
                        </div>
                        <div style={{
                          fontSize: '12.5px',
                          color: '#334155',
                          lineHeight: '1.4',
                          fontWeight: notif.isRead ? '400' : '500'
                        }}>
                          {notif.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          marginTop: '3px'
                        }}>
                          {formatTimeAgo(notif.createdAt)}
                          {notif.customerName && (
                            <span style={{
                              marginLeft: '6px',
                              color: '#6366f1',
                              fontWeight: '500'
                            }}>
                              • View Ledger →
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        title="Dismiss"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#cbd5e1',
                          fontSize: '14px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          lineHeight: 1
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div style={{
                  padding: '8px 16px',
                  borderTop: '1px solid rgba(100,116,139,0.1)',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: 'rgba(248,250,252,0.7)'
                }}>
                  {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
                </div>
              )}
            </div>
          )}
        </div>

        {/* User / Admin Profile Capsule Pill (Matching Reference) */}
        <div className="admin" onClick={() => setIsAdminModalOpen(true)} title="View Admin Profile">
          <div className="avatar" style={{ background: '#f4f4f5', color: '#18181b', border: '1px solid #e4e4e7', fontWeight: 700 }}>
            {adminName.slice(0, 2).toUpperCase() || 'AD'}
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <strong style={{ fontSize: '12.5px', color: '#18181b' }}>{adminName}</strong>
            <div className="sub" style={{ fontSize: '10.5px', color: '#71717a' }}>Administrator</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
}
