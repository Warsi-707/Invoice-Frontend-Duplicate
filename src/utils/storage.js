const STORAGE_KEY = 'mb_invoice_prototype_v8';

export const DEFAULT_SERVICES = [
  { id: 'srv-1', name: 'Website Design & Development', category: 'Web Development', price: 0, unit: 'Project', desc: 'Custom responsive website with modern UI/UX and full mobile optimization.' },
  { id: 'srv-2', name: 'Custom Web Application & ERP', category: 'Software', price: 0, unit: 'Project', desc: 'Full-stack software development with database, authentication and reporting.' },
  { id: 'srv-3', name: 'Monthly Cloud Server & Maintenance', category: 'Maintenance', price: 0, unit: 'Month', desc: '24/7 server monitoring, performance optimization, and regular backups.' },
  { id: 'srv-4', name: 'UI / UX Design & Prototyping', category: 'Design', price: 0, unit: 'Project', desc: 'Figma wireframes, design system, interactive prototypes and visual assets.' },
  { id: 'srv-5', name: 'WhatsApp Automation & Billing API', category: 'Automation', price: 0, unit: 'Service', desc: 'Automated WhatsApp invoice dispatch, notifications and instant alerts.' },
  { id: 'srv-6', name: 'Search Engine Optimization (SEO)', category: 'Marketing', price: 0, unit: 'Month', desc: 'On-page SEO, keyword targeting, Google business ranking & speed optimization.' }
];

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
    },
    services: DEFAULT_SERVICES
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
        whatsappSettings: parsed.settings?.whatsappSettings || { initialDelay: 2, messageDelay: 3 },
        services: Array.isArray(parsed.settings?.services) && parsed.settings.services.length > 0
          ? parsed.settings.services
          : DEFAULT_SERVICES
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
