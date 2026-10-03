import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Button from '../components/common/Button';
import WhatsAppScannerCard from '../components/whatsapp/WhatsAppScannerCard';
import ProposalPreviewModal from '../components/proposal/ProposalPreviewModal';
import { downloadProposalFile } from '../utils/proposal';
import { generateInvoiceHtml } from '../utils/invoice';
import { money, today, cleanPhoneInput } from '../utils/formatters';
import { DEFAULT_SERVICES } from '../utils/storage';

const PRESET_TERMS = {
  preset1: `1. Validity: This commercial quotation is valid for 14 calendar days from the date of issuance.
2. Payment Terms: 40% advance milestone on contract signing, 30% on beta milestone preview, and 30% upon final delivery & handover.
3. Taxes: Quoted prices are in Pakistani Rupees (PKR) and exclusive of applicable provincial sales tax (GST/PST) unless explicitly itemized.
4. Support & Warranty: 3 months of complimentary technical bug-fixing and cloud maintenance support is included post-launch.
5. Intellectual Property: Complete source code ownership and database rights will be transferred upon settlement of final invoice.`,

  preset2: `1. Validity: This proposal is valid for 30 calendar days from the date of issuance.
2. Payment Terms: 100% Monthly retainer billed in advance at the start of each service cycle.
3. SLA Commitments: 99.9% Cloud Uptime, 2-Hour critical response time, and 24/7 automated monitoring.
4. Scope: Covers continuous feature updates, security patches, daily automated backups, and server maintenance.
5. Termination: Either party may terminate the SLA by providing 30 days written notice.`,

  preset3: `1. Validity: Quoted hardware and license rates are valid for 7 calendar days due to market currency fluctuations.
2. Payment Terms: 100% advance payment required against official Purchase Order (PO).
3. Delivery: Delivery lead time is 3-5 working days from payment confirmation.
4. Warranty: Standard 1-Year official manufacturer warranty against defects.
5. Returns: Opened software license keys and activated hardware units are non-refundable.`
};

