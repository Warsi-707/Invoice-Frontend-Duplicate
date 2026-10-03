import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import {
  calculateClientLedger,
  generateLedgerStatementHtml,
  exportLedgerToExcel,
  printLedgerStatement
} from '../utils/ledgerExport';
import { downloadAsPdf, sendPdfToWhatsApp } from '../utils/whatsappPdf';
import { MONTHS, YEARS } from '../utils/formatters';

export default function ClientLedgerPage() {
  const {
    state,
    getBusiness,
    formatMoney,
    selectedLedgerCustomerId,
    setSelectedLedgerCustomerId
  } = useApp();

  // Selected customer for single ledger view (null = members list)
  const [selectedCustomerId, setSelectedCustomerIdLocal] = useState(selectedLedgerCustomerId || null);

  // Sync with context-driven navigation (from notification click)
  useEffect(() => {
    if (selectedLedgerCustomerId) {
      setSelectedCustomerIdLocal(selectedLedgerCustomerId);
      setSelectedLedgerCustomerId(null); // clear so it doesn't re-trigger
    }
  }, [selectedLedgerCustomerId, setSelectedLedgerCustomerId]);

  const setSelectedCustomerId = (id) => {
    setSelectedCustomerIdLocal(id);
  };

  // Search in member list
  const [searchTerm, setSearchTerm] = useState('');

  // Ledger Detail Filters
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');

  const customersList = Array.isArray(state?.customers) ? state.customers : [];
  const invoicesList = Array.isArray(state?.invoices) ? state.invoices : [];

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return customersList;

    const matchesPrefix = (text, query) => {
      if (!text || !query) return false;
      const str = String(text).trim().toLowerCase();
      if (str.startsWith(query)) return true;
      const words = str.split(/[\s\-_/.]+/);
      return words.some((w) => w.startsWith(query));
    };

    const qClean = q.replace(/\D/g, '');

    return customersList.filter((c) => {
      const b = getBusiness(c?.businessId);
      const phoneClean = (c?.phone || '').replace(/\D/g, '');
      const waClean = (c?.whatsapp || '').replace(/\D/g, '');
      const matchPhone = qClean && (phoneClean.startsWith(qClean) || waClean.startsWith(qClean));

      return (
        matchesPrefix(c?.name, q) ||
        matchesPrefix(c?.company, q) ||
        matchesPrefix(b?.name, q) ||
        matchPhone
      );
    });
  }, [customersList, searchTerm, getBusiness]);

  // Selected customer data for detail view
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customersList.find((c) => String(c?.id) === String(selectedCustomerId)) || null;
  }, [selectedCustomerId, customersList]);

  const selectedBusiness = useMemo(() => {
    if (!selectedCustomer) return null;
    return getBusiness(selectedCustomer?.businessId);
  }, [selectedCustomer, getBusiness]);

  const currentLedger = useMemo(() => {
    if (!selectedCustomer) return null;
    return calculateClientLedger(selectedCustomer, selectedBusiness, invoicesList, {
      selectedMonth,
      selectedYear,
      fromDate,
      toDate,
      transactionType: 'all',
      searchQuery: ledgerSearchQuery
    });
  }, [selectedCustomer, selectedBusiness, invoicesList, selectedMonth, selectedYear, fromDate, toDate, ledgerSearchQuery]);

  // Export & Print Handlers
  const handlePrintLedger = () => {
    if (!selectedCustomer || !selectedBusiness || !currentLedger) return;
    const html = generateLedgerStatementHtml(selectedCustomer, selectedBusiness, invoicesList, {
      selectedMonth,
      selectedYear,
      fromDate,
      toDate,
      searchQuery: ledgerSearchQuery
    });
    printLedgerStatement(html);
  };

  const handleDownloadPdf = async () => {
    if (!selectedCustomer || !selectedBusiness || !currentLedger) return;
    const html = generateLedgerStatementHtml(selectedCustomer, selectedBusiness, invoicesList, {
      selectedMonth,
      selectedYear,
      fromDate,
      toDate,
      searchQuery: ledgerSearchQuery
    });
    const cleanName = (selectedCustomer.name || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
    await downloadAsPdf(html, `Ledger_${cleanName}.pdf`);
  };

  const handleExportExcel = () => {
    if (!selectedCustomer || !selectedBusiness || !currentLedger) return;
    exportLedgerToExcel(selectedCustomer, selectedBusiness, invoicesList, {
      selectedMonth,
      selectedYear,
      fromDate,
      toDate,
      searchQuery: ledgerSearchQuery
    });
  };

  const handleSendWhatsApp = async () => {
    if (!selectedCustomer || !selectedBusiness || !currentLedger) return;
    const phone = selectedCustomer.whatsapp || selectedCustomer.phone;
    if (!phone) {
      alert('No phone number registered for this client.');
      return;
    }
    const html = generateLedgerStatementHtml(selectedCustomer, selectedBusiness, invoicesList, {
      selectedMonth,
      selectedYear,
      fromDate,
      toDate,
      searchQuery: ledgerSearchQuery
    });
    const cleanName = (selectedCustomer.name || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
    await sendPdfToWhatsApp(html, phone, `Ledger Statement for ${selectedCustomer.name}`, `Ledger_${cleanName}.pdf`);
  };

  return (
    <section id="client-ledger" className="page active">
      {/* -------------------------------------------------------------
          VIEW 1: CLEAN SIMPLE MEMBERS DIRECTORY
         ------------------------------------------------------------- */}
      {!selectedCustomerId && (
        <div className="panel">
          <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>Client Financial Ledger</span>
              <span style={{ fontSize: '11px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                {filteredMembers.length} Members
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Select a member to view their complete financial ledger</span>
          </div>

          <div className="panel-body">
            {/* Search Toolbar */}
            <div className="toolbar" style={{ marginBottom: '14px' }}>
              <div className="grow">
                <label>Search Member / Client Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="ledgerSearch"
                    className="input"
                    placeholder="Search by member name, phone or business..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoComplete="off"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '13px'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Simple Clean Members Table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                    <th>Member Name</th>
                    <th>Phone / WhatsApp</th>
                    <th>Business</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((c, idx) => {
                      const b = getBusiness(c?.businessId);

                      return (
                        <tr
                          key={c?.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedCustomerId(c?.id)}
                        >
                          <td style={{ textAlign: 'center' }}>
                            {idx + 1}
                          </td>

                          <td>
                            <strong>{c?.name}</strong>
                          </td>

                          <td>
                            {c?.phone || c?.whatsapp || '-'}
                          </td>

                          <td>
                            {b?.name || '-'}
                          </td>

                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '130px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerId(c?.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                padding: '0 12px',
                                height: '26px',
                                fontSize: '11px',
                                fontWeight: 650,
                                background: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '9999px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span>Open Ledger</span>
                              <span style={{ fontSize: '12px' }}>→</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty">
                        No members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          VIEW 2: SIMPLE CLEAN CLIENT LEDGER DATA VIEW
         ------------------------------------------------------------- */}
      {selectedCustomerId && selectedCustomer && currentLedger && (
        <>
          {/* Top Panel: Header & Member Info */}
          <div className="panel" style={{ marginBottom: '16px' }}>
            <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#f1f5f9',
                    color: '#1e293b',
                    border: '1px solid #e2e8f0',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedCustomerId(null)}
                >
                  ← Back to Members
                </button>
                <span style={{ fontWeight: '700', fontSize: '16px', color: '#0f172a' }}>
                  {selectedCustomer?.name}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  ({selectedBusiness?.name || 'Business'} {selectedCustomer?.phone ? `• ${selectedCustomer.phone}` : ''})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handlePrintLedger}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '12px',
                    background: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  🖨️ Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '12px',
                    background: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  📄 PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    fontSize: '12px',
                    background: '#ffffff',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  📊 Excel
                </button>
                {(selectedCustomer?.whatsapp || selectedCustomer?.phone) && (
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      fontSize: '12px',
                      background: '#eaf5ee',
                      color: '#047857',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    💬 WhatsApp
                  </button>
                )}
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="panel-body">
              <div className="toolbar" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ width: '160px' }}>
                  <label>Select Month</label>
                  <select
                    className="select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    <option value="all">All 12 Months</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '120px' }}>
                  <label>Select Year</label>
                  <select
                    className="select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    <option value="all">All Years</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm">
                  <label>From Date</label>
                  <input
                    type="date"
                    className="input"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>

                <div className="sm">
                  <label>To Date</label>
                  <input
                    type="date"
                    className="input"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>

                <div className="grow">
                  <label>Search in Ledger</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search voucher, description or item..."
                    value={ledgerSearchQuery}
                    onChange={(e) => setLedgerSearchQuery(e.target.value)}
                  />
                </div>

                {(selectedMonth !== 'all' || selectedYear !== 'all' || fromDate || toDate || ledgerSearchQuery) && (
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn sm light"
                      style={{ padding: '6px 12px', fontSize: '11.5px', marginBottom: '2px' }}
                      onClick={() => {
                        setSelectedMonth('all');
                        setSelectedYear('all');
                        setFromDate('');
                        setToDate('');
                        setLedgerSearchQuery('');
                      }}
                    >
                      ✕ Reset Filter
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Simple Clean KPI Cards */}
          <div className="cards" style={{ marginBottom: '16px' }}>
            <div className="stat">
              <div className="label">Total Invoiced</div>
              <div className="value" style={{ color: '#0f172a' }}>
                {formatMoney(currentLedger.totalInvoiced, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Billed charges</div>
            </div>

            <div className="stat">
              <div className="label">Total Paid</div>
              <div className="value" style={{ color: '#0284c7' }}>
                {formatMoney(currentLedger.totalPaid, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Payments received</div>
            </div>

            <div className="stat">
              <div className="label">Outstanding</div>
              <div className="value" style={{ color: currentLedger.outstandingBalance > 0 ? '#dc2626' : '#0284c7' }}>
                {formatMoney(currentLedger.outstandingBalance, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Unpaid balance</div>
            </div>

            <div className="stat">
              <div className="label">Advance / Credit</div>
              <div className="value" style={{ color: '#0284c7' }}>
                {formatMoney(currentLedger.advanceCredit, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Prepaid balance</div>
            </div>

            <div className="stat">
              <div className="label">Invoices Count</div>
              <div className="value">
                {currentLedger.invoicesCount || 0}
              </div>
              <div className="hint">{currentLedger.totalTransactionsCount || 0} transactions</div>
            </div>
          </div>

          {/* Simple Clean Transactions Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice / Ref #</th>
                  <th>Type</th>
                  <th>Description / Particulars</th>
                  <th style={{ textAlign: 'right' }}>Debit (+)</th>
                  <th style={{ textAlign: 'right' }}>Credit (-)</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row if fromDate is filtered */}
                {fromDate && (
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td>{fromDate}</td>
                    <td><strong>B/F</strong></td>
                    <td>Opening Balance</td>
                    <td>Balance brought forward prior to {fromDate}</td>
                    <td style={{ textAlign: 'right' }}>
                      {currentLedger.openingBalance > 0
                        ? formatMoney(currentLedger.openingBalance, selectedCustomer?.businessId)
                        : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {currentLedger.openingBalance < 0
                        ? formatMoney(Math.abs(currentLedger.openingBalance), selectedCustomer?.businessId)
                        : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatMoney(currentLedger.openingBalance, selectedCustomer?.businessId)}
                    </td>
                    <td style={{ textAlign: 'center' }}>-</td>
                  </tr>
                )}

                {currentLedger.ledgerRows && currentLedger.ledgerRows.length > 0 ? (
                  currentLedger.ledgerRows.map((r) => {
                    return (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>
                          <strong>{r.ref}</strong>
                        </td>
                        <td>
                          {r.typeLabel}
                          {r.rawInvoice?.milestoneId && (
                            <span
                              style={{
                                fontSize: '10px',
                                marginLeft: '6px',
                                padding: '2px 7px',
                                borderRadius: '9999px',
                                verticalAlign: 'middle',
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                                fontWeight: 600,
                                display: 'inline-block'
                              }}
                            >
                              Milestone
                            </span>
                          )}
                        </td>
                        <td>
                          <div>{r.description}</div>
                          {r.monthYear !== '-' && (
                            <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                              {r.monthYear} {r.method !== '-' ? `• ${r.method}` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {r.debit > 0 ? formatMoney(r.debit, selectedCustomer?.businessId) : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {r.credit > 0 ? formatMoney(r.credit, selectedCustomer?.businessId) : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatMoney(r.balance !== undefined ? r.balance : (r.debit - r.credit), selectedCustomer?.businessId)}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="empty">
                      No ledger transactions recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan="4" style={{ textAlign: 'right' }}>
                    Total:
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(currentLedger.totalInvoiced, selectedCustomer?.businessId)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(currentLedger.totalPaid, selectedCustomer?.businessId)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatMoney(currentLedger.closingBalance, selectedCustomer?.businessId)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
