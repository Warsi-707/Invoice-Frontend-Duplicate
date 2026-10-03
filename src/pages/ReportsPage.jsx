import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { money } from '../utils/formatters';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const { state, getBusinessName, getCustomerName, formatMoney, getCurrency } = useApp();

  const [businessFilter, setBusinessFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Filter invoices
  const filteredInvoices = state.invoices.filter((inv) => {
    const matchesBiz = !businessFilter || inv.businessId === businessFilter;
    const matchesFrom = !fromDate || inv.date >= fromDate;
    const matchesTo = !toDate || inv.date <= toDate;
    const matchesStatus = !statusFilter || inv.status === statusFilter;

    return matchesBiz && matchesFrom && matchesTo && matchesStatus;
  });

  // Calculate payments summary
  const allPayments = filteredInvoices.flatMap((inv) =>
    (inv.payments || []).map((p) => ({
      ...p,
      invoiceNo: inv.invoiceNo,
      businessId: inv.businessId,
      customerId: inv.customerId,
      businessName: getBusinessName(inv.businessId),
      customerName: getCustomerName(inv.customerId)
    }))
  );

  const totalCollected = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashCollected = allPayments
    .filter((p) => {
      const m = (p.method || '').toLowerCase();
      return !m.includes('online') && !m.includes('bank');
    })
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const onlineCollected = allPayments
    .filter((p) => {
      const m = (p.method || '').toLowerCase();
      return m.includes('online') || m.includes('bank');
    })
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const unpaidCount = filteredInvoices.filter((i) => i.status !== 'Paid').length;
  const paidCount = filteredInvoices.filter((i) => i.status === 'Paid').length;
  const totalOutstanding = filteredInvoices.reduce(
    (sum, i) => sum + Math.max(0, Number(i.subtotal || i.total || 0) - Number(i.paid || 0)),
    0
  );

  const activeCurrency = businessFilter ? getCurrency(businessFilter) : state.settings?.currency || 'PKR';

  // Export to Excel handler
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Invoices
    const invoiceRows = filteredInvoices.map((inv, idx) => ({
      '#': idx + 1,
      'Invoice #': inv.invoiceNo || '-',
      'Business': getBusinessName(inv.businessId),
      'Client': getCustomerName(inv.customerId),
      'Date': inv.date || '-',
      [`Total (${activeCurrency})`]: Number(inv.total || 0),
      [`Collected (${activeCurrency})`]: Number(inv.paid || 0),
      [`Outstanding (${activeCurrency})`]: Number(inv.balance || 0),
      'Status': inv.status || 'Unpaid'
    }));

    const wsInvoices = XLSX.utils.json_to_sheet(
      invoiceRows.length > 0 ? invoiceRows : [{ '#': '', Info: 'No report data' }]
    );
    wsInvoices['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // Sheet 2: Collections / Payments Received
    const paymentRows = allPayments.map((p, idx) => ({
      '#': idx + 1,
      'Date': p.date || '-',
      'Invoice #': p.invoiceNo || '-',
      'Business': p.businessName,
      'Client': p.customerName,
      [`Amount (${activeCurrency})`]: Number(p.amount || 0),
      'Method': p.method || 'Cash',
      'Received By': p.receivedBy || 'Admin'
    }));

    const wsPayments = XLSX.utils.json_to_sheet(
      paymentRows.length > 0 ? paymentRows : [{ '#': '', Info: 'No payment records' }]
    );
    wsPayments['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 24 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Collections');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Financial_Report_${dateStr}.xlsx`);
  };

  return (
    <section id="reports" className="page active">
      <div className="panel">
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>Financial & Invoicing Reports</span>
            <span style={{ fontSize: '11px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              {filteredInvoices.length} Invoices
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Collection & Summary Analytics</span>
            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
              }}
              title="Download Excel Report"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="panel-body">
          {/* Filters Toolbar */}
          <div className="toolbar enter-flow" style={{ marginBottom: '16px' }}>
            <div className="sm">
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
            <div className="sm">
              <label>From Date</label>
              <input
                id="rFrom"
                className="input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="sm">
              <label>To Date</label>
              <input
                id="rTo"
                className="input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="sm">
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
          </div>

          {/* Clean SaaS KPI Cards */}
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '18px' }}>
            <div className="stat">
              <div className="label">Total Collection</div>
              <div className="value" style={{ color: '#0284c7', fontSize: '18px' }}>{money(totalCollected, activeCurrency)}</div>
              <div className="hint">All payments received</div>
            </div>
            <div className="stat">
              <div className="label">Cash Collected</div>
              <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>{money(cashCollected, activeCurrency)}</div>
              <div className="hint">Cash mode</div>
            </div>
            <div className="stat">
              <div className="label">Online Collected</div>
              <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>{money(onlineCollected, activeCurrency)}</div>
              <div className="hint">Bank / Online transfer</div>
            </div>
            <div className="stat">
              <div className="label">Unpaid Invoices</div>
              <div className="value" style={{ color: unpaidCount > 0 ? '#dc2626' : '#0284c7', fontSize: '18px' }}>{unpaidCount}</div>
              <div className="hint">Pending collections</div>
            </div>
            <div className="stat">
              <div className="label">Paid Invoices</div>
              <div className="value" style={{ color: '#0284c7', fontSize: '18px' }}>{paidCount}</div>
              <div className="hint">Fully settled</div>
            </div>
            <div className="stat">
              <div className="label">Outstanding</div>
              <div className="value" style={{ color: totalOutstanding > 0 ? '#dc2626' : '#0284c7', fontSize: '18px' }}>{money(totalOutstanding, activeCurrency)}</div>
              <div className="hint">Uncollected balance</div>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Business</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invoiceNo}</td>
                      <td>{getBusinessName(inv.businessId)}</td>
                      <td>{getCustomerName(inv.customerId)}</td>
                      <td>{inv.date}</td>
                      <td>{formatMoney(inv.total, inv.businessId)}</td>
                      <td>{formatMoney(inv.paid, inv.businessId)}</td>
                      <td>{formatMoney(inv.balance, inv.businessId)}</td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="empty">
                      No report data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
