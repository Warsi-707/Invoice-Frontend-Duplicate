import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { calculateClientLedger } from '../utils/ledgerExport';
import { MONTHS, YEARS } from '../utils/formatters';

export default function ClientLedgerPage() {
  const {
    state,
    getBusiness,
    formatMoney
  } = useApp();

  // Selected customer for single ledger view (null = members list)
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

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
    return customersList.filter((c) => {
      if (!q) return true;
      const b = getBusiness(c?.businessId);
      return (
        (c?.name && c.name.toLowerCase().includes(q)) ||
        (c?.phone && c.phone.toLowerCase().includes(q)) ||
        (c?.whatsapp && c.whatsapp.toLowerCase().includes(q)) ||
        (b?.name && b.name.toLowerCase().includes(q)) ||
        (c?.address && c.address.toLowerCase().includes(q))
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

  return (
    <section id="client-ledger" className="page active">
      {/* -------------------------------------------------------------
          VIEW 1: CLEAN SIMPLE MEMBERS DIRECTORY
         ------------------------------------------------------------- */}
      {!selectedCustomerId && (
        <div className="panel">
          <div className="panel-head">
            <span>Client Ledger</span>
            <span>Select a member to view their ledger</span>
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
                    <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
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

                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn sm primary"
                              style={{ padding: '4px 12px', fontSize: '11.5px', fontWeight: 600 }}
                              onClick={() => setSelectedCustomerId(c?.id)}
                            >
                              Open Ledger →
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
          <div className="panel" style={{ marginBottom: '14px' }}>
            <div className="panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn sm light"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    padding: '3px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}
                  onClick={() => setSelectedCustomerId(null)}
                >
                  ← Back to List
                </button>
                <span>
                  {selectedCustomer?.name}
                </span>
                <span style={{ fontSize: '11.5px', opacity: 0.85, fontWeight: 500 }}>
                  ({selectedBusiness?.name || 'Business'} {selectedCustomer?.phone ? `• ${selectedCustomer.phone}` : ''})
                </span>
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
          <div className="cards" style={{ marginBottom: '14px' }}>
            <div className="stat">
              <div className="label">Total Invoiced</div>
              <div className="value">
                {formatMoney(currentLedger.totalInvoiced, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Billed charges</div>
            </div>

            <div className="stat">
              <div className="label">Total Paid</div>
              <div className="value">
                {formatMoney(currentLedger.totalPaid, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Payments received</div>
            </div>

            <div className="stat">
              <div className="label">Outstanding</div>
              <div className="value">
                {formatMoney(currentLedger.outstandingBalance, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Unpaid balance</div>
            </div>

            <div className="stat">
              <div className="label">Advance / Credit</div>
              <div className="value">
                {formatMoney(currentLedger.advanceCredit, selectedCustomer?.businessId)}
              </div>
              <div className="hint">Prepaid balance</div>
            </div>

            <div className="stat">
              <div className="label">Invoices</div>
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
                        <td>{r.typeLabel}</td>
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
