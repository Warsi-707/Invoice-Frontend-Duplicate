import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import InvoiceItems from '../components/invoice/InvoiceItems';
import InvoicePreview from '../components/invoice/InvoicePreview';
import Button from '../components/common/Button';
import { MONTHS, YEARS, today, money } from '../utils/formatters';
import { nextInvoiceNo, calculateInvoiceTotals, getNextInvoiceMonth, downloadInvoiceFile, generateInvoiceHtml } from '../utils/invoice';
import { getMilestoneLiveMetrics } from '../utils/milestone';
import { downloadAndSendWhatsApp } from '../utils/whatsappPdf';
import { whatsappApi } from '../services/api';

export default function InvoiceGeneratorPage() {
  const { state, createInvoice, getBusiness, getCustomer, showToast } = useApp();

  const currentMonthName = MONTHS[new Date().getMonth()];
  const currentYearStr = String(new Date().getFullYear());

  const [businessId, setBusinessId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [month, setMonth] = useState(currentMonthName);
  const [year, setYear] = useState(currentYearStr);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [includePreviousDues, setIncludePreviousDues] = useState(false);

  const [items, setItems] = useState([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Preview Modal State
  const [previewData, setPreviewData] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Selected Business & Client details
  const selectedBusiness = getBusiness(businessId) || {};
  const selectedCustomer = getCustomer(customerId) || {};

  // Available clients (filtered by business if selected, otherwise all clients)
  const availableCustomers = businessId
    ? state.customers.filter((c) => c.businessId === businessId)
    : state.customers;

  // Calculate previous unpaid invoices / dues for the selected customer
  const customerUnpaidInvoices = customerId
    ? state.invoices.filter((i) => i.customerId === customerId && Number(i.balance || 0) > 0)
    : [];

  const previousDuesAmount = customerUnpaidInvoices.reduce(
    (sum, i) => sum + Number(i.balance || 0),
    0
  );

  // Handle business change
  const handleBusinessChange = (newBizId) => {
    setBusinessId(newBizId);
    if (newBizId && customerId) {
      const cust = getCustomer(customerId);
      if (cust && cust.businessId !== newBizId) {
        setCustomerId('');
        setItems([]);
      }
    }
  };

  // Handle client change (auto-selects business and auto-populates saved client items)
  const handleCustomerChange = (newCustId) => {
    setCustomerId(newCustId);
    if (newCustId) {
      const unpaid = state.invoices.filter((i) => i.customerId === newCustId && Number(i.balance || 0) > 0);
      const totalUnpaid = unpaid.reduce((sum, i) => sum + Number(i.balance || 0), 0);
      setIncludePreviousDues(totalUnpaid > 0);

      const cust = getCustomer(newCustId);
      if (cust) {
        if (cust.businessId && (!businessId || businessId !== cust.businessId)) {
          setBusinessId(cust.businessId);
        }
        if (cust.items && cust.items.length > 0) {
          setItems(
            cust.items.map((item) => ({
              ...item,
              id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
            }))
          );
          // If subscription item exists, pre-set due date and billing month/year
          const subItem = cust.items.find((it) => it.billingType === 'subscription' && it.nextDueDate);
          if (subItem) {
            setDueDate(subItem.nextDueDate);
            const [dueY, dueM] = subItem.nextDueDate.split('-');
            const monthIdx = parseInt(dueM, 10) - 1;
            if (MONTHS[monthIdx]) setMonth(MONTHS[monthIdx]);
            if (dueY) setYear(dueY);
          }
        } else {
          setItems([{ id: `item-${Date.now()}`, name: '', qty: 1, price: '', amount: 0 }]);
        }
      }
    } else {
      setIncludePreviousDues(false);
      setItems([]);
    }
  };

  // Next Invoice #
  const currentInvoiceNoText = businessId
    ? `Invoice #: ${nextInvoiceNo(businessId, selectedBusiness, state.invoices)}`
    : 'Invoice #';

  // Calculate totals
  const totals = calculateInvoiceTotals(items);
  const currency = selectedBusiness.currency || state.settings?.currency || 'PKR';
  const effectivePreviousDues = includePreviousDues && previousDuesAmount > 0 ? previousDuesAmount : 0;
  const finalGrandTotal = totals.subtotal + effectivePreviousDues;

  const clientMilestoneProjects = (selectedCustomer?.items || []).filter(
    (it) => it.billingType === 'project' && it.projectBillingMode === 'milestone' && Array.isArray(it.milestones) && it.milestones.length > 0
  );

  const handleSelectMilestoneToInvoice = (project, milestone) => {
    setSelectedMilestoneId(milestone.id);
    setSelectedProjectId(project.id);
    setItems([
      {
        id: `item-${Date.now()}`,
        name: `${project.name} - Milestone: ${milestone.name}`,
        qty: 1,
        price: Number(milestone.amount || 0),
        amount: Number(milestone.amount || 0),
        billingType: 'project',
        projectBillingMode: 'milestone',
        milestoneId: milestone.id,
        projectId: project.id
      }
    ]);
    if (milestone.dueDate) {
      setDueDate(milestone.dueDate);
      const [dueY, dueM] = milestone.dueDate.split('-');
      const mIdx = parseInt(dueM, 10) - 1;
      if (MONTHS[mIdx]) setMonth(MONTHS[mIdx]);
      if (dueY) setYear(dueY);
    }
  };

  const handleClearMilestoneSelection = () => {
    setSelectedMilestoneId(null);
    setSelectedProjectId(null);
    if (selectedCustomer?.items && selectedCustomer.items.length > 0) {
      setItems(
        selectedCustomer.items.map((item) => ({
          ...item,
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
        }))
      );
    } else {
      setItems([{ id: `item-${Date.now()}`, name: '', qty: 1, price: '', amount: 0 }]);
    }
  };

  const resetForm = () => {
    setBusinessId('');
    setCustomerId('');
    setMonth(currentMonthName);
    setYear(currentYearStr);
    setInvoiceDate(today());
    setDueDate(today());
    setItems([]);
    setIncludePreviousDues(false);
    setSelectedMilestoneId(null);
    setSelectedProjectId(null);
  };

  const validateForm = () => {
    if (!businessId) {
      alert('Select Business.');
      return false;
    }
    if (!customerId) {
      alert('Select Client.');
      return false;
    }
    if (!month) {
      alert('Select Month.');
      return false;
    }
    if (!year) {
      alert('Select Year.');
      return false;
    }
    if (!invoiceDate || !dueDate) {
      alert('Invoice Date and Due Date are required.');
      return false;
    }

    const validItems = items.filter((x) => x.name.trim() && Number(x.qty) > 0);
    if (validItems.length === 0) {
      alert('Add at least one valid item / service.');
      return false;
    }

    if (finalGrandTotal <= 0) {
      alert('Invoice total must be greater than zero.');
      return false;
    }

    return true;
  };

  const previousDuesMonths = customerUnpaidInvoices
    .map((inv) => `${inv.month || ''} ${inv.year || ''}`.trim())
    .filter(Boolean)
    .join(', ');

  const handlePreview = () => {
    if (!validateForm()) return;

    const invoiceData = {
      id: 'preview',
      invoiceNo: nextInvoiceNo(businessId, selectedBusiness, state.invoices),
      businessId,
      customerId,
      month,
      year,
      date: invoiceDate,
      due: dueDate,
      items: totals.items.filter((x) => x.name.trim()),
      subtotal: totals.subtotal,
      previousDues: effectivePreviousDues,
      previousDuesMonths: effectivePreviousDues > 0 ? previousDuesMonths : '',
      additional: 0,
      discount: 0,
      taxPct: 0,
      taxAmount: 0,
      total: totals.total || totals.subtotal,
      paid: 0,
      balance: totals.total || totals.subtotal,
      status: 'Unpaid',
      notes: state.settings?.footerNote || '',
      milestoneId: selectedMilestoneId || null,
      projectId: selectedProjectId || null
    };

    setPreviewData(invoiceData);
    setIsPreviewOpen(true);
  };

  const handleGenerateInvoice = () => {
    if (!validateForm()) return;

    const invoicePayload = {
      businessId,
      customerId,
      month,
      year,
      date: invoiceDate,
      due: dueDate,
      items: totals.items.filter((x) => x.name.trim()),
      subtotal: totals.subtotal,
      previousDues: effectivePreviousDues,
      previousDuesMonths: effectivePreviousDues > 0 ? previousDuesMonths : '',
      additional: 0,
      discount: 0,
      taxPct: 0,
      taxAmount: 0,
      total: totals.total || totals.subtotal,
      notes: state.settings?.footerNote || '',
      milestoneId: selectedMilestoneId || null,
      projectId: selectedProjectId || null
    };

    const result = createInvoice(invoicePayload);

    if (result.duplicate) {
      if (selectedMilestoneId) {
        alert(result.message || 'Invoice already generated for this milestone.');
      } else {
        alert(`This client's ${month} ${year} invoice already exists. Next month selected automatically.`);
        const next = getNextInvoiceMonth(month, year);
        setMonth(next.month);
        setYear(next.year);
      }
      return;
    }

    if (result.success && result.invoice) {
      setPreviewData(result.invoice);
      setIsPreviewOpen(true);

      const htmlContent = generateInvoiceHtml(result.invoice, { ...selectedBusiness, proposalData: state.settings?.proposalData || selectedBusiness?.proposalData }, selectedCustomer);
      const fileName = `${result.invoice.invoiceNo || 'invoice'}.pdf`;
      const phone = selectedCustomer?.whatsapp || selectedCustomer?.phone;
      const orgBrand = state.settings?.proposalData?.companyName || state.settings?.companyName || 'iSysware';
      const caption = `📄 *Invoice ${result.invoice.invoiceNo}*\n🏢 ${orgBrand}\n👤 ${selectedCustomer?.name || 'Client'}\n💰 Total: ${money(result.invoice.total, selectedBusiness?.currency || 'PKR')}`;

      // Auto-download PDF & Auto-send WhatsApp simultaneously (ultra fast single-pass)
      downloadAndSendWhatsApp({
        htmlContent,
        fileName,
        phone,
        caption,
        onWhatsAppSuccess: () => showToast(`✅ Invoice sent to ${selectedCustomer?.name || 'Client'} via WhatsApp!`)
      }).catch((err) => console.warn('Auto download & WhatsApp:', err));

      showToast('✅ Invoice generated & downloaded!');
      resetForm();
    }
  };

  return (
    <section id="generator" className="page active">
      <div className="panel generator-panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>Invoice Generator</span>
            <span style={{ fontSize: '11px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              Create New Invoice
            </span>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            {currentInvoiceNoText}
          </span>
        </div>
        <div className="panel-body enter-flow" id="genForm">
          {/* Invoice Details Grid */}
          <div className="generator-details">
            <div className="generator-details-title" style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
              Invoice Details
            </div>
            <div className="grid four">
              <div>
                <label>
                  Business <span className="req">*</span>
                </label>
                <select
                  id="gBiz"
                  className="select"
                  value={businessId}
                  onChange={(e) => handleBusinessChange(e.target.value)}
                >
                  <option value="">Select Business</option>
                  {state.businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>
                  Client <span className="req">*</span>
                </label>
                <select
                  id="gCust"
                  className="select"
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                >
                  <option value="">Select Client</option>
                  {availableCustomers.length > 0 ? (
                    availableCustomers.map((c) => {
                      const b = getBusiness(c.businessId);
                      const bLabel = !businessId && b?.name ? ` (${b.name})` : '';
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} - {c.phone}{bLabel}
                        </option>
                      );
                    })
                  ) : (
                    <option value="" disabled>
                      {businessId ? 'No clients found for this business' : 'No clients added yet'}
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label>
                  Month <span className="req">*</span>
                </label>
                <select
                  id="gMonth"
                  className="select"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  <option value="">Select Month</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>
                  Year <span className="req">*</span>
                </label>
                <select
                  id="gYear"
                  className="select"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Select Year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>
                  Invoice Date <span className="req">*</span>
                </label>
                <input
                  id="gDate"
                  className="input"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>

              <div>
                <label>
                  Due Date <span className="req">*</span>
                </label>
                <input
                  id="gDue"
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div>
                <label>Phone No</label>
                <input
                  id="gPhone"
                  className="input"
                  value={selectedCustomer.phone || selectedBusiness.phone || ''}
                  placeholder="Phone No"
                  readOnly
                />
              </div>

              <div>
                <label>WhatsApp No</label>
                <input
                  id="gWhatsapp"
                  className="input"
                  value={selectedCustomer.whatsapp || selectedBusiness.whatsapp || selectedCustomer.phone || ''}
                  placeholder="WhatsApp No"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Outstanding Previous Dues Banner */}
          {customerId && previousDuesAmount > 0 && (
            <div className="previous-dues-banner">
              <div className="dues-banner-left">
                <div className="dues-warning-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="dues-content">
                  <div className="dues-title">
                    <span>Previous Unpaid Dues Detected:</span>
                    <span className="dues-amount-badge">{money(previousDuesAmount, currency)}</span>
                  </div>
                  <div className="dues-invoices-list">
                    {customerUnpaidInvoices.map((inv) => (
                      <span key={inv.id} className="dues-item-chip">
                        {inv.month} {inv.year}: <strong>{money(inv.balance, currency)}</strong> ({inv.status})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dues-banner-right">
                <label className="dues-toggle-label">
                  <input
                    type="checkbox"
                    checked={includePreviousDues}
                    onChange={(e) => setIncludePreviousDues(e.target.checked)}
                  />
                  <span>Include Previous Dues in this invoice</span>
                </label>
              </div>
            </div>
          )}

          {/* Items Section shown ONLY when Client is selected */}
          {customerId ? (
            <>
              {/* Milestone Billing Quick Selector */}
              {clientMilestoneProjects.length > 0 && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    marginBottom: '18px',
                    boxShadow: 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: selectedMilestoneId ? '#f0f9ff' : '#f1f5f9',
                          color: selectedMilestoneId ? '#0284c7' : '#475569',
                          border: `1px solid ${selectedMilestoneId ? '#bae6fd' : '#e2e8f0'}`,
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        Milestone Billing
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {selectedMilestoneId ? 'Milestone Selected for Invoicing' : 'Bill Specific Project Milestone (Optional)'}
                      </strong>
                    </div>
                    {selectedMilestoneId && (
                      <button
                        type="button"
                        className="btn xs light"
                        onClick={handleClearMilestoneSelection}
                        style={{ fontSize: '11.5px', padding: '4px 12px', borderRadius: '9999px', color: '#dc2626', borderColor: '#fecaca' }}
                      >
                        ✕ Clear Selection &amp; Bill All Items
                      </button>
                    )}
                  </div>

                  {clientMilestoneProjects.map((proj) => (
                    <div key={proj.id} style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b' }}>
                          {proj.name}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                        {(proj.milestones || []).map((ms) => {
                          const clientInvoices = state.invoices.filter((i) => i.customerId === customerId);
                          const metrics = getMilestoneLiveMetrics(ms, clientInvoices);
                          const isSelected = selectedMilestoneId === ms.id;
                          const isInvoiced = metrics.isInvoiced;

                          return (
                            <button
                              key={ms.id}
                              type="button"
                              onClick={() => {
                                if (isInvoiced) {
                                  alert(`Milestone "${ms.name}" has already been invoiced (${metrics.invoiceNo || 'INV'}). Prevent duplicate invoice generation.`);
                                  return;
                                }
                                handleSelectMilestoneToInvoice(proj, ms);
                              }}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                textAlign: 'left',
                                cursor: isInvoiced ? 'not-allowed' : 'pointer',
                                opacity: isInvoiced ? 0.65 : 1,
                                border: `1.5px solid ${isSelected ? '#0284c7' : '#e2e8f0'}`,
                                background: isSelected ? '#f0f9ff' : isInvoiced ? '#f8fafc' : '#ffffff',
                                boxShadow: 'none',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#0284c7' : '#0f172a' }}>
                                  {isSelected ? '✓ ' : ''}{ms.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: isInvoiced ? '#f1f5f9' : ms.status === 'Ready to Invoice' ? '#dcfce7' : '#fef9c3',
                                    color: isInvoiced ? '#475569' : ms.status === 'Ready to Invoice' ? '#15803d' : '#854d0e',
                                    border: `1px solid ${isInvoiced ? '#e2e8f0' : ms.status === 'Ready to Invoice' ? '#bbf7d0' : '#fef08a'}`,
                                    fontWeight: 650,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {metrics.status} {isInvoiced && metrics.invoiceNo ? `(${metrics.invoiceNo})` : ''}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                                <span style={{ fontWeight: 800, color: isSelected ? '#0284c7' : '#334155' }}>
                                  {money(ms.amount, currency)}
                                </span>
                                {ms.type === 'percentage' && (
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    {ms.percentage}% of project
                                  </span>
                                )}
                              </div>
                              {(ms.startDate || ms.dueDate) && (
                                <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', gap: '10px', marginTop: '2px', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                                  {ms.startDate && <span>Start: <strong style={{ color: '#334155' }}>{ms.startDate}</strong></span>}
                                  {ms.dueDate && <span>Due: <strong style={{ color: '#334155' }}>{ms.dueDate}</strong></span>}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <InvoiceItems
                items={items}
                onChange={setItems}
                currency={currency}
              />

              <div className="generator-summary-wrap" style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
                <div className="generator-summary" style={{ width: '380px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: 'none' }}>
                  <div className="totals">
                    <div className="tline" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#475569' }}>
                      <span>Current Month Subtotal</span>
                      <strong style={{ color: '#0f172a' }}>{money(totals.subtotal, currency)}</strong>
                    </div>

                    {previousDuesAmount > 0 && includePreviousDues && (
                      <div className="tline dues-tline" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#b45309' }}>
                        <span>Previous Balance / Arrears {previousDuesMonths ? `(${previousDuesMonths})` : ''}</span>
                        <strong>+ {money(previousDuesAmount, currency)}</strong>
                      </div>
                    )}

                    <div className="tline grand" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 16px', borderTop: '1px solid #e2e8f0', marginTop: '6px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      <span>{effectivePreviousDues > 0 ? 'Total Payable (With Previous)' : 'Grand Total'}</span>
                      <span style={{ color: '#0284c7', fontSize: '18px' }}>{money(finalGrandTotal, currency)}</span>
                    </div>
                  </div>
                  <div className="generator-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <Button variant="light" onClick={handlePreview} style={{ borderRadius: '8px', padding: '8px 16px', fontWeight: '600' }}>
                      Preview
                    </Button>
                    <Button variant="primary" onClick={handleGenerateInvoice} style={{ borderRadius: '8px', padding: '8px 18px', fontWeight: '600' }}>
                      Generate Invoice
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '9px',
                border: '1px dashed #cbd5e1',
                fontSize: '12px',
                marginTop: '10px'
              }}
            >
              Select a Client above to load saved items and generate invoice.
            </div>
          )}
        </div>
      </div>

      {/* Invoice Preview Modal */}
      <InvoicePreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={previewData}
        business={getBusiness(previewData?.businessId)}
        customer={getCustomer(previewData?.customerId)}
      />
    </section>
  );
}
