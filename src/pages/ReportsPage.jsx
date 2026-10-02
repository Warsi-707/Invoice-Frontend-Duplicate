import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { money } from '../utils/formatters';

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
    (inv.payments || []).map((p) => ({ ...p, businessId: inv.businessId }))
  );

  const totalCollected = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashCollected = allPayments
    .filter((p) => p.method === 'Cash')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const onlineCollected = allPayments
    .filter((p) => p.method === 'Online')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const unpaidCount = filteredInvoices.filter((i) => i.status !== 'Paid').length;
  const paidCount = filteredInvoices.filter((i) => i.status === 'Paid').length;
  const totalOutstanding = filteredInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);

  const activeCurrency = businessFilter ? getCurrency(businessFilter) : state.settings?.currency || 'PKR';

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
          <span style={{ fontSize: '12px', color: '#64748b' }}>Collection & Summary Analytics</span>
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
