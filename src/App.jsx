import React, { useEffect } from 'react';
import { useApp } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BusinessCustomerPage from './pages/BusinessCustomerPage';
import InvoiceGeneratorPage from './pages/InvoiceGeneratorPage';
import InvoiceCollectionPage from './pages/InvoiceCollectionPage';
import ClientLedgerPage from './pages/ClientLedgerPage';
import ReversalsPage from './pages/ReversalsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import WhatsAppScanPage from './pages/WhatsAppScanPage';
import { handleEnterFlowKeyDown } from './utils/enterFlow';

export default function App() {
  const { state, currentPage } = useApp();
  const isAuthenticated = state.session?.isAuthenticated;

  // Check if opened as standalone whatsapp scanner
  const isScanPage =
    window.location.search.includes('page=whatsapp-scan') ||
    window.location.pathname === '/whatsapp-scan';

  if (isScanPage) {
    return <WhatsAppScanPage />;
  }

  // Global enter-flow key listener
  useEffect(() => {
    window.addEventListener('keydown', handleEnterFlowKeyDown);
    return () => window.removeEventListener('keydown', handleEnterFlowKeyDown);
  }, []);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'businesses':
        return <BusinessCustomerPage />;
      case 'generator':
        return <InvoiceGeneratorPage />;
      case 'collections':
        return <InvoiceCollectionPage />;
      case 'ledger':
        return <ClientLedgerPage />;
      case 'reversals':
        return <ReversalsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <AppLayout>{renderActivePage()}</AppLayout>;
}
