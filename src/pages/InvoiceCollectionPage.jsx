import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import PaymentModal from '../components/invoice/PaymentModal';
import { downloadInvoiceFile, generateInvoiceHtml } from '../utils/invoice';
import { generateStatementHtml } from '../utils/statement';
import { downloadAndSendWhatsApp, sendPdfToWhatsApp } from '../utils/whatsappPdf';
import { today } from '../utils/formatters';
import { whatsappApi } from '../services/api';

function renderFeeType(rawTitle, milestoneId) {
  if (!rawTitle) return <span style={{ color: '#64748b' }}>-</span>;

  // 1. Subscription pattern, e.g. "Website Design & Development (MONTHLY Subscription: Due 2026-10-05)"
  const subMatch = rawTitle.match(/^(.*?)\s*\((?:MONTHLY\s+)?Subscription:?\s*(?:Due\s*([^)]+))?\)/i);
  if (subMatch) {
    const mainTitle = subMatch[1].trim();
    const dueDate = subMatch[2]?.trim();
    return (
      <div style={{ lineHeight: '1.2' }}>
        <div style={{ fontWeight: 650, color: '#1e293b', fontSize: '10.5px' }}>{mainTitle}</div>
        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>
          Subscription {dueDate ? `• Due ${dueDate}` : ''}
        </div>
      </div>
    );
  }

  // 2. Milestone pattern, e.g. "Search Engine Optimization (SEO) - Milestone 2"
  const msMatch = rawTitle.match(/^(.*?)\s*-\s*(Milestone\s*\d+.*)$/i);
  if (msMatch) {
    const mainTitle = msMatch[1].trim();
    const msTag = msMatch[2].trim();
    return (
      <div style={{ lineHeight: '1.2' }}>
        <div style={{ fontWeight: 650, color: '#1e293b', fontSize: '10.5px' }}>{mainTitle}</div>
        <div style={{ marginTop: '1px' }}>
          <span
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '9999px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              fontWeight: 650,
              display: 'inline-block'
            }}
          >
            {msTag}
          </span>
        </div>
      </div>
    );
  }

  // 3. Fallback
  return (
    <div style={{ lineHeight: '1.2' }}>
      <div style={{ fontWeight: 650, color: '#1e293b', fontSize: '10.5px' }}>{rawTitle}</div>
      {milestoneId && (
        <div style={{ marginTop: '1px' }}>
          <span
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '9999px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              fontWeight: 650,
              display: 'inline-block'
            }}
          >
            Milestone
          </span>
        </div>
      )}
    </div>
  );
}

