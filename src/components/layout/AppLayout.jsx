import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdminModal from './AdminModal';
import Toast from '../common/Toast';

export default function AppLayout({ children }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">
          {children}
        </div>
      </div>
      <AdminModal />
      <Toast />
    </div>
  );
}
