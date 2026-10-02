import React from 'react';
import { useApp } from '../../context/AppContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdminModal from './AdminModal';
import Toast from '../common/Toast';

export default function AppLayout({ children }) {
  const { isSidebarCollapsed } = useApp();

  return (
    <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className={`main ${isSidebarCollapsed ? 'collapsed' : ''}`}>
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
