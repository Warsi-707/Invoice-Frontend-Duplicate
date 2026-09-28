import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function Sidebar() {
  const { currentPage, setCurrentPage, settingsTab, setSettingsTab, logout } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(currentPage === 'settings');

  useEffect(() => {
    if (currentPage === 'settings') {
      setIsSettingsOpen(true);
    }
  }, [currentPage]);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    },
    {
      id: 'businesses',
      label: 'Business / Client',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      id: 'generator',
      label: 'Invoice Generator',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      )
    },
    {
      id: 'collections',
      label: 'Invoice Collection',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      )
    },
    {
      id: 'ledger',
      label: 'Client Ledger',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="16" y2="11" />
          <line x1="8" y1="15" x2="13" y2="15" />
        </svg>
      )
    },
    {
      id: 'reversals',
      label: 'Reversals',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      )
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    }
  ];

  const handleSettingsMainClick = () => {
    if (currentPage !== 'settings') {
      setCurrentPage('settings');
      setIsSettingsOpen(true);
    } else {
      setIsSettingsOpen(!isSettingsOpen);
    }
  };

  const handleSubTabClick = (tabKey) => {
    setSettingsTab(tabKey);
    setCurrentPage('settings');
    setIsSettingsOpen(true);
  };

  const handleLogout = () => {
    if (confirm('Logout from portal?')) {
      logout();
    }
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div>
          <h1>Invoice Manager</h1>
          <p>Multi Business Billing</p>
        </div>
      </div>

      <nav className="nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={currentPage === item.id ? 'active' : ''}
            onClick={() => setCurrentPage(item.id)}
          >
            <span className="nav-icon-wrap">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        {/* Settings Module with Expandable Sub-Modules Accordion */}
        <div className="nav-dropdown-group">
          <button
            type="button"
            className={`nav-parent-btn ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={handleSettingsMainClick}
          >
            <span className="nav-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
            <span className={`nav-arrow ${isSettingsOpen ? 'open' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          {/* 3 Sub-Modules Dropdown Menu */}
          {isSettingsOpen && (
            <div className="nav-submenu">
              <button
                type="button"
                className={`nav-sub-item ${currentPage === 'settings' && (settingsTab === 'org' || !settingsTab) ? 'active' : ''}`}
                onClick={() => handleSubTabClick('org')}
              >
                <span>Organization Identity</span>
              </button>

              <button
                type="button"
                className={`nav-sub-item ${currentPage === 'settings' && settingsTab === 'proposal' ? 'active' : ''}`}
                onClick={() => handleSubTabClick('proposal')}
              >
                <span>Proposal & Letterhead</span>
              </button>

              <button
                type="button"
                className={`nav-sub-item ${currentPage === 'settings' && settingsTab === 'invoice' ? 'active' : ''}`}
                onClick={() => handleSubTabClick('invoice')}
              >
                <span>Invoice Settings</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="bottom">
        <button type="button" className="logout" onClick={handleLogout}>
          <span className="nav-icon-wrap">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
