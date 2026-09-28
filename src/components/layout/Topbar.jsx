import React from 'react';
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

export default function Topbar() {
  const { currentPage, state, setIsAdminModalOpen, isDbConnected } = useApp();
  const pageTitle = PAGE_TITLES[currentPage] || 'Dashboard';
  const adminName = state.settings?.admin || 'Admin';

  return (
    <header className="topbar">
      <div>
        <h2>{pageTitle}</h2>
        <div className="sub">Business, client, invoice & collection management</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '500',
          background: isDbConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: isDbConnected ? '#10b981' : '#ef4444',
          border: `1px solid ${isDbConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isDbConnected ? '#10b981' : '#ef4444',
            display: 'inline-block'
          }}></span>
          <span>{isDbConnected ? 'Neon PostgreSQL Live' : 'Offline Mode'}</span>
        </div>

        <div className="admin" onClick={() => setIsAdminModalOpen(true)} title="View Admin Profile">
          <div className="avatar">{adminName.charAt(0).toUpperCase() || 'A'}</div>
          <div>
            <strong>{adminName}</strong>
            <div className="sub">Administrator</div>
          </div>
        </div>
      </div>
    </header>
  );
}
