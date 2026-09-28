import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import PaymentModal from '../components/invoice/PaymentModal';
import { downloadInvoiceFile, generateInvoiceHtml } from '../utils/invoice';
import { generateStatementHtml } from '../utils/statement';
import { downloadAndSendWhatsApp, sendPdfToWhatsApp } from '../utils/whatsappPdf';
import { today } from '../utils/formatters';
import { whatsappApi } from '../services/api';

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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleOpenPartialPay = (invoice) => {
    setActiveDropdown(null);
    setPayingInvoice(invoice);
    setIsPaymentModalOpen(true);
  };

  const autoDownloadAndWhatsApp = async (inv, b, c) => {
    const htmlContent = generateInvoiceHtml(inv, { ...b, proposalData: state.settings?.proposalData || b?.proposalData }, c);
    const fileName = `${inv.invoiceNo || 'invoice'}.pdf`;
    const phone = c?.whatsapp || c?.phone;
    const orgBrand = state.settings?.proposalData?.companyName || state.settings?.companyName || 'iSysware';
    const statusNote = inv.status === 'Paid' ? '✅ Full Payment Received' : `💵 Partial Payment Received`;
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

  const handleTakePartialPayment = async (invoiceId, paymentData) => {
    const updated = takePartialPayment(invoiceId, paymentData);
    if (updated) {
      const b = getBusiness(updated.businessId);
      const c = getCustomer(updated.customerId);
      await autoDownloadAndWhatsApp(updated, b, c);
    }
  };

  const handleMarkPaid = async (invoice) => {
    setActiveDropdown(null);
    const updated = markInvoicePaid(invoice.id);
    const b = getBusiness(invoice.businessId);
    const c = getCustomer(invoice.customerId);
    const targetInv = updated || { ...invoice, paid: invoice.total, balance: 0, status: 'Paid' };
    await autoDownloadAndWhatsApp(targetInv, b, c);
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
  const hasFilter = Boolean(query || businessFilter || statusFilter);

  // Filtered search results
  const filteredInvoices = hasFilter
    ? state.invoices.filter((inv) => {
        const c = getCustomer(inv.customerId);
        const b = getBusiness(inv.businessId);
        const searchString = `${inv.invoiceNo} ${c?.name || ''} ${b?.name || ''} ${c?.phone || ''} ${c?.whatsapp || ''}`.toLowerCase();

        const matchesSearch = !query || searchString.includes(query);
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
  const targetInvoices = hasFilter ? filteredInvoices : state.invoices;

  targetInvoices.forEach((inv) => {
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
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

  // Calculate totals for latest payments
  const totalPaymentsFee = latestPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaymentsDiscount = latestPayments.reduce((s, p) => s + Number(p.discount || 0), 0);

  // Primary searched client info for subheader
  const firstCustomer = filteredInvoices.length > 0 ? getCustomer(filteredInvoices[0].customerId) : null;
  const firstBusiness = filteredInvoices.length > 0 ? getBusiness(filteredInvoices[0].businessId) : null;

  return (
    <section id="collections" className="page active" ref={dropdownRef}>
      <div className="panel" style={{ marginBottom: '16px' }}>
        <div className="panel-head">
          <span>Invoice Collection</span>
          <span>Search & Collect Payments</span>
        </div>
        <div className="panel-body">
          {/* Search Controls */}
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div className="grow">
              <label>Search by Name / Phone / Invoice No.</label>
              <input
                id="colSearch"
                className="input"
                placeholder="Client name, phone or invoice number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="sm">
              <label>Business</label>
              <select
                id="colBiz"
                className="select"
                value={businessFilter}
                onChange={(e) => setBusinessFilter(e.target.value)}
              >
                <option value="">All Businesses</option>
                {state.businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm">
              <label>Status</label>
              <select
                id="colStatus"
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!hasFilter ? (
        <div
          style={{
            textAlign: 'center',
            padding: '38px 20px',
            background: '#fff',
            borderRadius: '10px',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
            fontSize: '13px'
          }}
        >
          🔍 Type Client name, phone or invoice number above to view search collection records.
        </div>
      ) : (
        <>
          {/* Search Results Banner */}
          <div className="search-results-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔍 Search Results</span>
            </div>
            <button
              type="button"
              className="btn xs light"
              style={{
                background: '#fff',
                borderColor: '#e5c378',
                color: '#875a00',
                padding: '3px 9px',
                fontSize: '11px',
                fontWeight: 700
              }}
              onClick={() => {
                setSearchTerm('');
                setBusinessFilter('');
                setStatusFilter('');
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Search Results Table */}
          <div
            className="table-wrap"
            style={{
              borderRadius: '0 0 8px 8px',
              borderTop: 0,
              overflow: 'visible'
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>Client Code</th>
                  <th>Month</th>
                  <th>Client</th>
                  <th>Business</th>
                  <th>Fee Type</th>
                  <th>Total</th>
                  <th>Dis</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th style={{ textAlign: 'center', minWidth: '90px' }}>Status</th>
                  <th style={{ textAlign: 'center', minWidth: '132px' }}>Actions</th>
                  <th style={{ textAlign: 'center', minWidth: '44px' }}>More</th>
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
                      <tr key={inv.id} style={{ position: 'relative', zIndex: (isTakeOpen || isMoreOpen) ? 1000 : 'auto' }}>
                        <td>
                          <strong>{inv.invoiceNo}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: 650, color: '#334155', whiteSpace: 'nowrap' }}>
                            {inv.month} {inv.year}
                          </span>
                        </td>
                        <td>{c?.name || '-'}</td>
                        <td>{b?.name || '-'}</td>
                        <td>{titleStr}</td>
                        <td>{formatMoney(invFee, inv.businessId)}</td>
                        <td>{formatMoney(invDis, inv.businessId)}</td>
                        <td>{formatMoney(invPaid, inv.businessId)}</td>
                        <td style={{ color: invDue > 0 ? '#e5483f' : 'inherit', fontWeight: invDue > 0 ? '700' : 'normal' }}>
                          {formatMoney(invDue, inv.businessId)}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <StatusBadge status={inv.status} variant="solid" />
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div className="action-dropdown-wrap" style={{ zIndex: isTakeOpen ? 1000 : 'auto' }}>
                            <button
                              type="button"
                              className="take-payment-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(isTakeOpen ? null : { id: inv.id, type: 'take' });
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                              </svg>
                              <span>Take Payment</span>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </button>

                            {isTakeOpen && (
                              <div className="dropdown-menu">
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => handleMarkPaid(inv)}
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
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-dropdown-wrap" style={{ zIndex: isMoreOpen ? 1000 : 'auto' }}>
                            <button
                              type="button"
                              className="more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(isMoreOpen ? null : { id: inv.id, type: 'more' });
                              }}
                              title="More options"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
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
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    downloadInvoiceFile(inv, b, c);
                                  }}
                                >
                                  <span>📄</span> Download {inv.status === 'Paid' ? 'Paid' : 'Partial'} PDF
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
                    <td colSpan="12" className="empty">
                      No invoices found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredInvoices.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: '750' }}>
                    <td colSpan="5" style={{ textAlign: 'right' }}>
                      Total
                    </td>
                    <td>{formatMoney(totalSubtotal, filteredInvoices[0]?.businessId)}</td>
                    <td>{formatMoney(totalDiscount, filteredInvoices[0]?.businessId)}</td>
                    <td>{formatMoney(totalPaid, filteredInvoices[0]?.businessId)}</td>
                    <td style={{ color: totalDue > 0 ? '#e5483f' : 'inherit', fontWeight: '800' }}>
                      {formatMoney(totalDue, filteredInvoices[0]?.businessId)}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Latest Payments Banner */}
          <div className="latest-payments-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>+ Latest Payments</span>
            </div>
          </div>

          {/* Client Subheader */}
          {firstCustomer && (
            <div
              style={{
                padding: '9px 14px',
                background: '#f1f5f9',
                borderLeft: '1px solid var(--line)',
                borderRight: '1px solid var(--line)',
                fontSize: '12px',
                fontWeight: '700',
                color: '#334155'
              }}
            >
              {firstCustomer.name} ({filteredInvoices[0]?.invoiceNo}) - {firstBusiness?.name || 'Business'}
            </div>
          )}

          {/* Latest Payments Table */}
          <div
            className="table-wrap"
            style={{
              borderRadius: '0 0 8px 8px',
              borderTop: 0,
              marginBottom: '24px',
              overflow: 'visible'
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Month</th>
                  <th>Client</th>
                  <th>Business</th>
                  <th>Title</th>
                  <th>Fee</th>
                  <th>Discount</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Received By</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {latestPayments.length > 0 ? (
                  latestPayments.map((p, idx) => {
                    const isPayActionOpen = activeDropdown?.id === `${p.id}-${idx}` && activeDropdown?.type === 'payAction';
                    const parentInv = state.invoices.find((i) => i.id === p.invoiceId);
                    const b = getBusiness(p.businessId);
                    const c = getCustomer(p.customerId);

                    return (
                      <tr key={`${p.id}-${idx}`} style={{ position: 'relative', zIndex: isPayActionOpen ? 1000 : 'auto' }}>
                        <td>
                          <strong>{p.invoiceNo}</strong>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 650, color: '#334155' }}>
                          {p.month && p.year ? `${p.month} ${p.year}` : '-'}
                        </td>
                        <td>{p.customerName}</td>
                        <td>{p.businessName}</td>
                        <td>{p.title || 'Fee Payment'}</td>
                        <td style={{ color: '#16a34a', fontWeight: '750' }}>
                          {formatMoney(p.amount, p.businessId)}
                        </td>
                        <td>{formatMoney(p.discount || 0, p.businessId)}</td>
                        <td>{p.date || '-'}</td>
                        <td>{p.time || '12:00:00 AM'}</td>
                        <td>{p.receivedBy || 'Admin'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusBadge
                            status={p.kind === 'partial' || p.status === 'Partial' || (parentInv && parentInv.balance > 0) ? 'Partial' : 'Paid'}
                            variant="solid"
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-dropdown-wrap" style={{ zIndex: isPayActionOpen ? 1000 : 'auto' }}>
                            <button
                              type="button"
                              className="more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(isPayActionOpen ? null : { id: `${p.id}-${idx}`, type: 'payAction' });
                              }}
                            >
                              <span>▼</span>
                            </button>

                            {isPayActionOpen && (
                              <div className="dropdown-menu">
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    if (parentInv) downloadInvoiceFile(parentInv, b, c);
                                  }}
                                >
                                  <span>📄</span> Download Receipt
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-item"
                                  onClick={() => {
                                    setActiveDropdown(null);
                                    if (parentInv) handleReversal(parentInv);
                                  }}
                                >
                                  <span style={{ color: '#7c3aed' }}>↶</span> Reverse Payment
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
                    <td colSpan="5" style={{ textAlign: 'right' }}>
                      Total
                    </td>
                    <td style={{ color: '#16a34a' }}>
                      {formatMoney(totalPaymentsFee, latestPayments[0]?.businessId)}
                    </td>
                    <td>{formatMoney(totalPaymentsDiscount, latestPayments[0]?.businessId)}</td>
                    <td colSpan="5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* Partial Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={payingInvoice}
        business={getBusiness(payingInvoice?.businessId)}
        customer={getCustomer(payingInvoice?.customerId)}
        onSubmit={handleTakePartialPayment}
      />
    </section>
  );
}