export default function InvoiceCollectionPage() {
  const {
    state,
    showToast,
    getBusiness,
    getCustomer,
    getBusinessName,
    getCustomerName,
    formatMoney,
    markInvoicePaid,
    takePartialPayment,
    reversePayment
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [businessFilter, setBusinessFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown state: { id: string, type: 'take' | 'more' | 'payAction' } or null
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [paymentMode, setPaymentMode] = useState('partial'); // 'full' | 'partial'
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-dropdown-wrap')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleOpenFullPay = (invoice) => {
    setActiveDropdown(null);
    setPaymentMode('full');
    setPayingInvoice(invoice);
    setIsPaymentModalOpen(true);
  };

  const handleOpenPartialPay = (invoice) => {
    setActiveDropdown(null);
    setPaymentMode('partial');
    setPayingInvoice(invoice);
    setIsPaymentModalOpen(true);
  };

  const autoDownloadAndWhatsApp = async (inv, b, c) => {
    const htmlContent = generateInvoiceHtml(inv, { ...b, proposalData: state.settings?.proposalData || b?.proposalData }, c);
    const fileName = `${inv.invoiceNo || 'invoice'}.pdf`;
    const phone = c?.whatsapp || c?.phone;
    const orgBrand = state.settings?.proposalData?.companyName || state.settings?.companyName || 'iSysware';
    const latestPay = (inv.payments && inv.payments[inv.payments.length - 1]) || {};
    const methodLabel = latestPay.method ? ` via ${latestPay.method}` : '';
    const statusNote = inv.status === 'Paid' ? `✅ Full Payment Received${methodLabel}` : `💵 Partial Payment Received${methodLabel}`;
    const caption = `📄 *Invoice ${inv.invoiceNo}*\n🏢 ${orgBrand}\n👤 ${c?.name || 'Client'}\n📌 ${statusNote}\n💰 Balance: ${formatMoney(inv.balance, inv.businessId)}`;

    await downloadAndSendWhatsApp({
      htmlContent,
      fileName,
      phone,
      caption,
      onWhatsAppSuccess: () => showToast(`✅ Invoice PDF sent to ${c?.name || 'Client'} via WhatsApp!`)
    });
    showToast('✅ Invoice PDF downloaded!');
  };

  const handlePaymentSubmit = async (invoiceId, paymentData) => {
    let updated;
    if (paymentData.mode === 'full') {
      updated = markInvoicePaid(invoiceId, paymentData);
    } else {
      updated = takePartialPayment(invoiceId, paymentData);
    }
    if (updated) {
      const b = getBusiness(updated.businessId);
      const c = getCustomer(updated.customerId);
      await autoDownloadAndWhatsApp(updated, b, c);
    }
  };

  const handleReversal = (invoice) => {
    setActiveDropdown(null);
    if (!invoice.payments || invoice.payments.length === 0) {
      alert('Is invoice par reverse karne ke liye koi payment record nahi hai.');
      return;
    }
    if (confirm('Latest payment reverse karni hai?')) {
      reversePayment(invoice.id);
    }
  };

  const handleSendWhatsApp = async (invoice) => {
    setActiveDropdown(null);
    const b = getBusiness(invoice.businessId);
    const c = getCustomer(invoice.customerId);

    try {
      const phone = c?.whatsapp || c?.phone;
      if (!phone) {
        alert('Customer does not have a valid WhatsApp/phone number.');
        return;
      }
      showToast('⚡ Sending invoice PDF to WhatsApp...');
      const htmlContent = generateInvoiceHtml(invoice, { ...b, proposalData: state.settings?.proposalData || b?.proposalData }, c);
      const fileName = `${invoice.invoiceNo || 'invoice'}.pdf`;
      const orgBrand = state.settings?.proposalData?.companyName || state.settings?.companyName || 'iSysware';
      const caption = `📄 *Invoice ${invoice.invoiceNo}*\n🏢 ${orgBrand}\n👤 ${c?.name || 'Client'}\n💰 Total: ${formatMoney(invoice.total, invoice.businessId)}`;
      await sendPdfToWhatsApp({ phone, htmlContent, fileName, caption });
      showToast(`✅ WhatsApp PDF sent to ${c?.name || 'Client'}!`);
    } catch (err) {
      alert('WhatsApp send error: ' + (err.message || 'Please link WhatsApp in Settings first.'));
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    setActiveDropdown(null);
    const b = getBusiness(invoice.businessId);
    const c = getCustomer(invoice.customerId);
    try {
      showToast('⚡ Generating and downloading Invoice PDF...');
      await downloadInvoiceFile(invoice, { ...b, proposalData: state.settings?.proposalData || b?.proposalData }, c);
      showToast(`✅ Downloaded Invoice ${invoice.invoiceNo}!`);
    } catch (err) {
      alert('Invoice download error: ' + (err.message || err));
    }
  };

  const handleDownloadStatement = async (c, b) => {
    setActiveDropdown(null);
    if (!c) return;
    try {
      showToast('⚡ Generating Client Account Statement...');
      const html = generateStatementHtml(c, b, state.invoices);
      const cleanName = (c.name || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Statement_${cleanName}_${today()}.pdf`;
      const phone = c.whatsapp || c.phone;
      const custInvoices = state.invoices.filter((i) => String(i.customerId) === String(c.id));
      const totalOutstanding = custInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);
      const orgBrand = state.settings?.proposalData?.companyName || state.settings?.companyName || 'iSysware';
      const caption = `📊 *Account Statement: ${c.name || 'Client'}*\n🏢 ${orgBrand}\n💰 Current Outstanding: ${formatMoney(totalOutstanding, b?.id)}\n📅 Date: ${today()}`;

      await downloadAndSendWhatsApp({
        htmlContent: html,
        fileName,
        phone,
        caption,
        onWhatsAppSuccess: () => showToast(`✅ Statement PDF sent to ${c.name} via WhatsApp!`)
      });
      showToast(`✅ Statement PDF downloaded for ${c.name}!`);
    } catch (err) {
      alert('Statement error: ' + err.message);
    }
  };

  const handleShare = (invoice) => {
    setActiveDropdown(null);
    const bName = getBusinessName(invoice.businessId);
    const cName = getCustomerName(invoice.customerId);
    const text = `Invoice ${invoice.invoiceNo} | ${bName} | ${cName} | Total ${formatMoney(invoice.total, invoice.businessId)} | Status ${invoice.status}`;

    if (navigator.share) {
      navigator.share({ title: invoice.invoiceNo, text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => alert('Invoice details copied for sharing.'))
        .catch(() => alert(text));
    } else {
      alert(text);
    }
  };

  const query = searchTerm.trim().toLowerCase();
  const hasFilter = Boolean(query);

  // Filtered invoices: only populate when user searches, otherwise empty by default
  const filteredInvoices = query
    ? state.invoices.filter((inv) => {
        const c = getCustomer(inv.customerId);
        const b = getBusiness(inv.businessId);
        const searchString = `${inv.invoiceNo} ${c?.name || ''} ${b?.name || ''} ${c?.phone || ''} ${c?.whatsapp || ''}`.toLowerCase();

        const matchesSearch = searchString.includes(query);
        const matchesBusiness = !businessFilter || inv.businessId === businessFilter;
        const matchesStatus = !statusFilter || inv.status === statusFilter;

        return matchesSearch && matchesBusiness && matchesStatus;
      })
    : [];

  // Calculate totals for search results
  const totalSubtotal = filteredInvoices.reduce((s, i) => s + Number(i.subtotal || i.total || 0), 0);
  const totalDiscount = filteredInvoices.reduce((s, i) => s + Number(i.discount || 0), 0);
  const totalPaid = filteredInvoices.reduce((s, i) => s + Number(i.paid || 0), 0);
  // Own balance = current invoice amount only (subtotal - paid), excludes previousDues to avoid double counting
  const totalDue = filteredInvoices.reduce((s, i) => {
    const ownBalance = Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0));
    return s + ownBalance;
  }, 0);
  const totalGenerated = filteredInvoices.reduce((s, i) => s + Number(i.total || 0), 0);

  // Find payments related to filtered invoices or searched clients
  const latestPayments = [];
  const targetInvoices = query ? filteredInvoices : [];

  targetInvoices.forEach((inv) => {
    if (inv.payments && inv.payments.length > 0) {
      [...inv.payments].reverse().forEach((p) => {
        latestPayments.push({
          ...p,
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          month: inv.month,
          year: inv.year,
          businessId: inv.businessId,
          customerId: inv.customerId,
          businessName: getBusinessName(inv.businessId),
          customerName: getCustomerName(inv.customerId),
          currency: getBusiness(inv.businessId)?.currency || 'PKR'
        });
      });
    }
  });

  // Calculate totals for latest payments matching top table's structure
  const totalPaymentsTotal = latestPayments.reduce((s, p) => {
    const parent = state.invoices.find((i) => i.id === p.invoiceId);
    return s + Number(parent?.subtotal || parent?.total || p.amount || 0);
  }, 0);
  const totalPaymentsDiscount = latestPayments.reduce((s, p) => s + Number(p.discount || 0), 0);
  const totalPaymentsPaid = latestPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaymentsDue = latestPayments.reduce((s, p) => {
    const parent = state.invoices.find((i) => i.id === p.invoiceId);
    const d = parent ? Math.max(0, Number(parent.subtotal || parent.total || 0) - Number(parent.discount || 0) - Number(parent.paid || 0)) : 0;
    return s + d;
  }, 0);

  // Primary searched client info for subheader
  const firstCustomer = filteredInvoices.length > 0 ? getCustomer(filteredInvoices[0].customerId) : null;
  const firstBusiness = filteredInvoices.length > 0 ? getBusiness(filteredInvoices[0].businessId) : null;

  return (
    <section id="collections" className="page active" ref={dropdownRef}>
      {/* Reference Subheader Segmented Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn light sm"
            onClick={() => {
              setSearchTerm('');
              setBusinessFilter('');
              setStatusFilter('');
            }}
            style={{ borderRadius: '9999px', padding: '6px 16px', fontWeight: 600 }}
          >
            Overview
          </button>
          <button
            type="button"
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1.5px solid #0284c7',
              background: '#f0f9ff',
              color: '#0284c7'
            }}
          >
            Transactions
          </button>
          <button
            type="button"
            className="btn light sm"
            onClick={() => setStatusFilter('')}
            style={{ borderRadius: '9999px', padding: '6px 16px', fontWeight: 600 }}
          >
            Invoices
          </button>
        </div>

        {/* Quick Search & Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
            {query
              ? `${filteredInvoices.length} transaction${filteredInvoices.length !== 1 ? 's' : ''} found`
              : 'Search to view collections'}
          </span>
          {hasFilter && (
            <button
              type="button"
              className="btn light xs"
              onClick={() => {
                setSearchTerm('');
                setBusinessFilter('');
                setStatusFilter('');
              }}
              style={{ borderRadius: '9999px', padding: '4px 12px', color: '#ef4444' }}
            >
              ✕ Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Main Transactions Surface Card (Matching Reference Image) */}
      <div className="panel" style={{ border: '1px solid #e8edf2', borderRadius: '18px', overflow: 'visible', marginBottom: '22px' }}>
        {/* Card Header with Category & Status Filters */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 750, color: '#0f172a' }}>
              Transactions &amp; Collections
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Record client fee collections, partial payments, and receipts
            </span>
          </div>

          {/* Filter Pills matching Reference ("All Categories", "Paid", "Pending", etc.) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: '', label: 'All Invoices' },
              { id: 'Paid', label: 'Paid' },
              { id: 'Unpaid', label: 'Pending / Unpaid' },
              { id: 'Partial', label: 'Partial' }
            ].map((f) => {
              const isActive = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${isActive ? '#0284c7' : '#e2e8f0'}`,
                    background: isActive ? '#f0f9ff' : '#ffffff',
                    color: isActive ? '#0284c7' : '#64748b',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {f.label}
                </button>
              );
            })}

            {/* Business Dropdown Filter */}
            <select
              id="colBiz"
              className="select"
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value)}
              style={{
                width: 'auto',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                color: businessFilter ? '#0284c7' : '#64748b',
                background: businessFilter ? '#f0f9ff' : '#ffffff',
                borderColor: businessFilter ? '#0284c7' : '#e2e8f0',
                cursor: 'pointer'
              }}
            >
              <option value="">All Businesses</option>
              {state.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input Filter Toolbar */}
        <div style={{ padding: '14px 22px', background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative', maxWidth: '440px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="colSearch"
              className="input"
              placeholder="Search by client name, phone or invoice number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              style={{
                paddingLeft: '36px',
                borderRadius: '9999px',
                fontSize: '12.5px',
                background: '#ffffff'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Transactions Table (Matching Reference Style, No Horizontal Scroll, Clean Spacing) */}
        <div
          className="table-wrap"
          style={{
            borderRadius: 0,
            border: 'none',
            overflow: 'visible',
            width: '100%',
            boxShadow: 'none'
          }}
        >
          <table style={{ width: '100%', minWidth: 'unset', tableLayout: 'auto', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 5px', paddingLeft: '12px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Client Code</th>
                <th style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Month</th>
                <th style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Client</th>
                <th style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Business</th>
                <th style={{ padding: '6px 5px', fontSize: '10px', letterSpacing: '0.04em' }}>Fee Type</th>
                <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Total</th>
                <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Dis</th>
                <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Paid</th>
                <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Due</th>
                <th style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Status</th>
                <th style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em', width: '96px', minWidth: '96px' }}>Actions</th>
                <th style={{ padding: '6px 3px', paddingRight: '10px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.04em', width: '32px', minWidth: '32px' }}>More</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const c = getCustomer(inv.customerId);
                  const b = getBusiness(inv.businessId);
                  const titleStr = inv.items?.[0]?.name || `Monthly Fee - ${inv.month} ${inv.year}`;
                  const invFee = Number(inv.subtotal || inv.total || 0);
                  const invDis = Number(inv.discount || 0);
                  const invPaid = Number(inv.paid || 0);
                  const invDue = Math.max(0, invFee - invDis - invPaid);

                  const isTakeOpen = activeDropdown?.id === inv.id && activeDropdown?.type === 'take';
                  const isMoreOpen = activeDropdown?.id === inv.id && activeDropdown?.type === 'more';

                  return (
                    <tr key={inv.id}>
                      <td style={{ padding: '6px 5px', paddingLeft: '12px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        <strong>{inv.invoiceNo}</strong>
                      </td>
                      <td style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '11px', color: '#334155', fontWeight: 650 }}>
                        {inv.month} {inv.year}
                      </td>
                      <td style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '11px', color: '#0f172a' }}>
                        {c?.name || '-'}
                      </td>
                      <td style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>
                        {b?.name || '-'}
                      </td>
                      <td style={{ padding: '6px 5px' }}>
                        {renderFeeType(titleStr, inv.milestoneId)}
                      </td>
                      <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {formatMoney(invFee, inv.businessId)}
                      </td>
                      <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {formatMoney(invDis, inv.businessId)}
                      </td>
                      <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {formatMoney(invPaid, inv.businessId)}
                      </td>
                      <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px', color: invDue > 0 ? '#e5483f' : 'inherit', fontWeight: invDue > 0 ? '700' : 'normal' }}>
                        {formatMoney(invDue, inv.businessId)}
                      </td>
                      <td style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={inv.status} variant="solid" />
                      </td>
                      <td style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap', width: '96px', minWidth: '96px' }}>
                        <div className="action-dropdown-wrap" style={{ position: 'relative', zIndex: isTakeOpen ? 1000 : 1 }}>
                          <button
                            type="button"
                            className="take-payment-btn"
                            style={{
                              height: '23px',
                              minWidth: 'auto',
                              padding: '0 7px',
                              fontSize: '10.5px',
                              gap: '3px',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(isTakeOpen ? null : { id: inv.id, type: 'take' });
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            <span>Take Payment</span>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>

                          {isTakeOpen && (
                            <div className="dropdown-menu">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleOpenFullPay(inv)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                <span>Full Payment</span>
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleOpenPartialPay(inv)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><circle cx="18" cy="14" r="1"/></svg>
                                <span>Partial Payment</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '6px 3px', paddingRight: '10px', textAlign: 'center', whiteSpace: 'nowrap', width: '32px', minWidth: '32px' }}>
                        <div className="action-dropdown-wrap" style={{ position: 'relative', zIndex: isMoreOpen ? 1000 : 1 }}>
                          <button
                            type="button"
                            className="more-btn"
                            style={{ width: '22px', height: '22px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(isMoreOpen ? null : { id: inv.id, type: 'more' });
                            }}
                            title="More options"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2.2"></circle>
                              <circle cx="12" cy="12" r="2.2"></circle>
                              <circle cx="12" cy="19" r="2.2"></circle>
                            </svg>
                          </button>

                          {isMoreOpen && (
                            <div className="dropdown-menu">
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleSendWhatsApp(inv)}
                                style={{ color: '#059669', fontWeight: 650 }}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                <span>Send via WhatsApp</span>
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleDownloadInvoice(inv)}
                              >
                                <span>📄</span> Download Invoice PDF
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleShare(inv)}
                              >
                                <span>🔗</span> Share Details
                              </button>
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => handleReversal(inv)}
                              >
                                <span style={{ color: '#7c3aed' }}>↶</span> Reversal
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="12" className="empty" style={{ padding: '48px 20px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <span style={{ fontSize: '13.5px', fontWeight: 650, color: '#334155' }}>
                        {query ? 'No invoices found matching your search.' : 'Search by client name, phone or invoice number to view collections'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {query ? 'Try searching with a different client name or invoice number.' : 'Start typing in the search bar above to see client invoices and record payments.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredInvoices.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: '750' }}>
                  <td colSpan="5" style={{ textAlign: 'right', padding: '6px 5px', paddingLeft: '12px', fontSize: '11px' }}>
                    Total
                  </td>
                  <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>{formatMoney(totalSubtotal, filteredInvoices[0]?.businessId)}</td>
                  <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>{formatMoney(totalDiscount, filteredInvoices[0]?.businessId)}</td>
                  <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>{formatMoney(totalPaid, filteredInvoices[0]?.businessId)}</td>
                  <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px', color: totalDue > 0 ? '#e5483f' : 'inherit', fontWeight: '800' }}>
                    {formatMoney(totalDue, filteredInvoices[0]?.businessId)}
                  </td>
                  <td colSpan="2"></td>
                  <td style={{ paddingRight: '10px' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>

        {/* Latest Payments History Section (Shown only when searching and payments exist) */}
        {Boolean(query && latestPayments.length > 0) && (
          <div className="panel" style={{ border: '1px solid #e8edf2', borderRadius: '18px', overflow: 'visible', marginBottom: '24px' }}>
            <div className="latest-payments-banner" style={{ borderRadius: 0, marginTop: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>+ Latest Payments &amp; Receipts</span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--green-pill-text)' }}>
                {latestPayments.length} recorded receipt{latestPayments.length !== 1 ? 's' : ''}
              </span>
            </div>

          {/* Client Subheader */}
          {firstCustomer && (
            <div
              style={{
                padding: '10px 18px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '12px',
                fontWeight: '700',
                color: '#334155'
              }}
            >
              {firstCustomer.name} ({filteredInvoices[0]?.invoiceNo}) - {firstBusiness?.name || 'Business'}
            </div>
          )}

          {/* Latest Payments Table (Identical structure and styling to top table) */}
          <div
            className="table-wrap"
            style={{
              borderRadius: 0,
              border: 'none',
              overflow: 'visible',
              width: '100%',
              boxShadow: 'none'
            }}
          >
            <table style={{ width: '100%', minWidth: 'unset', tableLayout: 'auto', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 5px', paddingLeft: '12px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Client Code</th>
                  <th style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Month</th>
                  <th style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Client</th>
                  <th style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Business</th>
                  <th style={{ padding: '6px 5px', fontSize: '10px', letterSpacing: '0.04em' }}>Fee Type</th>
                  <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Total</th>
                  <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Dis</th>
                  <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Paid</th>
                  <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Due</th>
                  <th style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em' }}>Status</th>
                  <th style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '10px', letterSpacing: '0.04em', width: '96px', minWidth: '96px' }}>Actions</th>
                  <th style={{ padding: '6px 3px', paddingRight: '10px', textAlign: 'center', fontSize: '10px', letterSpacing: '0.04em', width: '32px', minWidth: '32px' }}>More</th>
                </tr>
              </thead>
              <tbody>
                {latestPayments.length > 0 ? (
                  latestPayments.map((p, idx) => {
                    const rowKey = p.id || `${p.invoiceId || 'pay'}-${idx}`;
                    const isMoreOpen = activeDropdown?.id === rowKey && activeDropdown?.type === 'payMore';
                    const parentInv = state.invoices.find((i) => i.id === p.invoiceId);
                    const b = getBusiness(p.businessId);
                    const c = getCustomer(p.customerId);
                    const invFee = Number(parentInv?.subtotal || parentInv?.total || p.amount || 0);
                    const invDis = Number(p.discount || 0);
                    const invPaid = Number(p.amount || 0);
                    const invDue = parentInv ? Math.max(0, Number(parentInv.subtotal || parentInv.total || 0) - Number(parentInv.discount || 0) - Number(parentInv.paid || 0)) : 0;
                    const feeTitle = p.title || parentInv?.items?.[0]?.name || `Fee Payment - ${p.month} ${p.year}`;

                    return (
                      <tr key={rowKey} style={{ position: 'relative', zIndex: isMoreOpen ? 1000 : 'auto' }}>
                        <td style={{ padding: '6px 5px', paddingLeft: '12px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                          <strong>{p.invoiceNo}</strong>
                        </td>
                        <td style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '11px', color: '#334155', fontWeight: 650 }}>
                          <div>{p.month && p.year ? `${p.month} ${p.year}` : (parentInv ? `${parentInv.month} ${parentInv.year}` : '-')}</div>
                          {p.date && (
                            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 400, marginTop: '1px' }}>
                              {p.date}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '11px', color: '#0f172a' }}>
                          {p.customerName || c?.name || '-'}
                        </td>
                        <td style={{ padding: '6px 5px', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>
                          {p.businessName || b?.name || '-'}
                        </td>
                        <td style={{ padding: '6px 5px' }}>
                          {renderFeeType(feeTitle, parentInv?.milestoneId)}
                        </td>
                        <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                          {formatMoney(invFee, p.businessId)}
                        </td>
                        <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                          {formatMoney(invDis, p.businessId)}
                        </td>
                        <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                          {formatMoney(invPaid, p.businessId)}
                        </td>
                        <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px', color: invDue > 0 ? '#e5483f' : 'inherit', fontWeight: invDue > 0 ? '700' : 'normal' }}>
                          {formatMoney(invDue, p.businessId)}
                        </td>
                        <td style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <StatusBadge
                            status={p.kind === 'partial' || p.status === 'Partial' || (parentInv && parentInv.balance > 0) ? 'Partial' : 'Paid'}
                            variant="solid"
                          />
                          {p.receivedBy && (
                            <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '1px' }}>
                              By {p.receivedBy}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 3px', textAlign: 'center', whiteSpace: 'nowrap', width: '96px', minWidth: '96px' }}>
                          <button
                            type="button"
                            className="take-payment-btn"
                            style={{
                              height: '23px',
                              minWidth: 'auto',
                              padding: '0 8px',
                              fontSize: '10.5px',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                              background: '#0284c7',
                              borderColor: '#0284c7'
                            }}
                            onClick={() => {
                              if (parentInv) downloadInvoiceFile(parentInv, b, c);
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            <span>Receipt PDF</span>
                          </button>
                        </td>
                        <td style={{ padding: '6px 3px', paddingRight: '10px', textAlign: 'center', whiteSpace: 'nowrap', width: '32px', minWidth: '32px' }}>
                          <div className="action-dropdown-wrap" style={{ position: 'relative', zIndex: isMoreOpen ? 1000 : 1 }}>
                            <button
                              type="button"
                              className="more-btn"
                              style={{ width: '22px', height: '22px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(isMoreOpen ? null : { id: rowKey, type: 'payMore' });
                              }}
                              title="More options"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2.2"></circle>
                                <circle cx="12" cy="12" r="2.2"></circle>
                                <circle cx="12" cy="19" r="2.2"></circle>
                              </svg>
                            </button>

                            {isMoreOpen && (
                              <div
                                className="dropdown-menu"
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  bottom: 'calc(100% + 4px)',
                                  top: 'auto',
                                  zIndex: 9999,
                                  minWidth: '185px',
                                  boxShadow: 'none',
                                  border: '1px solid #cbd5e1'
                                }}
                              >
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    if (parentInv) handleSendWhatsApp(parentInv);
                                  }}
                                  style={{ color: '#059669', fontWeight: 650 }}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                  <span>Send via WhatsApp</span>
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    if (parentInv) handleDownloadInvoice(parentInv);
                                  }}
                                >
                                  <span>📄</span> Download Invoice PDF
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    if (parentInv) handleShare(parentInv);
                                  }}
                                >
                                  <span>🔗</span> Share Details
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    if (parentInv) handleReversal(parentInv);
                                  }}
                                >
                                  <span style={{ color: '#7c3aed' }}>↶</span> Reversal
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="12" className="empty">
                      No payment transactions recorded for this client yet.
                    </td>
                  </tr>
                )}
              </tbody>
              {latestPayments.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: '750' }}>
                    <td colSpan="5" style={{ textAlign: 'right', padding: '6px 5px', paddingLeft: '12px', fontSize: '11px' }}>
                      Total
                    </td>
                    <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                      {formatMoney(totalPaymentsTotal, latestPayments[0]?.businessId)}
                    </td>
                    <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                      {formatMoney(totalPaymentsDiscount, latestPayments[0]?.businessId)}
                    </td>
                    <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px' }}>
                      {formatMoney(totalPaymentsPaid, latestPayments[0]?.businessId)}
                    </td>
                    <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '11px', color: totalPaymentsDue > 0 ? '#e5483f' : 'inherit', fontWeight: '800' }}>
                      {formatMoney(totalPaymentsDue, latestPayments[0]?.businessId)}
                    </td>
                    <td colSpan="2"></td>
                    <td style={{ paddingRight: '10px' }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal (Full & Partial with Online Bank Details) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={payingInvoice}
        business={getBusiness(payingInvoice?.businessId)}
        customer={getCustomer(payingInvoice?.customerId)}
        mode={paymentMode}
        onSubmit={handlePaymentSubmit}
      />
    </section>
  );
}
