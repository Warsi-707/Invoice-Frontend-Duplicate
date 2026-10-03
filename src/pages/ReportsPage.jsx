import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { money } from '../utils/formatters';
import { exportFullReportToExcel, exportSingleSectionToExcel } from '../utils/excelExport';

export default function ReportsPage() {
  const { state, getBusinessName, getCustomerName, formatMoney, getCurrency } = useApp();

  const [businessFilter, setBusinessFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Section view mode: 'collected' | 'paid' | 'unpaid' | 'all' | 'stacked'
  const [activeTab, setActiveTab] = useState('collected');

  // Filter invoices based on user selections
  const filteredInvoices = state.invoices.filter((inv) => {
    const matchesBiz = !businessFilter || inv.businessId === businessFilter;
    const matchesFrom = !fromDate || inv.date >= fromDate;
    const matchesTo = !toDate || inv.date <= toDate;
    const matchesStatus = !statusFilter || inv.status === statusFilter;

    const clientName = (getCustomerName(inv.customerId) || '').toLowerCase();
    const invNo = (inv.invoiceNo || '').toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || clientName.includes(query) || invNo.includes(query);

    return matchesBiz && matchesFrom && matchesTo && matchesStatus && matchesSearch;
  });

  // Enrich invoices with names
  const enrichedInvoices = filteredInvoices.map((inv) => ({
    ...inv,
    businessName: getBusinessName(inv.businessId),
    customerName: getCustomerName(inv.customerId)
  }));

  // Build complete collection records (all payments from filtered invoices)
  const allPayments = enrichedInvoices.flatMap((inv) =>
    (inv.payments || []).map((p, idx) => ({
      ...p,
      uniqueKey: `${inv.id}-${idx}`,
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      date: p.date || inv.date,
      businessId: inv.businessId,
      customerId: inv.customerId,
      businessName: inv.businessName,
      customerName: inv.customerName,
      invoiceTotal: inv.total,
      currency: getCurrency(inv.businessId)
    }))
  );

  // Categorize invoices into Paid and Unpaid / Pending
  const paidInvoices = enrichedInvoices.filter((i) => i.status === 'Paid');
  const unpaidInvoices = enrichedInvoices.filter((i) => i.status !== 'Paid');

  // Summary Metrics
  const totalCollected = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const onlineCollected = allPayments
    .filter((p) => {
      const m = (p.method || '').toLowerCase();
      return m.includes('online') || m.includes('bank');
    })
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashCollected = allPayments
    .filter((p) => {
      const m = (p.method || '').toLowerCase();
      return !m.includes('online') && !m.includes('bank');
    })
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalOutstanding = unpaidInvoices.reduce(
    (sum, i) => sum + Math.max(0, Number(i.subtotal || i.total || 0) - Number(i.paid || 0)),
    0
  );
  const totalPaidRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.paid || i.total || 0), 0);

  const activeCurrency = businessFilter ? getCurrency(businessFilter) : state.settings?.currency || 'PKR';
  const selectedBusinessName = businessFilter ? getBusinessName(businessFilter) : 'All Businesses';

  // Handler: Full Excel Export (Multi-sheet)
  const handleExportFullExcel = () => {
    exportFullReportToExcel({
      allPayments,
      paidInvoices,
      unpaidInvoices,
      allInvoices: enrichedInvoices,
      summary: {
        totalCollected,
        cashCollected,
        onlineCollected,
        totalOutstanding
      },
      businessName: selectedBusinessName,
      fromDate,
      toDate,
      currency: activeCurrency
    });
  };

  // Handler: Single Section Excel Export
  const handleExportSingleSection = (sectionKey) => {
    let rows = [];
    if (sectionKey === 'collected') rows = allPayments;
    else if (sectionKey === 'paid') rows = paidInvoices;
    else if (sectionKey === 'unpaid') rows = unpaidInvoices;
    else rows = enrichedInvoices;

    exportSingleSectionToExcel({
      section: sectionKey,
      rows,
      currency: activeCurrency,
      businessName: selectedBusinessName
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setBusinessFilter('');
    setFromDate('');
    setToDate('');
    setStatusFilter('');
    setSearchTerm('');
  };

  // Render Section 1: Collected Payments Table
  const renderCollectedSection = () => (
    <div className="report-sub-section" style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f0f9ff',
        padding: '10px 16px',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #bae6fd',
        borderBottom: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>📥</span>
          <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '14px' }}>
            Collected Payments & Receipts
          </span>
          <span style={{ fontSize: '11px', color: '#0284c7', background: '#ffffff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bae6fd', fontWeight: 600 }}>
            {allPayments.length} Payments ({money(totalCollected, activeCurrency)})
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleExportSingleSection('collected')}
          style={{
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title="Export Collected Payments to Excel"
        >
          <span>📊</span> Export Collections (.xlsx)
        </button>
      </div>

      <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, border: '1px solid #bae6fd' }}>
        <table>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ width: '40px' }}>#</th>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Business</th>
              <th>Client</th>
              <th>Payment Method / Details</th>
              <th>Received By</th>
              <th style={{ textAlign: 'right' }}>Collected Amount</th>
            </tr>
          </thead>
          <tbody>
            {allPayments.length > 0 ? (
              allPayments.map((p, idx) => (
                <tr key={p.uniqueKey || idx}>
                  <td style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>{p.date}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                      {p.invoiceNo}
                    </span>
                  </td>
                  <td>{p.businessName}</td>
                  <td style={{ fontWeight: 600 }}>{p.customerName}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      background: (p.method || '').toLowerCase().includes('online') ? '#e0f2fe' : '#f0fdf4',
                      color: (p.method || '').toLowerCase().includes('online') ? '#0369a1' : '#15803d',
                      border: (p.method || '').toLowerCase().includes('online') ? '1px solid #bae6fd' : '1px solid #bbf7d0'
                    }}>
                      {p.method || 'Cash'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{p.receivedBy || 'Admin'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    {formatMoney(p.amount, p.businessId)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No payment collections recorded for this filter.
                </td>
              </tr>
            )}
          </tbody>
          {allPayments.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                <td colSpan="5" style={{ textAlign: 'right', color: '#334155' }}>
                  Total Collected:
                </td>
                <td style={{ fontSize: '11px', color: '#64748b' }}>
                  Cash: <strong>{money(cashCollected, activeCurrency)}</strong> | Online: <strong>{money(onlineCollected, activeCurrency)}</strong>
                </td>
                <td></td>
                <td style={{ textAlign: 'right', color: '#16a34a', fontSize: '13px' }}>
                  {money(totalCollected, activeCurrency)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  // Render Section 2: Paid Invoices Table
  const renderPaidSection = () => (
    <div className="report-sub-section" style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f0fdf4',
        padding: '10px 16px',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #bbf7d0',
        borderBottom: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🟢</span>
          <span style={{ fontWeight: 700, color: '#15803d', fontSize: '14px' }}>
            Paid Invoices (Fully Settled)
          </span>
          <span style={{ fontSize: '11px', color: '#15803d', background: '#ffffff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0', fontWeight: 600 }}>
            {paidInvoices.length} Invoices ({money(totalPaidRevenue, activeCurrency)})
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleExportSingleSection('paid')}
          style={{
            background: '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title="Export Paid Invoices to Excel"
        >
          <span>📊</span> Export Paid (.xlsx)
        </button>
      </div>

      <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, border: '1px solid #bbf7d0' }}>
        <table>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ width: '40px' }}>#</th>
              <th>Invoice #</th>
              <th>Business</th>
              <th>Client</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Collected</th>
              <th style={{ textAlign: 'right' }}>Outstanding</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {paidInvoices.length > 0 ? (
              paidInvoices.map((inv, idx) => (
                <tr key={inv.id}>
                  <td style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                      {inv.invoiceNo}
                    </span>
                  </td>
                  <td>{inv.businessName}</td>
                  <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                  <td>{inv.date}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.total, inv.businessId)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{formatMoney(inv.paid, inv.businessId)}</td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>{formatMoney(0, inv.businessId)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge status="Paid" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="empty" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No fully paid invoices found for this filter.
                </td>
              </tr>
            )}
          </tbody>
          {paidInvoices.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                <td colSpan="5" style={{ textAlign: 'right', color: '#334155' }}>
                  Total Settled ({paidInvoices.length} Invoices):
                </td>
                <td style={{ textAlign: 'right' }}>{money(totalPaidRevenue, activeCurrency)}</td>
                <td style={{ textAlign: 'right', color: '#16a34a' }}>{money(totalPaidRevenue, activeCurrency)}</td>
                <td style={{ textAlign: 'right' }}>{money(0, activeCurrency)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  // Render Section 3: Unpaid Invoices Table
  const renderUnpaidSection = () => (
    <div className="report-sub-section" style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fef2f2',
        padding: '10px 16px',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #fecaca',
        borderBottom: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🔴</span>
          <span style={{ fontWeight: 700, color: '#b91c1c', fontSize: '14px' }}>
            Unpaid & Pending Invoices
          </span>
          <span style={{ fontSize: '11px', color: '#b91c1c', background: '#ffffff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fecaca', fontWeight: 600 }}>
            {unpaidInvoices.length} Invoices (Due: {money(totalOutstanding, activeCurrency)})
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleExportSingleSection('unpaid')}
          style={{
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title="Export Unpaid Invoices to Excel"
        >
          <span>📊</span> Export Unpaid (.xlsx)
        </button>
      </div>

      <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, border: '1px solid #fecaca' }}>
        <table>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ width: '40px' }}>#</th>
              <th>Invoice #</th>
              <th>Business</th>
              <th>Client</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Collected</th>
              <th style={{ textAlign: 'right' }}>Outstanding Due</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {unpaidInvoices.length > 0 ? (
              unpaidInvoices.map((inv, idx) => (
                <tr key={inv.id}>
                  <td style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                      {inv.invoiceNo}
                    </span>
                  </td>
                  <td>{inv.businessName}</td>
                  <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                  <td>{inv.date}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.total, inv.businessId)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatMoney(inv.paid || 0, inv.businessId)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                    {formatMoney(inv.balance, inv.businessId)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="empty" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  🎉 No unpaid invoices! All invoices are fully paid.
                </td>
              </tr>
            )}
          </tbody>
          {unpaidInvoices.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                <td colSpan="7" style={{ textAlign: 'right', color: '#334155' }}>
                  Total Outstanding Balance Due:
                </td>
                <td style={{ textAlign: 'right', color: '#dc2626', fontSize: '13px' }}>
                  {money(totalOutstanding, activeCurrency)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  // Render Section 4: All Invoices Overview Table
  const renderAllInvoicesSection = () => (
    <div className="report-sub-section" style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8fafc',
        padding: '10px 16px',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #e2e8f0',
        borderBottom: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>📋</span>
          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
            All Invoices Overview
          </span>
          <span style={{ fontSize: '11px', color: '#475569', background: '#ffffff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: 600 }}>
            {enrichedInvoices.length} Total Invoices
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleExportSingleSection('all')}
          style={{
            background: '#475569',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title="Export All Invoices to Excel"
        >
          <span>📊</span> Export All Invoices (.xlsx)
        </button>
      </div>

      <div className="table-wrap" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, border: '1px solid #e2e8f0' }}>
        <table>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ width: '40px' }}>#</th>
              <th>Invoice #</th>
              <th>Business</th>
              <th>Client</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Collected</th>
              <th style={{ textAlign: 'right' }}>Outstanding</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {enrichedInvoices.length > 0 ? (
              enrichedInvoices.map((inv, idx) => (
                <tr key={inv.id}>
                  <td style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                      {inv.invoiceNo}
                    </span>
                  </td>
                  <td>{inv.businessName}</td>
                  <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                  <td>{inv.date}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.total, inv.businessId)}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{formatMoney(inv.paid, inv.businessId)}</td>
                  <td style={{ textAlign: 'right', color: Number(inv.balance || 0) > 0 ? '#dc2626' : '#64748b', fontWeight: Number(inv.balance || 0) > 0 ? 700 : 400 }}>
                    {formatMoney(inv.balance, inv.businessId)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="empty" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No invoice data matches the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section id="reports" className="page active">
      <div className="panel">
        {/* Panel Head */}
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700', fontSize: '16px', color: '#0f172a' }}>Financial & Invoicing Reports</span>
            <span style={{ fontSize: '11px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              {filteredInvoices.length} Invoices
            </span>
          </div>

          {/* Master Excel Export Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExportFullExcel}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#15803d')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#16a34a')}
              title="Download Complete Excel Workbook with all 3 sections in separate sheets"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download Excel Report (.xlsx)</span>
            </button>
          </div>
        </div>

        <div className="panel-body">
          {/* Filters Toolbar */}
          <div className="toolbar enter-flow" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
            <div className="sm" style={{ minWidth: '150px' }}>
              <label>Business</label>
              <select
                id="rBiz"
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

            <div className="sm" style={{ minWidth: '150px' }}>
              <label>Search Client / Invoice #</label>
              <input
                className="input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="sm" style={{ width: '135px' }}>
              <label>From Date</label>
              <input
                id="rFrom"
                className="input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="sm" style={{ width: '135px' }}>
              <label>To Date</label>
              <input
                id="rTo"
                className="input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="sm" style={{ width: '120px' }}>
              <label>Status</label>
              <select
                id="rStatus"
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            {(businessFilter || fromDate || toDate || statusFilter || searchTerm) && (
              <div style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Interactive SaaS KPI Cards */}
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '18px' }}>
            <div
              className="stat"
              onClick={() => setActiveTab('collected')}
              style={{
                cursor: 'pointer',
                border: activeTab === 'collected' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                background: activeTab === 'collected' ? '#f0f9ff' : '#ffffff',
                transition: 'all 0.15s ease'
              }}
              title="Click to view Collected Payments"
            >
              <div className="label">Total Collection</div>
              <div className="value" style={{ color: '#0284c7', fontSize: '18px' }}>
                {money(totalCollected, activeCurrency)}
              </div>
              <div className="hint">{allPayments.length} receipts received</div>
            </div>

            <div
              className="stat"
              onClick={() => setActiveTab('collected')}
              style={{
                cursor: 'pointer',
                border: activeTab === 'collected' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease'
              }}
              title="Click to view Collected Payments"
            >
              <div className="label">Cash Collected</div>
              <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>
                {money(cashCollected, activeCurrency)}
              </div>
              <div className="hint">Cash mode</div>
            </div>

            <div
              className="stat"
              onClick={() => setActiveTab('collected')}
              style={{
                cursor: 'pointer',
                border: activeTab === 'collected' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease'
              }}
              title="Click to view Collected Payments"
            >
              <div className="label">Online Collected</div>
              <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>
                {money(onlineCollected, activeCurrency)}
              </div>
              <div className="hint">Bank / Online transfer</div>
            </div>

            <div
              className="stat"
              onClick={() => setActiveTab('unpaid')}
              style={{
                cursor: 'pointer',
                border: activeTab === 'unpaid' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                background: activeTab === 'unpaid' ? '#fef2f2' : '#ffffff',
                transition: 'all 0.15s ease'
              }}
              title="Click to view Unpaid Invoices"
            >
              <div className="label">Unpaid Invoices</div>
              <div className="value" style={{ color: unpaidInvoices.length > 0 ? '#dc2626' : '#0284c7', fontSize: '18px' }}>
                {unpaidInvoices.length}
              </div>
              <div className="hint">Pending collections</div>
            </div>

            <div
              className="stat"
              onClick={() => setActiveTab('paid')}
              style={{
                cursor: 'pointer',
                border: activeTab === 'paid' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                background: activeTab === 'paid' ? '#f0fdf4' : '#ffffff',
                transition: 'all 0.15s ease'
              }}
              title="Click to view Paid Invoices"
            >
              <div className="label">Paid Invoices</div>
              <div className="value" style={{ color: '#16a34a', fontSize: '18px' }}>
                {paidInvoices.length}
              </div>
              <div className="hint">Fully settled</div>
            </div>

            <div
              className="stat"
              onClick={() => setActiveTab('unpaid')}
              style={{
                cursor: 'pointer',
                border: activeTab === 'unpaid' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                transition: 'all 0.15s ease'
              }}
              title="Click to view Unpaid Invoices"
            >
              <div className="label">Outstanding Due</div>
              <div className="value" style={{ color: totalOutstanding > 0 ? '#dc2626' : '#16a34a', fontSize: '18px' }}>
                {money(totalOutstanding, activeCurrency)}
              </div>
              <div className="hint">Uncollected balance</div>
            </div>
          </div>

          {/* 3 Separate Section Navigation Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '2px solid #f1f5f9',
            paddingBottom: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Tab 1: Collected */}
              <button
                type="button"
                onClick={() => setActiveTab('collected')}
                style={{
                  background: activeTab === 'collected' ? '#0284c7' : '#ffffff',
                  color: activeTab === 'collected' ? '#ffffff' : '#334155',
                  border: activeTab === 'collected' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'collected' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📥</span>
                <span>Collected Payments</span>
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'collected' ? 'rgba(255,255,255,0.25)' : '#e0f2fe',
                  color: activeTab === 'collected' ? '#ffffff' : '#0369a1',
                  fontWeight: 700
                }}>
                  {allPayments.length}
                </span>
              </button>

              {/* Tab 2: Paid */}
              <button
                type="button"
                onClick={() => setActiveTab('paid')}
                style={{
                  background: activeTab === 'paid' ? '#16a34a' : '#ffffff',
                  color: activeTab === 'paid' ? '#ffffff' : '#334155',
                  border: activeTab === 'paid' ? '1px solid #16a34a' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'paid' ? '0 2px 4px rgba(22, 163, 74, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🟢</span>
                <span>Paid Invoices</span>
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'paid' ? 'rgba(255,255,255,0.25)' : '#dcfce7',
                  color: activeTab === 'paid' ? '#ffffff' : '#15803d',
                  fontWeight: 700
                }}>
                  {paidInvoices.length}
                </span>
              </button>

              {/* Tab 3: Unpaid */}
              <button
                type="button"
                onClick={() => setActiveTab('unpaid')}
                style={{
                  background: activeTab === 'unpaid' ? '#dc2626' : '#ffffff',
                  color: activeTab === 'unpaid' ? '#ffffff' : '#334155',
                  border: activeTab === 'unpaid' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'unpaid' ? '0 2px 4px rgba(220, 38, 38, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🔴</span>
                <span>Unpaid & Pending</span>
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'unpaid' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
                  color: activeTab === 'unpaid' ? '#ffffff' : '#b91c1c',
                  fontWeight: 700
                }}>
                  {unpaidInvoices.length}
                </span>
              </button>

              {/* Tab 4: All Invoices */}
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={{
                  background: activeTab === 'all' ? '#334155' : '#ffffff',
                  color: activeTab === 'all' ? '#ffffff' : '#334155',
                  border: activeTab === 'all' ? '1px solid #334155' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'all' ? '0 2px 4px rgba(51, 65, 85, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📋</span>
                <span>All Invoices</span>
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: activeTab === 'all' ? '#ffffff' : '#475569',
                  fontWeight: 700
                }}>
                  {enrichedInvoices.length}
                </span>
              </button>

              {/* Tab 5: View All Sections Stacked */}
              <button
                type="button"
                onClick={() => setActiveTab('stacked')}
                style={{
                  background: activeTab === 'stacked' ? '#6366f1' : '#ffffff',
                  color: activeTab === 'stacked' ? '#ffffff' : '#475569',
                  border: activeTab === 'stacked' ? '1px solid #6366f1' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'stacked' ? '0 2px 4px rgba(99, 102, 241, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📑</span>
                <span>View All 3 Sections</span>
              </button>
            </div>

            {/* Quick Export for active section */}
            {activeTab !== 'stacked' && (
              <button
                type="button"
                onClick={() => handleExportSingleSection(activeTab)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title="Download this section as Excel"
              >
                <span>📥</span> Export Current Tab (.xlsx)
              </button>
            )}
          </div>

          {/* Render Active View / Sections */}
          {activeTab === 'collected' && renderCollectedSection()}
          {activeTab === 'paid' && renderPaidSection()}
          {activeTab === 'unpaid' && renderUnpaidSection()}
          {activeTab === 'all' && renderAllInvoicesSection()}
          {activeTab === 'stacked' && (
            <div>
              {renderCollectedSection()}
              {renderPaidSection()}
              {renderUnpaidSection()}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