export default function SettingsPage() {
  const {
    state,
    updateSettings,
    backupData,
    restoreData,
    clearAllData,
    showToast,
    getBusiness,
    getCustomer,
    settingsTab,
    setSettingsTab
  } = useApp();

  const fileInputRef = useRef(null);
  const activeTab = settingsTab === 'proposal' ? 'proposal' : settingsTab === 'invoice' ? 'invoice' : settingsTab === 'services' ? 'services' : 'org';

  // Services Catalog State
  const [servicesList, setServicesList] = useState(
    Array.isArray(state.settings?.services) && state.settings.services.length > 0
      ? state.settings.services
      : DEFAULT_SERVICES
  );
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState('Project');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // Tab 01: Organization Identity State
  const [adminUser, setAdminUser] = useState(state.settings?.admin || 'Administrator');
  const [adminPass, setAdminPass] = useState(state.settings?.password || 'admin123');

  // Tab 02: Proposal & Letterhead State
  const savedProp = state.settings?.proposalData || {};
  const [companyName, setCompanyName] = useState(savedProp.companyName || '');
  const [tagline, setTagline] = useState(savedProp.tagline || '');
  const [officeAddress, setOfficeAddress] = useState(savedProp.officeAddress || '');
  const [ntnTax, setNtnTax] = useState(savedProp.ntnTax || '');
  const [supportPhone, setSupportPhone] = useState(savedProp.supportPhone || '');
  const [inquiryEmail, setInquiryEmail] = useState(savedProp.inquiryEmail || '');
  const [websiteUrl, setWebsiteUrl] = useState(savedProp.websiteUrl || '');
  const [signatoryName, setSignatoryName] = useState(savedProp.signatoryName || '');
  const [signatoryTitle, setSignatoryTitle] = useState(savedProp.signatoryTitle || '');
  const [validityDays, setValidityDays] = useState(savedProp.validityDays || 14);
  const [propTerms, setPropTerms] = useState(savedProp.terms || '');
  const [showA4Preview, setShowA4Preview] = useState(true);
  const [showInvoicePreview, setShowInvoicePreview] = useState(true);

  // Tab 03: Invoice Settings State
  const [currency, setCurrency] = useState(state.settings?.currency || 'PKR');
  const [dueDays, setDueDays] = useState(state.settings?.dueDays ?? 0);
  const [footerNote, setFooterNote] = useState(state.settings?.footerNote || 'Thank you for your business.');
  const [bankName, setBankName] = useState(savedProp.bankName || '');
  const [accountTitle, setAccountTitle] = useState(savedProp.accountTitle || '');
  const [accountIban, setAccountIban] = useState(savedProp.accountIban || '');
  const [invoicePrefix, setInvoicePrefix] = useState(savedProp.invoicePrefix || 'INV-');

  // Proposal Dynamic Form Preview State
  const [propTitle, setPropTitle] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customClientName, setCustomClientName] = useState('');
  const [customClientCompany, setCustomClientCompany] = useState('');
  const [propDate, setPropDate] = useState(today());
  const [propDiscount, setPropDiscount] = useState(0);
  const [propTaxPct, setPropTaxPct] = useState(0);

  // Proposal Line Items
  const [propItems, setPropItems] = useState([
    { id: 'item-1', name: '', desc: '', type: 'Service', qty: 1, price: '' }
  ]);

  // Sample live invoice preview for Module 03
  const sampleInvoiceHtml = useMemo(() => {
    return generateInvoiceHtml(
      {
        invoiceNo: `${invoicePrefix || 'INV-'}2026-0001`,
        date: today(),
        dueDate: today(),
        month: 'September',
        year: 2026,
        subtotal: 50000,
        total: 50000,
        paid: 0,
        balance: 50000,
        status: 'Unpaid',
        currency: currency,
        notes: footerNote,
        items: [
          { name: 'Monthly Software & Cloud Infrastructure Maintenance', qty: 1, price: 50000, amount: 50000 }
        ]
      },
      {
        name: companyName || 'iSysware Software Solution',
        currency: currency,
        proposalData: {
          companyName: companyName || 'iSysware Software Solution',
          tagline: tagline || 'ERP • Custom Software • Web • AI Solutions',
          supportPhone: supportPhone || '+92 314 8843707',
          inquiryEmail: inquiryEmail || 'info@isysware.com',
          websiteUrl: websiteUrl || 'isysware.com',
          bankName: bankName || 'Meezan Bank',
          accountTitle: accountTitle || 'iSysware Software Solution',
          accountIban: accountIban || 'PK36MEZN00012345678901',
          invoicePrefix: invoicePrefix || 'INV-'
        }
      },
      {
        name: 'Prime Horizon Ltd',
        company: 'Prime Horizon Ltd',
        phone: '+92 300 1234567',
        address: 'Suite 402, Business Avenue, Karachi'
      }
    );
  }, [invoicePrefix, currency, footerNote, companyName, tagline, supportPhone, inquiryEmail, websiteUrl, bankName, accountTitle, accountIban]);

  // Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    setAdminUser(state.settings?.admin || 'Administrator');
    setAdminPass(state.settings?.password || 'admin123');
    setCurrency(state.settings?.currency || 'PKR');
    setDueDays(state.settings?.dueDays ?? 0);
    setFooterNote(state.settings?.footerNote || 'Thank you for your business.');

    const p = state.settings?.proposalData;
    if (p) {
      if (p.companyName !== undefined) setCompanyName(p.companyName);
      if (p.tagline !== undefined) setTagline(p.tagline);
      if (p.officeAddress !== undefined) setOfficeAddress(p.officeAddress);
      if (p.ntnTax !== undefined) setNtnTax(p.ntnTax);
      if (p.supportPhone !== undefined) setSupportPhone(p.supportPhone);
      if (p.inquiryEmail !== undefined) setInquiryEmail(p.inquiryEmail);
      if (p.websiteUrl !== undefined) setWebsiteUrl(p.websiteUrl);
      if (p.signatoryName !== undefined) setSignatoryName(p.signatoryName);
      if (p.signatoryTitle !== undefined) setSignatoryTitle(p.signatoryTitle);
      if (p.validityDays !== undefined) setValidityDays(p.validityDays);
      if (p.terms !== undefined) setPropTerms(p.terms);
      if (p.bankName !== undefined) setBankName(p.bankName);
      if (p.accountTitle !== undefined) setAccountTitle(p.accountTitle);
      if (p.accountIban !== undefined) setAccountIban(p.accountIban);
      if (p.invoicePrefix !== undefined) setInvoicePrefix(p.invoicePrefix);
    }

    if (state.settings?.services && Array.isArray(state.settings.services)) {
      setServicesList(state.settings.services);
    }
  }, [state.settings]);

  // Master Save Function
  const handleSaveAllSettings = (e) => {
    e?.preventDefault();

    const proposalDataPayload = {
      companyName: companyName.trim(),
      tagline: tagline.trim(),
      officeAddress: officeAddress.trim(),
      ntnTax: ntnTax.trim(),
      supportPhone: supportPhone.trim(),
      inquiryEmail: inquiryEmail.trim(),
      websiteUrl: websiteUrl.trim(),
      signatoryName: signatoryName.trim(),
      signatoryTitle: signatoryTitle.trim(),
      validityDays: Number(validityDays || 14),
      terms: propTerms,
      bankName: bankName.trim(),
      accountTitle: accountTitle.trim(),
      accountIban: accountIban.trim(),
      invoicePrefix: invoicePrefix.trim() || 'INV-'
    };

    updateSettings({
      admin: adminUser.trim() || 'Administrator',
      password: adminPass.trim() || 'admin123',
      currency,
      dueDays: Math.max(0, Number(dueDays || 0)),
      footerNote: footerNote.trim(),
      proposalData: proposalDataPayload,
      whatsappSettings: state.settings?.whatsappSettings || { initialDelay: 2, messageDelay: 3 },
      services: servicesList
    });

    showToast('✅ Settings saved successfully.');
  };

  // Service Catalog Actions
  const handleAddService = (e) => {
    e?.preventDefault();
    if (!newServiceName.trim()) {
      showToast('⚠️ Please enter service name / title.');
      return;
    }

    const newServiceObj = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: newServiceName.trim(),
      category: newServiceCategory.trim() || 'General Service',
      price: newServicePrice !== '' ? Number(newServicePrice) : 0,
      unit: newServiceUnit.trim() || 'Project',
      desc: newServiceDesc.trim()
    };

    const updated = [newServiceObj, ...servicesList];
    setServicesList(updated);
    setNewServiceName('');
    setNewServiceCategory('');
    setNewServicePrice('');
    setNewServiceDesc('');

    updateSettings({
      ...state.settings,
      services: updated
    });

    showToast(`✅ Service "${newServiceObj.name}" added to catalog.`);
  };

  const handleUpdateService = (index, field, value) => {
    const updated = [...servicesList];
    updated[index] = { ...updated[index], [field]: value };
    setServicesList(updated);
  };

  const handleDeleteService = (index) => {
    const srv = servicesList[index];
    if (confirm(`Remove service "${srv?.name || 'Service'}" from catalog?`)) {
      const updated = servicesList.filter((_, idx) => idx !== index);
      setServicesList(updated);
      updateSettings({
        ...state.settings,
        services: updated
      });
      showToast('🗑️ Service removed from catalog.');
    }
  };

  const handleResetDefaultServices = () => {
    if (confirm('Restore standard default services catalog?')) {
      setServicesList(DEFAULT_SERVICES);
      updateSettings({
        ...state.settings,
        services: DEFAULT_SERVICES
      });
      showToast('✅ Restored default services catalog.');
    }
  };

  // Filtered services for search
  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return servicesList;
    const query = serviceSearch.toLowerCase().trim();
    return servicesList.filter(s =>
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.category && s.category.toLowerCase().includes(query)) ||
      (s.desc && s.desc.toLowerCase().includes(query))
    );
  }, [servicesList, serviceSearch]);

  // Proposal Item Handlers
  const handleAddItem = () => {
    setPropItems([
      ...propItems,
      { id: `prop-item-${Date.now()}`, name: '', desc: '', type: 'Service', qty: 1, price: 0 }
    ]);
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...propItems];
    updated[index] = { ...updated[index], [field]: value };
    setPropItems(updated);
  };

  const handleRemoveItem = (index) => {
    setPropItems(propItems.filter((_, idx) => idx !== index));
  };

  // Calculate Proposal Totals
  const propSubtotal = propItems.reduce((acc, it) => acc + (Number(it.qty || 1) * Number(it.price || 0)), 0);
  const propTaxAmount = ((propSubtotal - Number(propDiscount || 0)) * Number(propTaxPct || 0)) / 100;
  const propGrandTotal = Math.max(0, propSubtotal - Number(propDiscount || 0) + propTaxAmount);

  // Selected Client
  const selectedCust = getCustomer(selectedCustomerId) || {};
  const currentClientName = selectedCust.name || customClientName || 'Al-Falah Textiles Ltd';
  const currentClientCompany = selectedCust.businessId ? (getBusiness(selectedCust.businessId)?.name || customClientCompany) : customClientCompany;

  // Assembled Proposal Object
  const currentProposalObject = {
    title: propTitle.trim() || 'Enterprise Software Solution Proposal',
    proposalNo: `PROP-${new Date().getFullYear()}-0042`,
    date: propDate,
    validity: `${validityDays} Days`,
    validityDays: Number(validityDays || 14),
    summary: 'Commercial proposal for enterprise software deployment and automated billing solutions.',
    items: propItems,
    subtotal: propSubtotal,
    discount: Number(propDiscount || 0),
    taxPct: Number(propTaxPct || 0),
    taxAmount: propTaxAmount,
    total: propGrandTotal,
    terms: propTerms,
    companyName: companyName.trim(),
    tagline: tagline.trim(),
    officeAddress: officeAddress.trim(),
    ntnTax: ntnTax.trim(),
    supportPhone: supportPhone.trim(),
    inquiryEmail: inquiryEmail.trim(),
    websiteUrl: websiteUrl.trim(),
    signatoryName: signatoryName.trim(),
    signatoryTitle: signatoryTitle.trim(),
    clientName: currentClientName,
    clientCompany: currentClientCompany
  };

  const handlePreviewProposal = () => {
    setIsPreviewOpen(true);
  };

  const handleDownloadProposal = async () => {
    try {
      showToast('⏳ Generating PDF...');
      await downloadProposalFile(currentProposalObject, { currency }, selectedCust);
      showToast('✅ Proposal PDF downloaded.');
    } catch (err) {
      showToast('❌ Failed to download PDF: ' + err.message);
    }
  };

  // Restore handler
  const handleRestoreFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        restoreData(parsed);
      } catch (err) {
        alert('Invalid JSON file.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Stats
  const businessCount = state.businesses.length;
  const customerCount = state.customers.length;
  const invoiceCount = state.invoices.length;
  const paymentCount = state.invoices.reduce((acc, inv) => acc + (inv.payments?.length || 0), 0);
  const reversalCount = (state.reversals || []).length;

  return (
    <section id="settings" className="page active">
      {/* Settings Module Navigation Segmented Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'org', label: 'Organization & Admin' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSettingsTab(tab.id)}
              style={{
                padding: '6px 16px',
                fontSize: '12.5px',
                fontWeight: isActive ? '700' : '500',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: isActive ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                background: isActive ? '#f0f9ff' : '#ffffff',
                color: isActive ? '#0284c7' : '#475569',
                boxShadow: 'none'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dynamic Header for Selected Module */}
      <div className="settings-header-top" style={{ marginBottom: '20px' }}>
        <div className="settings-header-title" style={{ width: '100%' }}>
          {activeTab === 'org' && (
            <>
              <h2>
                <span>Organization Identity & System Details</span>
              </h2>
              <p>Manage administrator security credentials, WhatsApp automatic delivery, and PostgreSQL cloud database.</p>
            </>
          )}

          {activeTab === 'proposal' && (
            <>
              <h2>
                <span>Proposal & Letterhead Configuration</span>
              </h2>
              <p>Configure corporate profile, A4 letterhead designer, preset commercial terms, and official signatures.</p>
            </>
          )}

          {activeTab === 'invoice' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>
                  <span>Invoice Settings &amp; Live Template Preview</span>
                </h2>
                <p>Configure default billing currency, payment due days, invoice prefix, footer terms, and banking credentials.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button
                  variant="light"
                  size="sm"
                  onClick={() => setShowInvoicePreview(!showInvoicePreview)}
                >
                  {showInvoicePreview ? 'Hide Preview' : 'View Preview'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAllSettings}
                >
                  Save Invoice Settings
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>
                  <span>Services &amp; Pricing Catalog</span>
                </h2>
                <p>Manage standard services, default deliverable rates, and scope descriptions for 1-click selection in Proposal &amp; Invoice builder.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button
                  variant="light"
                  size="sm"
                  onClick={handleResetDefaultServices}
                >
                  Restore Standard Defaults
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAllSettings}
                >
                  Save Services Catalog
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODULE 01: Organization Identity & System Details (Admin, WhatsApp & DB)
         ========================================================================= */}
      {activeTab === 'org' && (
        <div className="settings-layout">
          {/* Left Column: Admin & System Details */}
          <div className="settings-card">
            <h4>Organization & Admin Security</h4>

            <form onSubmit={handleSaveAllSettings} className="settings-form-grid enter-flow" autoComplete="off">
              <div className="full">
                <label>System Application Name</label>
                <input
                  id="sAppName"
                  className="input"
                  value="Invoice Manager (Multi-Business Billing)"
                  readOnly
                />
              </div>

              <div>
                <label>
                  Admin Username <span className="req">*</span>
                </label>
                <input
                  id="sAdmin"
                  className="input"
                  placeholder="Administrator"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div>
                <label>
                  Admin Login Password <span className="req">*</span>
                </label>
                <input
                  id="sPass"
                  className="input"
                  type="text"
                  placeholder="admin123"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="full settings-save">
                <Button variant="primary" type="submit">
                  Save Security Settings
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column: WhatsApp Delivery + Data & Backup */}
          <div className="settings-right-stack">
            {/* WhatsApp Scanner Card */}
            <WhatsAppScannerCard />

            {/* Data & Backup Card */}
            <div className="settings-card">
              <h4>Neon PostgreSQL Cloud Database</h4>

              <div className="settings-data-note">
                Live cloud database records & synchronization.
              </div>

              <div className="data-summary">
                <div className="data-stat">
                  <span>Businesses</span>
                  <strong>{businessCount}</strong>
                </div>
                <div className="data-stat">
                  <span>Clients</span>
                  <strong>{customerCount}</strong>
                </div>
                <div className="data-stat">
                  <span>Invoices</span>
                  <strong>{invoiceCount}</strong>
                </div>
                <div className="data-stat">
                  <span>Payment Entries</span>
                  <strong>{paymentCount}</strong>
                </div>
                <div className="data-stat">
                  <span>Reversal Records</span>
                  <strong>{reversalCount}</strong>
                </div>
              </div>

              <div className="settings-data-actions" style={{ marginTop: '16px' }}>
                <Button variant="light" onClick={backupData}>
                  Backup JSON Data
                </Button>
                <Button variant="light" onClick={() => fileInputRef.current?.click()}>
                  Restore JSON Data
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden-file"
                  onChange={handleRestoreFileChange}
                />
              </div>

              <div className="data-danger" style={{ marginTop: '18px' }}>
                <Button variant="danger" onClick={clearAllData}>
                  Clear All Data (Reset)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODULE 02: Proposal Letterhead & PDF Builder
         ========================================================================= */}
      {activeTab === 'proposal' && (
        <div>
          {/* Section 1: Corporate Identity & Tax Credentials */}
          <div className="proposal-builder-card">
            <div className="prop-card-header">
              <div>
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b4b8f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <span>Official Corporate Identity &amp; Proposal Credentials</span>
                </h3>
                <p>Manage company heading, registered address, NTN registration, and official signatory stamp for proposal documents.</p>
              </div>
              <div className="prop-btn-group">
                <Button variant="light" size="xs" onClick={() => setShowA4Preview(!showA4Preview)}>
                  {showA4Preview ? 'Hide A4 Preview' : 'Show A4 Preview'}
                </Button>
                <Button variant="primary" size="xs" onClick={handleSaveAllSettings}>
                  Save Proposal Settings
                </Button>
              </div>
            </div>

            <div className="prop-sub-heading">
              <span>OFFICIAL CORPORATE IDENTITY &amp; TAX CREDENTIALS</span>
            </div>

            <div className="prop-form-grid">
              <div>
                <label>Company / Agency Name</label>
                <input
                  className="input"
                  placeholder="e.g. iSysware Software Solution"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div>
                <label>Tagline / Subtitle</label>
                <input
                  className="input"
                  placeholder="e.g. Software Development & Billing Systems"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              <div>
                <label>Official Registered Office Address</label>
                <input
                  className="input"
                  placeholder="e.g. Suite 402, Business Arcade, Main Shahrah-e-Faisal, Karachi"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                />
              </div>

              <div>
                <label>NTN / Tax Registration / STRN</label>
                <input
                  className="input"
                  placeholder="e.g. NTN: 1234567-8 | STRN: 1234567890123"
                  value={ntnTax}
                  onChange={(e) => setNtnTax(e.target.value)}
                />
              </div>

              <div>
                <label>Official Support / Inquiry Phone</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  className="input phone11"
                  placeholder="03001234567"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(cleanPhoneInput(e.target.value))}
                />
              </div>

              <div>
                <label>Proposals &amp; Inquiries Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. info@isysware.com"
                  value={inquiryEmail}
                  onChange={(e) => setInquiryEmail(e.target.value)}
                />
              </div>

              <div>
                <label>Official Website URL</label>
                <input
                  className="input"
                  placeholder="e.g. https://isysware.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Authorized Signatory & Stamp */}
            <div className="prop-sub-heading" style={{ marginTop: '22px' }}>
              <span>✍️ AUTHORIZED SIGNATORY &amp; STAMP</span>
            </div>

            <div className="prop-form-grid">
              <div>
                <label>Signatory Full Name</label>
                <input
                  className="input"
                  placeholder="e.g. Muhammad Ali"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                />
              </div>

              <div>
                <label>Official Designation / Title</label>
                <input
                  className="input"
                  placeholder="e.g. Chief Executive Officer / Managing Director"
                  value={signatoryTitle}
                  onChange={(e) => setSignatoryTitle(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Standard Proposal Validity & Terms & Conditions */}
          <div className="proposal-builder-card">
            <div className="prop-card-header">
              <div>
                <h3>
                  <span>STANDARD PROPOSAL VALIDITY &amp; TERMS &amp; CONDITIONS</span>
                </h3>
                <p>Configure default quotation validity days and legal contract terms.</p>
              </div>
              <div className="preset-btn-group">
                <span style={{ fontSize: '11px', color: '#64748b', marginRight: '4px' }}>Quick Template:</span>
                <button type="button" className="preset-chip-btn" onClick={() => setPropTerms(PRESET_TERMS.preset1)}>
                  Preset 1
                </button>
                <button type="button" className="preset-chip-btn" onClick={() => setPropTerms(PRESET_TERMS.preset2)}>
                  Preset 2
                </button>
                <button type="button" className="preset-chip-btn" onClick={() => setPropTerms(PRESET_TERMS.preset3)}>
                  Preset 3
                </button>
              </div>
            </div>

            <div className="prop-form-grid">
              <div>
                <label>Default Validity (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  className="input"
                  placeholder="14"
                  value={validityDays}
                  onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value || 14)))}
                />
              </div>

              <div className="span-2" style={{ gridColumn: 'span 3' }}>
                <label>Standard Commercial Terms &amp; Conditions (Clauses)</label>
                <textarea
                  className="textarea"
                  rows={5}
                  value={propTerms}
                  onChange={(e) => setPropTerms(e.target.value)}
                  placeholder="Enter custom commercial terms & conditions..."
                  style={{ fontSize: '11.5px', lineHeight: '1.5' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Interactive A4 Proposal Sheet Preview */}
          {showA4Preview && (
            <div className="proposal-builder-card">
              <div className="prop-card-header">
                <div>
                  <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polygon points="12 8 8 12 12 16 12 8"></polygon>
                    </svg>
                    <span>Interactive A4 Proposal Sheet Preview</span>
                  </h3>
                  <p>Shows exact layout generated for clients.</p>
                </div>
                <div className="prop-btn-group">
                  <Button variant="light" size="xs" onClick={handleDownloadProposal}>
                    Download HTML / PDF
                  </Button>
                  <Button variant="primary" size="xs" onClick={handlePreviewProposal}>
                    Fullscreen Preview
                  </Button>
                </div>
              </div>

              {/* Live Embedded A4 Paper Canvas */}
              <div className="embedded-a4-wrapper">
                <div className="embedded-a4-sheet">
                  <div>
                    {/* A4 Sheet Top Header */}
                    <div className="a4-sheet-top">
                      <div className="a4-sheet-brand">
                        <h2>{companyName || 'Company / Agency Name'}</h2>
                        {tagline && <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600', marginBottom: '3px' }}>{tagline}</div>}
                        <p>{officeAddress || 'Registered Office Address'}</p>
                        {ntnTax ? <div className="tax-line">{ntnTax}</div> : <div className="tax-line" style={{ opacity: 0.6 }}>NTN: XXXXXXX-X | STRN: XXXXXXXXXXXXX</div>}
                      </div>
                      <div className="a4-sheet-badge-wrap">
                        <div className="a4-commercial-badge">Commercial Proposal</div>
                        <div className="a4-ref-line">Ref: PROP-2026-0042</div>
                        <div className="a4-valid-line">Valid {validityDays} Days</div>
                      </div>
                    </div>

                    {/* A4 Prepared For / Date Card */}
                    <div className="a4-info-grid">
                      <div className="a4-info-col">
                        <h5>PREPARED FOR:</h5>
                        <p><strong>{currentClientName || 'Client / Business Name'}</strong></p>
                        <p style={{ color: '#475569' }}>{currentClientCompany || 'Client Representative / Designation'}</p>
                      </div>
                      <div className="a4-info-col right">
                        <h5>DATE &amp; CURRENCY:</h5>
                        <p><strong>{propDate}</strong></p>
                        <p style={{ color: '#0369a1' }}>{currency} (Pakistani Rupee)</p>
                      </div>
                    </div>

                    {/* A4 Deliverables Table */}
                    <table className="a4-scope-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60%' }}>Scope Deliverable</th>
                          <th style={{ width: '20%' }}>Type</th>
                          <th style={{ width: '20%', textAlign: 'right' }}>Investment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propItems.length > 0 && propItems.some(it => it.name && it.name.trim()) ? (
                          propItems.filter(it => it.name && it.name.trim()).map((it, idx) => (
                            <tr key={it.id || idx}>
                              <td>
                                <strong>{it.name}</strong>
                                {it.desc && <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>{it.desc}</div>}
                              </td>
                              <td>{it.type || 'Service'}</td>
                              <td style={{ textAlign: 'right', fontWeight: '750' }}>
                                {money((it.qty || 1) * (it.price || 0), currency)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '14px', fontSize: '11px' }}>
                              No deliverables added yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* A4 Bottom Terms & Signatory */}
                  <div>
                    <div className="a4-terms-summary">
                      <strong>Terms Summary:</strong> {propTerms ? (propTerms.length > 240 ? propTerms.slice(0, 240) + '...' : propTerms) : 'Commercial terms & conditions will appear here.'}
                    </div>

                    <div className="a4-footer-row">
                      <div>
                        {[inquiryEmail, supportPhone].filter(Boolean).join(' • ') || 'Contact Details'}
                      </div>
                      <div className="a4-signatory-col">
                        <div className="a4-signatory-name">{signatoryName || 'Authorized Signatory'}</div>
                        <div className="a4-signatory-title">{signatoryTitle || 'Management Representative'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="prop-actions-bar" style={{ marginTop: '16px' }}>
                <div className="prop-btn-group">
                  <Button variant="primary" onClick={handlePreviewProposal}>
                    Fullscreen A4 Preview
                  </Button>
                  <Button variant="light" onClick={handleDownloadProposal}>
                    Download A4 Proposal
                  </Button>
                  <Button
                    variant="green"
                    onClick={handlePreviewProposal}
                    style={{ background: '#10b981', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Send via WhatsApp</span>
                  </Button>
                </div>
                <div>
                  <Button variant="primary" onClick={handleSaveAllSettings}>
                    Save Proposal Settings
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODULE 03: Invoice Settings & Global Defaults
         ========================================================================= */}
      {activeTab === 'invoice' && (
        <div>
          <div className="settings-layout">
          {/* Left Column: General Invoice Defaults */}
          <div className="settings-card">
            <h4>Invoice &amp; Billing Defaults</h4>

            <form onSubmit={handleSaveAllSettings} className="settings-form-grid enter-flow" autoComplete="off">
              <div>
                <label>Default Currency</label>
                <select
                  id="sCur"
                  className="select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="PKR">PKR (Pakistani Rupee)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                  <option value="SAR">SAR (Saudi Riyal)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>

              <div>
                <label>Default Payment Due Days</label>
                <input
                  id="sDueDays"
                  className="input"
                  type="number"
                  min="0"
                  max="365"
                  placeholder="0"
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                  autoComplete="off"
                />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                  0 = Due on receipt / same day.
                </div>
              </div>

              <div className="full">
                <label>Invoice Number Prefix</label>
                <input
                  className="input"
                  placeholder="e.g. INV-"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                />
              </div>

              <div className="full">
                <label>Standard Invoice Footer Note &amp; Terms</label>
                <textarea
                  id="sFooterNote"
                  className="textarea"
                  rows={4}
                  placeholder="Thank you for your business. Please clear invoice within due date."
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </form>
          </div>

          {/* Right Column: Bank Details & Payment Instructions */}
          <div className="settings-card">
            <h4>Bank &amp; Payment Details (For Invoices)</h4>
            <div className="settings-data-note">
              These details appear on invoices and customer payment reminders.
            </div>

            <form onSubmit={handleSaveAllSettings} className="settings-form-grid enter-flow" autoComplete="off">
              <div className="full">
                <label>Bank Name</label>
                <input
                  className="input"
                  placeholder="e.g. Meezan Bank / HBL / Bank Alfalah"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div className="full">
                <label>Account Title</label>
                <input
                  className="input"
                  placeholder="e.g. iSysware Software Solution"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                />
              </div>

              <div className="full">
                <label>Account Number / IBAN</label>
                <input
                  className="input"
                  placeholder="e.g. PK36MEZN00012345678901"
                  value={accountIban}
                  onChange={(e) => setAccountIban(e.target.value)}
                />
              </div>
            </form>
          </div>
        </div>

        {/* Live Invoice Preview Section right below the details */}
        {showInvoicePreview && (
          <div className="settings-card" style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Live Invoice Template Preview</h4>
              <div className="settings-data-note" style={{ marginTop: '4px' }}>
                Real-time preview of how invoices look with current prefix, currency, footer notes, and bank credentials.
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              padding: '24px',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'center',
              overflowX: 'auto',
              border: '1px solid #e2e8f0'
            }}>
              <div
                style={{
                  background: '#ffffff',
                  boxShadow: 'none',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  width: '750px',
                  maxWidth: '100%',
                  overflow: 'hidden'
                }}
                dangerouslySetInnerHTML={{ __html: sampleInvoiceHtml }}
              />
            </div>
          </div>
        )}
      </div>
    )}

      {/* =========================================================================
          MODULE 04: Services Catalog & Pricing Configuration
         ========================================================================= */}
      {activeTab === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Add New Service Form Card */}
          <div className="settings-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b4b8f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                  <span>Add New Service to Catalog</span>
                </h4>
                <div className="settings-data-note" style={{ marginTop: '2px' }}>
                  Define standard service rates, billing units, and scope descriptions for quick 1-click selection in Proposals &amp; Invoices.
                </div>
              </div>
            </div>

            <form onSubmit={handleAddService} className="settings-form-grid enter-flow" autoComplete="off">
              <div>
                <label>
                  Service Title / Name <span className="req">*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. E-Commerce Website Development"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div>
                <label>Service Category</label>
                <input
                  className="input"
                  placeholder="e.g. Web Development / Software / SEO / Design"
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div>
                <label>Default Unit Price ({currency})</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="0"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div>
                <label>Billing Unit / Frequency</label>
                <select
                  className="select"
                  value={newServiceUnit}
                  onChange={(e) => setNewServiceUnit(e.target.value)}
                >
                  <option value="Project">Per Project</option>
                  <option value="Month">Per Month</option>
                  <option value="Hour">Per Hour</option>
                  <option value="Milestone">Per Milestone</option>
                  <option value="Item">Per Item / Unit</option>
                  <option value="One-time">One-time Fee</option>
                </select>
              </div>

              <div className="full">
                <label>Deliverable Scope / Default Description (Optional)</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="e.g. Complete custom responsive web application with responsive UI, payment gateway, and administrative dashboard."
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  style={{ fontSize: '12px' }}
                />
              </div>

              <div className="full" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <Button variant="primary" type="submit">
                  + Add Service to Catalog
                </Button>
              </div>
            </form>
          </div>

          {/* Section 2: Configured Services Table & Management */}
          <div className="settings-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Configured Services Catalog</span>
                  <span style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: '700'
                  }}>
                    {filteredServices.length} {filteredServices.length === 1 ? 'Service' : 'Services'}
                  </span>
                </h4>
                <div className="settings-data-note" style={{ marginTop: '2px' }}>
                  These services will appear in dropdowns across Commercial Proposal Builder and Invoice Generator.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="🔍 Search services..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  style={{ height: '32px', width: '200px', fontSize: '12px' }}
                />
                <Button variant="light" size="sm" onClick={handleResetDefaultServices}>
                  Reset Defaults
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveAllSettings}>
                  Save Changes
                </Button>
              </div>
            </div>

            {filteredServices.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '36px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1'
              }}>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 10px' }}>
                  {serviceSearch ? 'No services matched your search query.' : 'No services in catalog yet.'}
                </p>
                <Button variant="light" size="sm" onClick={handleResetDefaultServices}>
                  Load Recommended Default Services
                </Button>
              </div>
            ) : (
              <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ width: '36px', textAlign: 'center', padding: '10px 8px', fontSize: '11px' }}>#</th>
                      <th style={{ width: '28%', textAlign: 'left', padding: '10px 8px', fontSize: '11px' }}>Service Name</th>
                      <th style={{ width: '18%', textAlign: 'left', padding: '10px 8px', fontSize: '11px' }}>Category</th>
                      <th style={{ width: '15%', textAlign: 'right', padding: '10px 8px', fontSize: '11px' }}>Default Price ({currency})</th>
                      <th style={{ width: '12%', textAlign: 'center', padding: '10px 8px', fontSize: '11px' }}>Billing Unit</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '11px' }}>Default Scope / Description</th>
                      <th style={{ width: '45px', textAlign: 'center', padding: '10px 8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((srv, idx) => {
                      const originalIdx = servicesList.findIndex(s => s.id === srv.id);
                      const targetIdx = originalIdx >= 0 ? originalIdx : idx;

                      return (
                        <tr key={srv.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ textAlign: 'center', color: '#64748b', fontSize: '11px', padding: '8px' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              className="input"
                              value={srv.name || ''}
                              placeholder="Service title"
                              onChange={(e) => handleUpdateService(targetIdx, 'name', e.target.value)}
                              style={{ height: '30px', fontSize: '12px', fontWeight: '600' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              className="input"
                              value={srv.category || ''}
                              placeholder="Category"
                              onChange={(e) => handleUpdateService(targetIdx, 'category', e.target.value)}
                              style={{ height: '30px', fontSize: '12px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="0"
                              className="input"
                              value={srv.price !== undefined ? srv.price : ''}
                              placeholder="0"
                              onChange={(e) => handleUpdateService(targetIdx, 'price', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                              style={{ height: '30px', fontSize: '12px', textAlign: 'right', fontWeight: '700' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              className="select"
                              value={srv.unit || 'Project'}
                              onChange={(e) => handleUpdateService(targetIdx, 'unit', e.target.value)}
                              style={{ height: '30px', fontSize: '11.5px', padding: '2px 6px' }}
                            >
                              <option value="Project">Project</option>
                              <option value="Month">Month</option>
                              <option value="Hour">Hour</option>
                              <option value="Milestone">Milestone</option>
                              <option value="Item">Item</option>
                              <option value="One-time">One-time</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              className="input"
                              value={srv.desc || ''}
                              placeholder="Default scope or feature description"
                              onChange={(e) => handleUpdateService(targetIdx, 'desc', e.target.value)}
                              style={{ height: '30px', fontSize: '11.5px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                            <button
                              type="button"
                              className="action-icon-btn delete"
                              title="Delete Service"
                              onClick={() => handleDeleteService(targetIdx)}
                              style={{ width: '28px', height: '28px' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                💡 <strong>Tip:</strong> In the Proposal Builder or Invoice Generator, select any service from the dropdown to automatically fill the service description and default pricing.
              </div>
              <div>
                <Button variant="primary" onClick={handleSaveAllSettings}>
                  Save Services Catalog
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live A4 Proposal Preview Modal */}
      <ProposalPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        proposal={currentProposalObject}
        business={{ currency }}
        customer={selectedCust}
      />
    </section>
  );
}
