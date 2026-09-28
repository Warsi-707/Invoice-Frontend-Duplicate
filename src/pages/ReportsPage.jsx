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
        <div className="panel-head">
          <span>Reports</span>
          <span>Collection & Invoice Summary</span>
        </div>
        <div className="panel-body">
          {/* Filters Toolbar */}
          <div className="toolbar enter-flow">
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
                <option value="">All</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {/* KPIs */}
          <div className="kpis">
            <div className="kpi">
              <small>Total Collection</small>
              <strong>{money(totalCollected, activeCurrency)}</strong>
            </div>
            <div className="kpi">
              <small>Cash Collected</small>
              <strong>{money(cashCollected, activeCurrency)}</strong>
            </div>
            <div className="kpi">
              <small>Online Collected</small>
              <strong>{money(onlineCollected, activeCurrency)}</strong>
            </div>
            <div className="kpi">
              <small>Unpaid Invoices</small>
              <strong>{unpaidCount}</strong>
            </div>
            <div className="kpi">
              <small>Paid Invoices</small>
              <strong>{paidCount}</strong>
            </div>
            <div className="kpi">
              <small>Outstanding</small>
              <strong>{money(totalOutstanding, activeCurrency)}</strong>
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
