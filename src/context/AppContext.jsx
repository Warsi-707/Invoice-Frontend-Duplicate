import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadStoredState, saveStoredState, DEFAULT_STATE } from '../utils/storage';
import { uid, today, money } from '../utils/formatters';
import { nextInvoiceNo } from '../utils/invoice';
import {
  bootstrapApi,
  authApi,
  businessCustomerApi,
  invoiceApi,
  reversalApi,
  settingsApi,
  clearClientApiCache
} from '../services/api';

const AppContext = createContext(null);

const getInitialPage = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam) return pageParam;
    const saved = localStorage.getItem('invoice_manager_active_page');
    if (saved) return saved;
  }
  return 'dashboard';
};

const getInitialSettingsTab = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) return tabParam;
    const saved = localStorage.getItem('invoice_manager_settings_tab');
    if (saved) return saved;
  }
  return 'org';
};

export function AppProvider({ children }) {
  const [state, setState] = useState(() => loadStoredState());
  const [currentPage, setCurrentPageInternal] = useState(getInitialPage);
  const [settingsTab, setSettingsTabInternal] = useState(getInitialSettingsTab);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [isDbConnected, setIsDbConnected] = useState(false);
  const toastTimerRef = useRef(null);

  const setCurrentPage = useCallback((page) => {
    setCurrentPageInternal(page);
    try {
      localStorage.setItem('invoice_manager_active_page', page);
      const url = new URL(window.location.href);
      url.searchParams.set('page', page);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }, []);

  const setSettingsTab = useCallback((tab) => {
    setSettingsTabInternal(tab);
    try {
      localStorage.setItem('invoice_manager_settings_tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }, []);

  // Toast notification dispatcher
  const showToast = useCallback((message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ show: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 2500);
  }, []);

  // Fetch initial data from PostgreSQL / Neon DB Backend
  const refreshFromBackend = useCallback(async () => {
    try {
      const data = await bootstrapApi.get();
      if (data) {
        setState((prev) => ({
          ...prev,
          settings: data.settings || prev.settings,
          businesses: Array.isArray(data.businesses) ? data.businesses : [],
          customers: Array.isArray(data.customers) ? data.customers : [],
          invoices: Array.isArray(data.invoices) ? data.invoices : [],
          reversals: Array.isArray(data.reversals) ? data.reversals : []
        }));
        setIsDbConnected(true);
      }
    } catch (err) {
      console.warn('Backend connection notice: running with cached state', err.message);
      setIsDbConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshFromBackend();
  }, [refreshFromBackend]);

  // Sync state changes to localStorage cache
  useEffect(() => {
    saveStoredState(state);
  }, [state]);

  // Handle automatic session expiration on 401 Unauthorized API responses
  useEffect(() => {
    const handleUnauthorized = () => {
      setState((prev) => {
        if (!prev.session?.isAuthenticated) return prev;
        return {
          ...prev,
          session: {
            isAuthenticated: false,
            username: prev.settings?.admin || 'Administrator'
          }
        };
      });
      showToast('Session expired. Please sign in again.');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [showToast]);

  // Lookup helpers
  const getBusiness = useCallback((id) => state.businesses.find((b) => b.id === id), [state.businesses]);
  const getCustomer = useCallback((id) => state.customers.find((c) => c.id === id), [state.customers]);
  const getBusinessName = useCallback((id) => getBusiness(id)?.name || '-', [getBusiness]);
  const getCustomerName = useCallback((id) => getCustomer(id)?.name || '-', [getCustomer]);
  const getCurrency = useCallback((businessId) => {
    const b = getBusiness(businessId);
    return b?.currency || state.settings?.currency || 'PKR';
  }, [getBusiness, state.settings]);

  const formatMoney = useCallback((amount, businessId) => {
    const cur = getCurrency(businessId);
    return money(amount, cur);
  }, [getCurrency]);

  // Authentication
  const login = useCallback(async (username, password) => {
    if (!username || !password) {
      return { success: false, message: 'Please enter both username and password.' };
    }

    try {
      const res = await authApi.login({ username: username.trim(), password: password.trim() });
      if (res && res.success) {
        setState((prev) => ({
          ...prev,
          session: {
            isAuthenticated: true,
            username: res.user?.username || username.trim()
          },
          settings: {
            ...prev.settings,
            admin: res.settings?.admin || username.trim(),
            ...(res.settings || {})
          }
        }));
        clearClientApiCache();
        setCurrentPage('dashboard');
        refreshFromBackend().catch(() => {});
        showToast(`Welcome, ${username.trim()}`);
        return { success: true };
      }
      return { success: false, message: res?.message || 'Invalid username or password.' };
    } catch (err) {
      return { success: false, message: err.message || 'Invalid username or password.' };
    }
  }, [refreshFromBackend, showToast, setCurrentPage]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // ignore
    }
    clearClientApiCache();
    setState((prev) => ({
      ...prev,
      session: {
        isAuthenticated: false,
        username: prev.settings?.admin || 'Administrator'
      }
    }));
    setCurrentPage('dashboard');
    showToast('Logged out successfully.');
  }, [showToast, setCurrentPage]);

  // Business / Customer Actions
  const addBusinessAndCustomer = useCallback(async ({
    businessName,
    category,
    phone,
    whatsapp,
    businessAddress,
    customerName,
    items = []
  }) => {
    const bName = businessName.trim();
    const bPhone = phone.trim();
    const cName = customerName.trim();

    // Optimistic UI state update
    let business = state.businesses.find(
      (b) => b.name.toLowerCase() === bName.toLowerCase()
    );

    const tempBizId = business ? business.id : uid('b');
    const tempCustId = uid('c');

    const newBiz = business ? {
      ...business,
      category: category.trim(),
      phone: bPhone,
      whatsapp: (whatsapp || '').trim(),
      address: businessAddress.trim()
    } : {
      id: tempBizId,
      name: bName,
      category: category.trim(),
      phone: bPhone,
      whatsapp: (whatsapp || '').trim(),
      address: businessAddress.trim(),
      prefix: 'INV',
      currency: state.settings?.currency || 'PKR'
    };

    const newCust = {
      id: tempCustId,
      businessId: tempBizId,
      name: cName,
      phone: bPhone,
      whatsapp: (whatsapp || '').trim(),
      address: businessAddress.trim(),
      items: items && items.length > 0 ? items : []
    };

    setState((prev) => {
      const filteredBiz = prev.businesses.filter(b => b.id !== tempBizId);
      return {
        ...prev,
        businesses: [...filteredBiz, newBiz],
        customers: [...prev.customers, newCust]
      };
    });

    // Background sync with PostgreSQL
    try {
      const res = await businessCustomerApi.add({
        businessName,
        category,
        phone,
        whatsapp,
        businessAddress,
        customerName,
        items
      });

      if (res && res.business && res.customer) {
        setState((prev) => ({
          ...prev,
          businesses: prev.businesses.map(b => (b.id === tempBizId ? res.business : b)),
          customers: prev.customers.map(c => (c.id === tempCustId ? res.customer : c))
        }));
      }
      showToast('Client added to Neon DB.');
    } catch (err) {
      console.error('API Error adding client:', err);
      showToast('Saved locally.');
    }
  }, [state.businesses, state.settings, showToast]);

  const updateBusinessAndCustomer = useCallback(async ({
    customerId,
    businessId,
    businessName,
    category,
    phone,
    whatsapp,
    businessAddress,
    customerName,
    items = []
  }) => {
    // Optimistic update
    setState((prev) => {
      const updatedBusinesses = prev.businesses.map((b) => {
        if (b.id === businessId) {
          return {
            ...b,
            name: businessName.trim(),
            category: category.trim(),
            phone: phone.trim(),
            whatsapp: (whatsapp || '').trim(),
            address: businessAddress.trim()
          };
        }
        return b;
      });

      const updatedCustomers = prev.customers.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            name: customerName.trim(),
            phone: phone.trim(),
            whatsapp: (whatsapp || '').trim(),
            address: businessAddress.trim(),
            items: items && items.length > 0 ? items : (c.items || [])
          };
        }
        return c;
      });

      return {
        ...prev,
        businesses: updatedBusinesses,
        customers: updatedCustomers
      };
    });

    showToast('Business & Client updated.');

    // Background sync with PostgreSQL
    try {
      await businessCustomerApi.update({
        customerId,
        businessId,
        businessName,
        category,
        phone,
        whatsapp,
        businessAddress,
        customerName,
        items
      });
    } catch (err) {
      console.error('API Error updating client:', err);
    }
  }, [showToast]);

  const deleteCustomerRecord = useCallback(async (customerId) => {
    const hasInvoices = state.invoices.some((i) => i.customerId === customerId);
    if (hasInvoices) {
      alert('This customer has invoice history and cannot be deleted.');
      return false;
    }

    const customer = state.customers.find((c) => c.id === customerId);
    const businessId = customer?.businessId;

    setState((prev) => {
      const filteredCustomers = prev.customers.filter((c) => c.id !== customerId);
      let filteredBusinesses = prev.businesses;

      if (
        businessId &&
        !filteredCustomers.some((c) => c.businessId === businessId) &&
        !prev.invoices.some((i) => i.businessId === businessId)
      ) {
        filteredBusinesses = prev.businesses.filter((b) => b.id !== businessId);
      }

      return {
        ...prev,
        customers: filteredCustomers,
        businesses: filteredBusinesses
      };
    });

    showToast('Client deleted.');

    // API delete
    try {
      await businessCustomerApi.deleteCustomer(customerId);
    } catch (err) {
      console.error('API delete error:', err);
    }

    return true;
  }, [state.invoices, state.customers, showToast]);

  // Invoice Generator Actions
  const createInvoice = useCallback((invoiceData) => {
    // Check duplicate: same business, customer, month, year
    const duplicate = state.invoices.find(
      (x) =>
        x.businessId === invoiceData.businessId &&
        x.customerId === invoiceData.customerId &&
        x.month === invoiceData.month &&
        String(x.year) === String(invoiceData.year)
    );

    if (duplicate) {
      return { duplicate: true };
    }

    const business = getBusiness(invoiceData.businessId);
    const newNo = nextInvoiceNo(invoiceData.businessId, business, state.invoices);
    const tempId = uid('inv');

    const newInvoice = {
      ...invoiceData,
      id: tempId,
      invoiceNo: newNo,
      paid: 0,
      balance: invoiceData.total,
      status: 'Unpaid',
      payments: []
    };

    setState((prev) => ({
      ...prev,
      invoices: [newInvoice, ...prev.invoices]
    }));

    // Dispatch async creation to PostgreSQL backend
    invoiceApi.create({
      ...invoiceData,
      invoiceNo: newNo
    }).then((res) => {
      if (res && res.invoice) {
        setState((prev) => ({
          ...prev,
          invoices: prev.invoices.map((inv) => (inv.id === tempId ? res.invoice : inv))
        }));
      }
    }).catch((err) => {
      console.error('Invoice create API error:', err);
    });

    return { success: true, invoice: newInvoice };
  }, [state.invoices, getBusiness]);

  // Payments & Reversals Actions
  const markInvoicePaid = useCallback((invoiceId) => {
    let updatedInvoice = null;

    setState((prev) => {
      const inv = prev.invoices.find((i) => i.id === invoiceId);
      if (!inv) return prev;

      if (inv.balance <= 0) {
        updatedInvoice = inv;
        return prev;
      }

      const nowTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const receivedBy = prev.session?.username || prev.settings?.admin || 'pps';
      const itemTitle = inv.items?.[0]?.name || `Monthly Fee - ${inv.month} ${inv.year}`;

      const payment = {
        id: uid('p'),
        amount: inv.balance,
        method: 'Cash',
        date: today(),
        time: nowTime,
        receivedBy,
        title: itemTitle,
        lateFee: inv.lateFee || inv.additional || 0,
        discount: inv.discount || 0,
        status: 'Paid',
        kind: 'full'
      };

      const updated = {
        ...inv,
        paid: inv.total,
        balance: 0,
        status: 'Paid',
        payments: [...(inv.payments || []), payment]
      };

      updatedInvoice = updated;

      return {
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === invoiceId ? updated : i))
      };
    });

    // Background sync to backend
    invoiceApi.markPaid(invoiceId, {
      receivedBy: state.session?.username || state.settings?.admin || 'Admin'
    }).catch((err) => console.error('API Error marking paid:', err));

    showToast('Invoice Paid — download complete.');
    return updatedInvoice;
  }, [state.session, state.settings, showToast]);

  const takePartialPayment = useCallback((invoiceId, { amount, method, date }) => {
    let updatedInvoice = null;

    setState((prev) => {
      const inv = prev.invoices.find((i) => i.id === invoiceId);
      if (!inv) return prev;

      const pAmount = Number(amount || 0);
      if (pAmount <= 0 || pAmount > inv.balance) return prev;

      const nowTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const receivedBy = prev.session?.username || prev.settings?.admin || 'pps';
      const itemTitle = inv.items?.[0]?.name || `Monthly Fee - ${inv.month} ${inv.year}`;

      const payment = {
        id: uid('p'),
        amount: pAmount,
        method: method || 'Cash',
        date: date || today(),
        time: nowTime,
        receivedBy,
        title: itemTitle,
        lateFee: 0,
        discount: 0,
        status: 'Partial',
        kind: 'partial'
      };

      const updatedPayments = [...(inv.payments || []), payment];
      const newPaid = updatedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const newBalance = Math.max(0, inv.total - newPaid);
      const newStatus = newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid';

      const updated = {
        ...inv,
        paid: newPaid,
        balance: newBalance,
        status: newStatus,
        payments: updatedPayments
      };

      updatedInvoice = updated;

      return {
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === invoiceId ? updated : i))
      };
    });

    // Background sync to backend
    invoiceApi.partialPayment(invoiceId, {
      amount,
      method,
      date,
      receivedBy: state.session?.username || state.settings?.admin || 'Admin'
    }).catch((err) => console.error('API Error recording partial payment:', err));

    if (updatedInvoice) {
      showToast('Partial payment saved & invoice downloaded.');
    }
    return updatedInvoice;
  }, [state.session, state.settings, showToast]);

  const reversePayment = useCallback((invoiceId) => {
    let reversedItem = null;

    setState((prev) => {
      const inv = prev.invoices.find((i) => i.id === invoiceId);
      if (!inv || !inv.payments || inv.payments.length === 0) return prev;

      const paymentsCopy = [...inv.payments];
      const reversedPayment = paymentsCopy.pop();

      const newPaid = paymentsCopy.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const newBalance = Math.max(0, inv.total - newPaid);
      const newStatus = newPaid <= 0 ? 'Unpaid' : newBalance <= 0 ? 'Paid' : 'Partial';

      const reversalRecord = {
        id: uid('rev'),
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        businessId: inv.businessId,
        customerId: inv.customerId,
        amount: Number(reversedPayment.amount || 0),
        method: reversedPayment.method || '-',
        paymentDate: reversedPayment.date || '',
        reversedAt: new Date().toLocaleString()
      };

      reversedItem = reversalRecord;

      return {
        ...prev,
        invoices: prev.invoices.map((i) =>
          i.id === invoiceId
            ? {
                ...i,
                paid: newPaid,
                balance: newBalance,
                status: newStatus,
                payments: paymentsCopy
              }
            : i
        ),
        reversals: [reversalRecord, ...(prev.reversals || [])]
      };
    });

    // Background sync to backend
    invoiceApi.reversePayment(invoiceId).catch((err) => console.error('API Error reversing payment:', err));

    if (reversedItem) {
      const cur = getCurrency(reversedItem.businessId);
      showToast(`Payment reversed: ${money(reversedItem.amount, cur)}`);
    }

    return reversedItem;
  }, [getCurrency, showToast]);

  // Settings Actions
  const updateSettings = useCallback(async (newSettings) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings
      },
      session: {
        ...prev.session,
        username: newSettings.admin || prev.session.username
      }
    }));
    showToast('Settings saved.');

    try {
      await settingsApi.update(newSettings);
    } catch (err) {
      console.error('API Error updating settings:', err);
    }
  }, [showToast]);

  // Data & Backup Actions
  const backupData = useCallback(async () => {
    try {
      let dataToDownload = state;
      try {
        const remoteBackup = await settingsApi.backup();
        if (remoteBackup) dataToDownload = remoteBackup;
      } catch (e) {
        // use local state
      }

      const dataBlob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'invoice-manager-backup.json';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 300);
      showToast('Backup downloaded.');
    } catch (err) {
      console.error('Backup error:', err);
    }
  }, [state, showToast]);

  const restoreData = useCallback(async (restoredJson) => {
    try {
      if (
        !restoredJson ||
        !restoredJson.settings ||
        !Array.isArray(restoredJson.businesses) ||
        !Array.isArray(restoredJson.customers) ||
        !Array.isArray(restoredJson.invoices)
      ) {
        throw new Error('Invalid data structure');
      }

      const validatedState = {
        session: {
          isAuthenticated: Boolean(restoredJson.session?.isAuthenticated),
          username: restoredJson.session?.username || restoredJson.settings?.admin || 'Admin'
        },
        settings: {
          admin: restoredJson.settings.admin || 'Admin',
          currency: restoredJson.settings.currency || 'PKR',
          dueDays: restoredJson.settings.dueDays ?? 0,
          footerNote: restoredJson.settings.footerNote ?? 'Thank you for your business.'
        },
        businesses: restoredJson.businesses,
        customers: restoredJson.customers,
        invoices: restoredJson.invoices,
        reversals: Array.isArray(restoredJson.reversals) ? restoredJson.reversals : []
      };

      setState(validatedState);

      // Sync to PostgreSQL backend
      await settingsApi.restore(validatedState);
      clearClientApiCache();
      showToast('Backup restored to PostgreSQL.');
      return true;
    } catch (err) {
      alert('Invalid backup file or restore failed.');
      return false;
    }
  }, [showToast]);

  const clearAllData = useCallback(async () => {
    if (!confirm('Delete ALL data from database and prototype?')) return;
    setState((prev) => ({
      ...DEFAULT_STATE,
      session: prev.session,
      settings: {
        ...DEFAULT_STATE.settings,
        admin: prev.settings?.admin || DEFAULT_STATE.settings.admin,
        password: prev.settings?.password || DEFAULT_STATE.settings.password
      }
    }));
    showToast('All data cleared.');
    try {
      await settingsApi.reset();
      clearClientApiCache();
    } catch (err) {
      console.error('API Error resetting data:', err);
    }
  }, [showToast]);

  const value = {
    state,
    currentPage,
    setCurrentPage,
    settingsTab,
    setSettingsTab,
    isAdminModalOpen,
    setIsAdminModalOpen,
    previewInvoice,
    setPreviewInvoice,
    toast,
    showToast,
    isDbConnected,
    refreshFromBackend,
    getBusiness,
    getCustomer,
    getBusinessName,
    getCustomerName,
    getCurrency,
    formatMoney,
    login,
    logout,
    addBusinessAndCustomer,
    updateBusinessAndCustomer,
    deleteCustomerRecord,
    createInvoice,
    markInvoicePaid,
    takePartialPayment,
    reversePayment,
    updateSettings,
    backupData,
    restoreData,
    clearAllData
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
