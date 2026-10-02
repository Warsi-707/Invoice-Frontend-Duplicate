import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import InvoiceItems from '../components/invoice/InvoiceItems';
import ProposalBuilderModal from '../components/proposal/ProposalBuilderModal';
import ProposalPreviewModal from '../components/proposal/ProposalPreviewModal';
import { validPhone, cleanPhoneInput, money, today } from '../utils/formatters';
import { generateStatementHtml } from '../utils/statement';
import { downloadAndSendWhatsApp, sendPdfToWhatsApp } from '../utils/whatsappPdf';
import { subscriptionApi } from '../services/api';
import {
  calculateProjectMilestoneSummary,
  getMilestoneLiveMetrics,
  validateMilestonesTotal
} from '../utils/milestone';
import MilestoneSummaryCard from '../components/invoice/MilestoneSummaryCard';

const PREDEFINED_CATEGORIES = [
  'Trading',
  'Services',
  'Retail',
  'Wholesale',
  'Construction',
  'Real Estate',
  'Education',
  'Healthcare',
  'Restaurant / Food',
  'Auto',
  'IT / Software',
  'Custom'
];

export default function BusinessCustomerPage() {
  const {
    state,
    setCurrentPage,
    addBusinessAndCustomer,
    updateBusinessAndCustomer,
    deleteCustomerRecord,
    getBusiness,
    showToast,
    refreshFromBackend,
    setPreviewInvoice,
    generateMilestoneInvoice
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingSub, setIsProcessingSub] = useState(false);

  // 1. Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null); // { customerId, businessId } or null

  // Form State
  const [bizName, setBizName] = useState('');
  const [custName, setCustName] = useState('');
  const [bizCategory, setBizCategory] = useState('');
  const [bizCategoryCustom, setBizCategoryCustom] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [items, setItems] = useState([
    { id: 'item-1', name: '', qty: 1, price: '', amount: 0 }
  ]);

  // 2. View Client Overview Modal State
  const [viewingTarget, setViewingTarget] = useState(null); // { customer, business } or null

  // 3. Quick Services & Pricing Modal State
  const [servicesTarget, setServicesTarget] = useState(null); // { customer, business } or null
  const [servicesItems, setServicesItems] = useState([]);

  // 4. Commercial Proposal Modal State
  const [proposalTarget, setProposalTarget] = useState(null); // { customer, business, proposalData } or null

  // 5. Project Milestone Billing Modal State
  const [milestoneTarget, setMilestoneTarget] = useState(null); // { customer, business } or null

  // Reset Edit/Add Form
  const resetForm = () => {
    setEditingTarget(null);
    setBizName('');
    setCustName('');
    setBizCategory('');
    setBizCategoryCustom('');
    setPhone('');
    setWhatsapp('');
    setBizAddress('');
    setItems([{ id: `item-${Date.now()}`, name: '', qty: 1, price: '', amount: 0 }]);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer, business) => {
    setEditingTarget({ customerId: customer.id, businessId: business.id });
    setBizName(business.name || '');
    setCustName(customer.name || '');
    setPhone(customer.phone || business.phone || '');
    setWhatsapp(customer.whatsapp || business.whatsapp || '');
    setBizAddress(business.address || '');

    const isPredefined = PREDEFINED_CATEGORIES.filter((c) => c !== 'Custom').includes(business.category);
    if (isPredefined) {
      setBizCategory(business.category);
      setBizCategoryCustom('');
    } else if (business.category) {
      setBizCategory('Custom');
      setBizCategoryCustom(business.category);
    } else {
      setBizCategory('');
      setBizCategoryCustom('');
    }

    if (customer.items && customer.items.length > 0) {
      setItems(customer.items);
    } else {
      setItems([{ id: `item-${Date.now()}`, name: '', qty: 1, price: '', amount: 0 }]);
    }

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSave = (e) => {
    e?.preventDefault();

    const category = bizCategory === 'Custom' ? bizCategoryCustom.trim() : bizCategory.trim();

    if (!bizName.trim()) {
      alert('Business Name is required.');
      return;
    }
    if (!custName.trim()) {
      alert('Client Name is required.');
      return;
    }
    if (!category) {
      alert('Select Category.');
      return;
    }
    if (!phone.trim() || !validPhone(phone)) {
      alert('Phone No must be exactly 11 digits.');
      return;
    }
    if (whatsapp.trim() && !validPhone(whatsapp, false)) {
      alert('WhatsApp No must be 11 digits.');
      return;
    }
    if (!bizAddress.trim()) {
      alert('Business Address is required.');
      return;
    }

    const validItems = items.filter((x) => x.name && x.name.trim());

    if (editingTarget) {
      updateBusinessAndCustomer({
        customerId: editingTarget.customerId,
        businessId: editingTarget.businessId,
        businessName: bizName,
        category,
        phone,
        whatsapp: whatsapp.trim() || phone.trim(),
        businessAddress: bizAddress,
        customerName: custName,
        items: validItems
      });
    } else {
      addBusinessAndCustomer({
        businessName: bizName,
        category,
        phone,
        whatsapp: whatsapp.trim() || phone.trim(),
        businessAddress: bizAddress,
        customerName: custName,
        items: validItems
      });
    }

    handleCloseModal();
  };

  // View Client Details Handler
  const handleOpenViewModal = (customer, business) => {
    setViewingTarget({ customer, business });
  };

  // Quick Services & Pricing Modal Handler
  const handleOpenServicesModal = (customer, business) => {
    setServicesTarget({ customer, business });
    if (customer.items && customer.items.length > 0) {
      setServicesItems(customer.items.map((it) => ({ ...it })));
    } else {
      setServicesItems([{ id: `item-${Date.now()}`, name: '', qty: 1, price: '', amount: 0 }]);
    }
  };

  const handleSaveServices = () => {
    if (!servicesTarget) return;
    const { customer, business } = servicesTarget;
    const validItems = servicesItems.filter((x) => x.name && x.name.trim());

    updateBusinessAndCustomer({
      customerId: customer.id,
      businessId: business.id,
      businessName: business.name || '',
      category: business.category || '',
      phone: customer.phone || business.phone || '',
      whatsapp: customer.whatsapp || business.whatsapp || '',
      businessAddress: business.address || '',
      customerName: customer.name || '',
      items: validItems
    });

    showToast(`✅ Services & Pricing updated for ${customer.name}`);
    setServicesTarget(null);
  };

  // Generate Proposal Handler
  const handleOpenProposal = (customer, business) => {
    setProposalTarget({ customer, business });
  };

  // Generate & Download Account Statement Handler
  const handleDownloadStatement = async (customer, business) => {
    try {
      showToast('⚡ Generating Client Account Statement...');
      const html = generateStatementHtml(customer, business, state.invoices);
      const cleanName = (customer.name || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Statement_${cleanName}_${today()}.pdf`;
      const phone = customer.whatsapp || customer.phone;
      const custInvoices = state.invoices.filter((i) => String(i.customerId) === String(customer.id));
      const totalOutstanding = custInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);
      const cur = business.currency || state.settings?.currency || 'PKR';
      const orgBrand = state.settings?.proposalData?.companyName || state.settings?.companyName || 'iSysware';
      const caption = `📊 *Account Statement: ${customer.name || 'Client'}*\n🏢 ${orgBrand}\n💰 Current Outstanding: ${money(totalOutstanding, cur)}\n📅 Date: ${today()}`;

      await downloadAndSendWhatsApp({
        htmlContent: html,
        fileName,
        phone,
        caption,
        onWhatsAppSuccess: () => showToast(`✅ Statement PDF sent to ${customer.name} via WhatsApp!`)
      });
      showToast(`✅ Statement PDF downloaded for ${customer.name}!`);
    } catch (err) {
      alert('Statement error: ' + err.message);
    }
  };

  // Direct WhatsApp / Contact Handler
  const handleDirectWhatsApp = (customer, business) => {
    const rawPhone = customer.whatsapp || customer.phone || business.whatsapp || business.phone || '';
    const digitsOnly = rawPhone.replace(/\D/g, '');

    if (!digitsOnly) {
      alert('No phone or WhatsApp number available for this client.');
      return;
    }

    let internationalNumber = digitsOnly;
    if (digitsOnly.startsWith('0')) {
      internationalNumber = '92' + digitsOnly.slice(1);
    }

    const messageText = `Assalam-o-Alaikum ${customer.name},\nThis is from *${business.name || 'our company'}*.\nWe are reaching out regarding your account profile and services.\nPlease let us know if you need any assistance. Thank you!`;
    const waUrl = `https://wa.me/${internationalNumber}?text=${encodeURIComponent(messageText)}`;

    window.open(waUrl, '_blank');
    showToast(`Opening WhatsApp for ${customer.name}...`);
  };

  // 5. Open Project Milestone Modal
  const handleOpenMilestoneModal = (customer, business) => {
    setMilestoneTarget({ customer, business });
  };

  // Generate Invoice for a specific Milestone
  const handleGenerateMilestoneInvoice = (customer, business, project, milestone) => {
    if (milestone.invoiceId) {
      alert(`An invoice (${milestone.invoiceNo || 'INV'}) has already been generated for this milestone.`);
      return;
    }

    const res = generateMilestoneInvoice(customer, business, project, milestone);
    if (res.duplicate) {
      alert(res.message || 'Invoice already exists for this milestone.');
      return;
    }

    if (res.success && res.invoice) {
      showToast(`✅ Invoice ${res.invoice.invoiceNo} generated for milestone "${milestone.name}"!`);
      setPreviewInvoice(res.invoice);
    }
  };

  // Toggle milestone status between Pending and Ready to Invoice
  const handleToggleMilestoneStatus = (customer, business, project, milestone, newStatus) => {
    if (milestone.invoiceId) {
      alert('This milestone has already been invoiced and its status cannot be changed manually.');
      return;
    }

    const updatedItems = (customer.items || []).map((it) => {
      if (it.id === project.id && Array.isArray(it.milestones)) {
        return {
          ...it,
          milestones: it.milestones.map((m) =>
            m.id === milestone.id ? { ...m, status: newStatus } : m
          )
        };
      }
      return it;
    });

    updateBusinessAndCustomer({
      customerId: customer.id,
      businessId: business.id,
      businessName: business.name || '',
      category: business.category || '',
      phone: customer.phone || business.phone || '',
      whatsapp: customer.whatsapp || business.whatsapp || '',
      businessAddress: business.address || '',
      customerName: customer.name || '',
      items: updatedItems
    });

    showToast(`Milestone status updated to "${newStatus}"`);
  };

  // Delete Customer
  const handleDeleteCustomer = (customerId) => {
    if (confirm('Delete this Business / Client record?')) {
      deleteCustomerRecord(customerId);
    }
  };

  // Process Due Subscriptions Handler
  const handleProcessSubscriptions = async () => {
    setIsProcessingSub(true);
    try {
      showToast('⚡ Checking & processing active subscriptions...');
      const res = await subscriptionApi.process();
      await refreshFromBackend();
      showToast(`✅ ${res.message || 'Subscriptions processed successfully'}`);
    } catch (err) {
      alert('Subscription processing error: ' + (err.message || err));
    } finally {
      setIsProcessingSub(false);
    }
  };

  // Filtered rows
  const query = searchTerm.toLowerCase();
  const rows = state.customers
    .map((c) => {
      const b = getBusiness(c.businessId) || {};
      const custInvoices = state.invoices.filter((i) => i.customerId === c.id);
      const totalBilled = custInvoices.reduce((acc, i) => acc + Number(i.subtotal || i.total || 0), 0);
      const totalPaid = custInvoices.reduce((acc, i) => acc + Number(i.paid || 0), 0);
      const outstanding = custInvoices.reduce((acc, i) => acc + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);
      return {
        customer: c,
        business: b,
        custInvoices,
        invoiceCount: custInvoices.length,
        totalBilled,
        totalPaid,
        outstanding
      };
    })
    .filter(({ customer: c, business: b }) => {
      const fullStr = `${b.name || ''} ${b.category || ''} ${c.phone || ''} ${c.whatsapp || ''} ${c.name || ''} ${b.address || ''}`.toLowerCase();
      return fullStr.includes(query);
    });

  return (
    <section id="businesses" className="page active">
      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>Business & Client Directory</span>
            <span style={{ fontSize: '11px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              {rows.length} Records
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleProcessSubscriptions}
              disabled={isProcessingSub}
              style={{
                height: '32px',
                padding: '0 14px',
                fontSize: '12px',
                background: '#ffffff',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: isProcessingSub ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: 'none',
                transition: 'all 0.15s ease'
              }}
              title="Trigger background check for due recurring subscriptions and auto-generate cycle invoices"
            >
              {isProcessingSub ? 'Processing...' : '⚡ Run Subscriptions Auto-Billing'}
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              style={{
                height: '32px',
                padding: '0 14px',
                fontSize: '12px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Business & Client
            </button>
          </div>
        </div>
        <div className="panel-body">
          <div className="toolbar">
            <div className="grow">
              <input
                id="masterSearch"
                className="input"
                placeholder="Search business, category, client or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="table-wrap" style={{ overflowX: 'hidden', width: '100%' }}>
            <table style={{ width: '100%', minWidth: 'unset', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ padding: '9px 8px', paddingLeft: '14px', whiteSpace: 'nowrap' }}>Business</th>
                  <th style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>Category</th>
                  <th style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>Client</th>
                  <th style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>Phone No</th>
                  <th style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>WhatsApp No</th>
                  <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Business Address</th>
                  <th style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Invoices</th>
                  <th style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>Outstanding</th>
                  <th style={{ padding: '9px 8px', paddingRight: '14px', textAlign: 'center', whiteSpace: 'nowrap', width: '145px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map(({ customer: c, business: b, custInvoices, invoiceCount, totalBilled, totalPaid, outstanding }) => (
                    <tr key={c.id}>
                      <td style={{ padding: '10px 8px', paddingLeft: '14px', whiteSpace: 'nowrap' }}>
                        <strong>{b.name || '-'}</strong>
                      </td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{b.category || '-'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <strong>{c.name}</strong>
                        {Array.isArray(c.items) && c.items.some((it) => it.billingType === 'subscription') && (
                          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {c.items.filter((it) => it.billingType === 'subscription').map((it, sIdx) => (
                              <span
                                key={it.id || sIdx}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  padding: '3px 8px',
                                  background: '#f0f9ff',
                                  color: '#0284c7',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  gap: '1px'
                                }}
                                title={`Service: ${it.name} | Next Due: ${it.nextDueDate || 'Upcoming'} | Rate: ${money(it.price || 0, b.currency || 'PKR')}`}
                              >
                                <span style={{ whiteSpace: 'nowrap', lineHeight: '1.25' }}>
                                  {(it.billingCycle || 'Monthly').toUpperCase()}: Due
                                </span>
                                <span style={{ whiteSpace: 'nowrap', fontSize: '9.5px', color: '#0284c7', lineHeight: '1.25' }}>
                                  {it.nextDueDate || 'Auto'}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Project Based Badges (Clean 2-line format) */}
                        {Array.isArray(c.items) && c.items.some((it) => it.billingType !== 'subscription') && (
                          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {c.items.filter((it) => it.billingType !== 'subscription').map((it, mIdx) => {
                              const isMs = it.projectBillingMode === 'milestone';
                              const msCount = it.milestones?.length || 0;
                              const invoicedCount = (it.milestones || []).filter((m) => m.invoiceId || m.status === 'Invoiced' || m.status === 'Paid').length;
                              return (
                                <span
                                  key={it.id || mIdx}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    padding: isMs ? '3px 8px' : '2px 8px',
                                    background: isMs ? '#f0f9ff' : '#f8fafc',
                                    color: isMs ? '#0284c7' : '#475569',
                                    border: isMs ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                                    borderRadius: isMs ? '8px' : '12px',
                                    cursor: 'default',
                                    userSelect: 'none',
                                    display: 'inline-flex',
                                    flexDirection: isMs ? 'column' : 'row',
                                    alignItems: 'flex-start',
                                    gap: isMs ? '1px' : '0'
                                  }}
                                  title={isMs ? `Project: ${it.name || 'Deliverables'} | ${msCount} Milestones (${invoicedCount} Invoiced)` : `Project: ${it.name || 'Service'} | Rate: ${money(it.price || it.amount || 0, b.currency || 'PKR')}`}
                                >
                                  {isMs ? (
                                    <>
                                      <span style={{ whiteSpace: 'nowrap', lineHeight: '1.25' }}>
                                        MILESTONE: {msCount} Milestone{msCount !== 1 ? 's' : ''}
                                      </span>
                                      <span style={{ whiteSpace: 'nowrap', fontSize: '9.5px', color: '#0284c7', lineHeight: '1.25' }}>
                                        ({invoicedCount} Invoiced)
                                      </span>
                                    </>
                                  ) : (
                                    <span>PROJECT: Due {it.dueDate || 'Completion'}</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{c.phone || b.phone || '-'}</td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{c.whatsapp || b.whatsapp || c.phone || '-'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{b.address || '-'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{invoiceCount}</td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: '700', color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                          {money(outstanding, b.currency || state.settings?.currency)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', paddingRight: '14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {/* Sleek Flat Icon Action Toolbar */}
                        <div className="action-icon-toolbar">
                          {/* 1. View / Client Details Icon */}
                          <button
                            type="button"
                            className="action-icon-btn view"
                            title="View Client Details & Invoices"
                            onClick={() => handleOpenViewModal(c, b)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          {/* 2. Proposal Generate Icon */}
                          <button
                            type="button"
                            className="action-icon-btn proposal"
                            title="Generate Commercial Proposal"
                            onClick={() => handleOpenProposal(c, b)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                          </button>

                          {/* 4. Services List Add / Manage Icon (Green Sparkle) */}
                          <button
                            type="button"
                            className="action-icon-btn services"
                            title="Manage Services & Pricing List"
                            onClick={() => handleOpenServicesModal(c, b)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
                              <path d="M18 3v4m-2-2h4" />
                            </svg>
                          </button>

                          {/* 5. Edit Client & Business Icon */}
                          <button
                            type="button"
                            className="action-icon-btn edit"
                            title="Edit Business & Client"
                            onClick={() => handleOpenEditModal(c, b)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          {/* 6. Delete Record Icon */}
                          <button
                            type="button"
                            className="action-icon-btn delete"
                            title="Delete Record"
                            onClick={() => handleDeleteCustomer(c.id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="empty">
                      No Business / Client records added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 1. Unified Add / Edit Business & Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTarget ? 'Edit Business & Client' : 'Add Business & Client'}
        maxWidth="920px"
      >
        <form onSubmit={handleSave} className="enter-flow" autoComplete="off">
          <div className="panel" style={{ boxShadow: 'none', marginBottom: '14px' }}>
            <div className="panel-head">
              <span>Business & Client Details</span>
              <span>Required</span>
            </div>
            <div className="panel-body">
              <div className="grid two" style={{ gap: '11px 12px' }}>
                <div>
                  <label>
                    Business Name <span className="req">*</span>
                  </label>
                  <input
                    id="mBizName"
                    className="input"
                    placeholder="Business Name"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                <div>
                  <label>
                    Client Name <span className="req">*</span>
                  </label>
                  <input
                    id="mCustName"
                    className="input"
                    placeholder="Client Name"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label>
                    Category <span className="req">*</span>
                  </label>
                  <select
                    id="mBizCategory"
                    className="select"
                    value={bizCategory}
                    onChange={(e) => setBizCategory(e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {PREDEFINED_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'Custom' ? 'Custom Category' : cat}
                      </option>
                    ))}
                  </select>
                </div>

                {bizCategory === 'Custom' && (
                  <div>
                    <label>
                      Custom Category <span className="req">*</span>
                    </label>
                    <input
                      id="mBizCategoryCustom"
                      className="input"
                      placeholder="Write Category"
                      value={bizCategoryCustom}
                      onChange={(e) => setBizCategoryCustom(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                )}

                <div>
                  <label>
                    Phone No <span className="req">*</span>
                  </label>
                  <input
                    id="mPhone"
                    className="input phone11"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="03001234567"
                    value={phone}
                    onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label>WhatsApp No</label>
                  <input
                    id="mWhatsapp"
                    className="input phone11"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="03001234567"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(cleanPhoneInput(e.target.value))}
                    autoComplete="off"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>
                    Business Address <span className="req">*</span>
                  </label>
                  <input
                    id="mBizAddress"
                    className="input"
                    placeholder="Business Address"
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items / Services Table inside Modal */}
          <div style={{ marginBottom: '14px' }}>
            <InvoiceItems
              items={items}
              onChange={setItems}
              currency="PKR"
            />
          </div>

          <div className="actions">
            <Button variant="light" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingTarget ? 'Update Business & Client' : 'Save Business & Client'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. View Client Overview Modal */}
      {viewingTarget && (
        <Modal
          isOpen={Boolean(viewingTarget)}
          onClose={() => setViewingTarget(null)}
          title={`Client Profile: ${viewingTarget.customer.name}`}
          maxWidth="920px"
        >
          {(() => {
            const { customer, business } = viewingTarget;
            const custInvoices = state.invoices.filter((i) => i.customerId === customer.id);
            const totalBilled = custInvoices.reduce((acc, i) => acc + Number(i.subtotal || i.total || 0), 0);
            const totalPaid = custInvoices.reduce((acc, i) => acc + Number(i.paid || 0), 0);
            const outstanding = custInvoices.reduce((acc, i) => acc + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);
            const cur = business.currency || state.settings?.currency || 'PKR';

            return (
              <div>
                {/* 4 Key Stat Cards */}
                <div className="overview-stats-grid">
                  <div className="overview-stat-card">
                    <span className="overview-stat-label">Total Invoices</span>
                    <span className="overview-stat-value">{custInvoices.length}</span>
                  </div>
                  <div className="overview-stat-card">
                    <span className="overview-stat-label">Total Billed</span>
                    <span className="overview-stat-value">{money(totalBilled, cur)}</span>
                  </div>
                  <div className="overview-stat-card">
                    <span className="overview-stat-label">Total Paid</span>
                    <span className="overview-stat-value" style={{ color: '#16a34a' }}>{money(totalPaid, cur)}</span>
                  </div>
                  <div className="overview-stat-card" style={{ borderColor: outstanding > 0 ? '#fca5a5' : '#bbf7d0', background: outstanding > 0 ? '#fef2f2' : '#f0fdf4' }}>
                    <span className="overview-stat-label">Outstanding</span>
                    <span className="overview-stat-value" style={{ color: outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                      {money(outstanding, cur)}
                    </span>
                  </div>
                </div>

                {/* Contact & Business Profile Box */}
                <div className="overview-contact-box">
                  <div className="overview-contact-item">
                    <span className="label">Business Name</span>
                    <span className="val">{business.name || '-'}</span>
                  </div>
                  <div className="overview-contact-item">
                    <span className="label">Business Category</span>
                    <span className="val">{business.category || '-'}</span>
                  </div>
                  <div className="overview-contact-item">
                    <span className="label">Client Name</span>
                    <span className="val">{customer.name || '-'}</span>
                  </div>
                  <div className="overview-contact-item">
                    <span className="label">Phone / WhatsApp</span>
                    <span className="val">
                      {customer.phone || '-'} {customer.whatsapp && customer.whatsapp !== customer.phone ? ` / WA: ${customer.whatsapp}` : ''}
                    </span>
                  </div>
                  <div className="overview-contact-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="label">Business Address</span>
                    <span className="val">{business.address || customer.address || '-'}</span>
                  </div>
                </div>

                {/* Configured Services & Pricing List */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                      Configured Services & Products ({customer.items?.length || 0})
                    </h4>
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => {
                        setViewingTarget(null);
                        handleOpenServicesModal(customer, business);
                      }}
                    >
                      ✏️ Edit Services List
                    </Button>
                  </div>

                  {customer.items && customer.items.length > 0 ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Service / Item</th>
                            <th>Billing Type</th>
                            <th style={{ textAlign: 'center' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Unit Price</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.items.map((it, idx) => {
                            const isSub = it.billingType === 'subscription';
                            return (
                              <tr key={it.id || idx}>
                                <td>{idx + 1}</td>
                                <td>
                                  <strong>{it.name}</strong>
                                  {isSub && (
                                    <div style={{ fontSize: '10.5px', color: '#0284c7', marginTop: '2px' }}>
                                      Start: {it.startDate || '-'} | Next Due: <strong>{it.nextDueDate || '-'}</strong> | Delivery: {it.deliveryMethod || 'whatsapp'}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {isSub ? (
                                    <span style={{ fontSize: '10.5px', fontWeight: '700', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}>
                                      {(it.billingCycle || 'Monthly').toUpperCase()} Sub
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10.5px', fontWeight: '600', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}>
                                      Project (One-Time)
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>{it.qty || 1}</td>
                                <td style={{ textAlign: 'right' }}>{money(it.price || 0, cur)}</td>
                                <td style={{ textAlign: 'right' }}><strong>{money((it.qty || 1) * (it.price || 0), cur)}</strong></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                      No saved recurring services configured. Click "Edit Services List" to add default items.
                    </div>
                  )}
                </div>

                {/* Project Milestones & Billing Section */}
                {(() => {
                  const milestoneProjects = (customer.items || []).filter(
                    (it) => it.billingType !== 'subscription' && it.projectBillingMode === 'milestone' && Array.isArray(it.milestones) && it.milestones.length > 0
                  );

                  if (milestoneProjects.length === 0) return null;

                  return (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                          Project Milestones & Billing ({milestoneProjects.length})
                        </h4>
                      </div>

                      {milestoneProjects.map((proj, pIdx) => {
                        const summary = calculateProjectMilestoneSummary(proj, custInvoices);
                        return (
                          <div key={proj.id || pIdx} style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                                {proj.name || `Project ${pIdx + 1}`}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                                Budget: {money(summary.projectTotal, cur)}
                              </span>
                            </div>

                            <MilestoneSummaryCard summary={summary} currency={cur} title={`Summary: ${proj.name || 'Project'}`} />

                            <div className="table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Milestone Description</th>
                                    <th>Start Date</th>
                                    <th>Due Date</th>
                                    <th style={{ textAlign: 'right' }}>Amount / %</th>
                                    <th>Status</th>
                                    <th>Invoice Ref</th>
                                    <th style={{ textAlign: 'right' }}>Paid / Balance</th>
                                    <th style={{ textAlign: 'center' }}>Billing Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {proj.milestones.map((ms, mIdx) => {
                                    const metrics = getMilestoneLiveMetrics(ms, custInvoices);
                                    const isInvoiced = metrics.hasInvoice;

                                    return (
                                      <tr key={ms.id || mIdx}>
                                        <td>{mIdx + 1}</td>
                                        <td><strong>{ms.name}</strong></td>
                                        <td>{ms.startDate || '-'}</td>
                                        <td>{ms.dueDate || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                          <strong>{money(ms.amount || 0, cur)}</strong>
                                          <div style={{ fontSize: '10px', color: '#64748b' }}>{ms.percentage}% of total</div>
                                        </td>
                                        <td>
                                          <span style={{
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: metrics.status === 'Paid' ? '#dcfce7' : metrics.status === 'Partially Paid' ? '#fef3c7' : metrics.status === 'Invoiced' ? '#e0e7ff' : ms.status === 'Ready to Invoice' ? '#fef9c3' : '#f1f5f9',
                                            color: metrics.status === 'Paid' ? '#15803d' : metrics.status === 'Partially Paid' ? '#b45309' : metrics.status === 'Invoiced' ? '#3730a3' : ms.status === 'Ready to Invoice' ? '#854d0e' : '#475569',
                                            border: `1px solid ${metrics.status === 'Paid' ? '#bbf7d0' : metrics.status === 'Partially Paid' ? '#fde68a' : metrics.status === 'Invoiced' ? '#c7d2fe' : ms.status === 'Ready to Invoice' ? '#fef08a' : '#cbd5e1'}`
                                          }}>
                                            {metrics.status || ms.status || 'Pending'}
                                          </span>
                                        </td>
                                        <td>
                                          {metrics.invoiceNo ? (
                                            <span style={{ fontWeight: '700', color: '#0b4b8f' }}>{metrics.invoiceNo}</span>
                                          ) : (
                                            <span style={{ color: '#94a3b8' }}>-</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                          {isInvoiced ? (
                                            <div>
                                              <div style={{ color: '#16a34a', fontWeight: '700', fontSize: '11px' }}>Paid: {money(metrics.paidAmount, cur)}</div>
                                              <div style={{ color: metrics.outstandingAmount > 0 ? '#dc2626' : '#64748b', fontSize: '10.5px' }}>Bal: {money(metrics.outstandingAmount, cur)}</div>
                                            </div>
                                          ) : (
                                            <span style={{ color: '#94a3b8' }}>Unbilled</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                          {isInvoiced ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const inv = state.invoices.find((i) => i.id === metrics.invoiceId || i.invoiceNo === metrics.invoiceNo);
                                                if (inv) setPreviewInvoice(inv);
                                              }}
                                              style={{ fontSize: '10.5px', padding: '3px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#334155' }}
                                            >
                                              View Invoice
                                            </button>
                                          ) : (
                                            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                              {ms.status !== 'Ready to Invoice' && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleMilestoneStatus(customer, business, proj, ms, 'Ready to Invoice')}
                                                  style={{ fontSize: '10px', padding: '3px 6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                                                >
                                                  Mark Ready
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => handleGenerateMilestoneInvoice(customer, business, proj, ms)}
                                                style={{ fontSize: '10.5px', padding: '3px 10px', background: '#1e40af', border: '1px solid #1e40af', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontWeight: '700' }}
                                              >
                                                Generate Invoice
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}


                {/* Invoices History Table */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                    Recent Invoices ({custInvoices.length})
                  </h4>
                  {custInvoices.length > 0 ? (
                    <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table style={{ tableLayout: 'fixed', width: '100%' }}>
                        <colgroup>
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '17%' }} />
                          <col style={{ width: '17%' }} />
                          <col style={{ width: '16%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Month</th>
                            <th style={{ textAlign: 'center' }}>Total</th>
                            <th style={{ textAlign: 'center' }}>Balance</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custInvoices.map((inv) => (
                            <tr key={inv.id}>
                              <td><strong>{inv.invoiceNo}</strong></td>
                              <td>{inv.date || '-'}</td>
                              <td>{inv.month} {inv.year}</td>
                              <td style={{ textAlign: 'center' }}>{money(inv.total, cur)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <strong style={{ color: Number(inv.balance) > 0 ? '#dc2626' : '#16a34a' }}>
                                  {money(inv.balance, cur)}
                                </strong>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <StatusBadge status={inv.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                      No invoices created for this client yet.
                    </div>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setViewingTarget(null);
                        setCurrentPage('generator');
                      }}
                    >
                      + Generate Invoice
                    </Button>
                    <Button
                      variant="light"
                      size="sm"
                      onClick={() => {
                        setViewingTarget(null);
                        handleOpenProposal(customer, business);
                      }}
                    >
                      Proposal Builder
                    </Button>
                  </div>
                  <Button variant="light" size="sm" onClick={() => setViewingTarget(null)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* 3. Quick Services & Pricing Modal */}
      {servicesTarget && (
        <Modal
          isOpen={Boolean(servicesTarget)}
          onClose={() => setServicesTarget(null)}
          title={`Manage Services & Pricing: ${servicesTarget.customer.name}`}
          maxWidth="820px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Configure standard line items, deliverables, and rates for <strong>{servicesTarget.customer.name}</strong> ({servicesTarget.business.name}). These items will automatically load when generating invoices or proposals.
            </p>

            <InvoiceItems
              items={servicesItems}
              onChange={setServicesItems}
              currency={servicesTarget.business.currency || state.settings?.currency || 'PKR'}
            />

            <div className="actions" style={{ marginTop: '10px' }}>
              <Button variant="light" onClick={() => setServicesTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveServices}>
                Save Services List
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Commercial Proposal Builder Modal */}
      {proposalTarget && (
        <ProposalBuilderModal
          isOpen={Boolean(proposalTarget)}
          onClose={() => setProposalTarget(null)}
          customer={proposalTarget.customer}
          business={proposalTarget.business}
        />
      )}

      {/* 5. Dedicated Project Milestone Billing Modal */}
      {milestoneTarget && (
        <Modal
          isOpen={Boolean(milestoneTarget)}
          onClose={() => setMilestoneTarget(null)}
          title={`Milestone Projects Billing: ${milestoneTarget.customer.name}`}
          maxWidth="900px"
        >
          {(() => {
            const { customer, business } = milestoneTarget;
            const cur = business.currency || state.settings?.currency || 'PKR';
            const custInvoices = state.invoices.filter((i) => i.customerId === customer.id);
            const milestoneProjects = (customer.items || []).filter(
              (it) => it.billingType !== 'subscription' && it.projectBillingMode === 'milestone' && Array.isArray(it.milestones) && it.milestones.length > 0
            );

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Manage deliverables, milestones, and generate billing invoices for <strong>{customer.name}</strong> ({business.name}).
                  </p>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => {
                      setMilestoneTarget(null);
                      handleOpenServicesModal(customer, business);
                    }}
                  >
                    ✏️ Configure / Add Milestones
                  </Button>
                </div>

                {milestoneProjects.length > 0 ? (
                  milestoneProjects.map((proj, pIdx) => {
                    const summary = calculateProjectMilestoneSummary(proj, custInvoices);

                    return (
                      <div
                        key={proj.id || pIdx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '16px',
                          boxShadow: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '750', color: '#0f172a' }}>
                              {proj.name || `Project ${pIdx + 1}`}
                            </span>
                            <span style={{ marginLeft: '10px', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                              Budget: <strong>{money(summary.projectTotal, cur)}</strong>
                            </span>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: summary.remainingUnbilledAmount === 0 ? '#dcfce7' : '#fef9c3',
                            color: summary.remainingUnbilledAmount === 0 ? '#15803d' : '#854d0e',
                            border: `1px solid ${summary.remainingUnbilledAmount === 0 ? '#bbf7d0' : '#fef08a'}`
                          }}>
                            {summary.remainingUnbilledAmount === 0 ? 'Fully Billed' : `${money(summary.remainingUnbilledAmount, cur)} Unbilled`}
                          </span>
                        </div>

                        {/* Project / Milestone Summary Card with 6 Required Metrics */}
                        <MilestoneSummaryCard
                          summary={summary}
                          currency={cur}
                          title={`Milestone Financial Summary: ${proj.name || 'Project'}`}
                        />

                        {/* Milestones Detailed List */}
                        <div className="table-wrap" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <table>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th>#</th>
                                <th>Milestone Description</th>
                                <th>Start Date</th>
                                <th>Due Date</th>
                                <th style={{ textAlign: 'right' }}>Amount / %</th>
                                <th>Status</th>
                                <th>Invoice Ref</th>
                                <th style={{ textAlign: 'right' }}>Paid / Balance</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {proj.milestones.map((ms, mIdx) => {
                                const metrics = getMilestoneLiveMetrics(ms, custInvoices);
                                const isInvoiced = metrics.hasInvoice;

                                return (
                                  <tr key={ms.id || mIdx}>
                                    <td>{mIdx + 1}</td>
                                    <td>
                                      <strong>{ms.name}</strong>
                                    </td>
                                    <td>{ms.startDate || '-'}</td>
                                    <td>{ms.dueDate || '-'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <strong>{money(ms.amount || 0, cur)}</strong>
                                      <div style={{ fontSize: '10px', color: '#64748b' }}>{ms.percentage}%</div>
                                    </td>
                                    <td>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: metrics.status === 'Paid' ? '#dcfce7' : metrics.status === 'Partially Paid' ? '#fef3c7' : metrics.status === 'Invoiced' ? '#e0e7ff' : ms.status === 'Ready to Invoice' ? '#fef9c3' : '#f1f5f9',
                                        color: metrics.status === 'Paid' ? '#15803d' : metrics.status === 'Partially Paid' ? '#b45309' : metrics.status === 'Invoiced' ? '#3730a3' : ms.status === 'Ready to Invoice' ? '#854d0e' : '#475569',
                                        border: `1px solid ${metrics.status === 'Paid' ? '#bbf7d0' : metrics.status === 'Partially Paid' ? '#fde68a' : metrics.status === 'Invoiced' ? '#c7d2fe' : ms.status === 'Ready to Invoice' ? '#fef08a' : '#cbd5e1'}`
                                      }}>
                                        {metrics.status || ms.status || 'Pending'}
                                      </span>
                                    </td>
                                    <td>
                                      {metrics.invoiceNo ? (
                                        <span style={{ fontWeight: '700', color: '#0b4b8f' }}>
                                          {metrics.invoiceNo}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>-</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      {isInvoiced ? (
                                        <div>
                                          <div style={{ color: '#16a34a', fontWeight: '700', fontSize: '11px' }}>
                                            Paid: {money(metrics.paidAmount, cur)}
                                          </div>
                                          <div style={{ color: metrics.outstandingAmount > 0 ? '#dc2626' : '#64748b', fontSize: '10.5px' }}>
                                            Bal: {money(metrics.outstandingAmount, cur)}
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>Unbilled</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {isInvoiced ? (
                                        <Button
                                          variant="light"
                                          size="xs"
                                          onClick={() => {
                                            const inv = state.invoices.find((i) => i.id === metrics.invoiceId || i.invoiceNo === metrics.invoiceNo);
                                            if (inv) setPreviewInvoice(inv);
                                          }}
                                          style={{ fontSize: '10.5px', padding: '2px 8px' }}
                                        >
                                          View Invoice
                                        </Button>
                                      ) : (
                                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                          {ms.status !== 'Ready to Invoice' && (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleMilestoneStatus(customer, business, proj, ms, 'Ready to Invoice')}
                                              style={{
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                background: '#ffffff',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                color: '#475569'
                                              }}
                                              title="Mark milestone ready for invoicing"
                                            >
                                              Mark Ready
                                            </button>
                                          )}
                                          <Button
                                            variant="primary"
                                            size="xs"
                                            onClick={() => handleGenerateMilestoneInvoice(customer, business, proj, ms)}
                                            style={{
                                              fontSize: '10.5px',
                                              padding: '2px 8px',
                                              background: '#0284c7',
                                              borderColor: '#0284c7'
                                            }}
                                          >
                                            Generate Invoice
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    padding: '24px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    textAlign: 'center',
                    border: '1px dashed #cbd5e1'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '750', color: '#1e293b', marginBottom: '4px' }}>
                      No Milestone-Based Projects Configured
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                      This client currently has One-Time or Subscription items. Switch an item to <strong>Milestone Based</strong> to create structured payment milestones.
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setMilestoneTarget(null);
                        handleOpenServicesModal(customer, business);
                      }}
                      style={{ background: '#0284c7', borderColor: '#0284c7' }}
                    >
                      Configure Milestones Now
                    </Button>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <Button variant="light" size="sm" onClick={() => setMilestoneTarget(null)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </section>
  );
}
