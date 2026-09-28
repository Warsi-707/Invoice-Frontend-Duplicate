const STORAGE_KEY = 'mb_invoice_prototype_v8';

export const DEFAULT_STATE = {
  session: {
    isAuthenticated: false,
    username: 'Admin'
  },
  settings: {
    admin: 'Admin',
    currency: 'PKR',
    dueDays: 0,
    footerNote: 'Thank you for your business.',
    proposalData: {},
    whatsappSettings: {
      initialDelay: 2,
      messageDelay: 3
    }
  },
  businesses: [],
  customers: [],
  invoices: [],
  reversals: []
};

export function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STATE };

    const hasToken = Boolean(localStorage.getItem('invoice_manager_jwt'));

    return {
      session: {
        isAuthenticated: Boolean(parsed.session?.isAuthenticated && hasToken),
        username: parsed.session?.username || parsed.settings?.admin || 'Admin'
      },
      settings: {
        admin: parsed.settings?.admin || 'Admin',
        currency: parsed.settings?.currency || 'PKR',
        dueDays: parsed.settings?.dueDays ?? 0,
        footerNote: parsed.settings?.footerNote ?? 'Thank you for your business.',
        proposalData: parsed.settings?.proposalData || {},
        whatsappSettings: parsed.settings?.whatsappSettings || { initialDelay: 2, messageDelay: 3 }
      },
      businesses: Array.isArray(parsed.businesses) ? parsed.businesses : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      reversals: Array.isArray(parsed.reversals) ? parsed.reversals : []
    };
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return { ...DEFAULT_STATE };
  }
}

export function saveStoredState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}
