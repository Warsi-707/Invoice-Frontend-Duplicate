import React from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { money } from '../utils/formatters';

export default function DashboardPage() {
  const { state, getBusinessName, getCustomerName, formatMoney } = useApp();

  const businessCount = state.businesses.length;
  const customerCount = state.customers.length;
  const invoiceCount = state.invoices.length;

  const totalCollected = state.invoices.reduce((acc, i) => acc + Number(i.paid || 0), 0);
  const totalOutstanding = state.invoices.reduce((acc, i) => acc + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);
  const defaultCurrency = state.settings?.currency || 'PKR';

  const recentInvoices = state.invoices.slice(0, 8);

  return (
    <section id="dashboard" className="page active">
      <div className="cards">
        <div className="stat">
          <div className="label">Businesses</div>
          <div className="value">{businessCount}</div>
          <div className="hint">Saved profiles</div>
        </div>
        <div className="stat">
          <div className="label">Clients</div>
          <div className="value">{customerCount}</div>
          <div className="hint">Saved clients</div>
        </div>
        <div className="stat">
          <div className="label">Invoices</div>
          <div className="value">{invoiceCount}</div>
          <div className="hint">Generated invoices</div>
        </div>
        <div className="stat">
          <div className="label">Collected</div>
          <div className="value">{money(totalCollected, defaultCurrency)}</div>
          <div className="hint">Total received</div>
        </div>
        <div className="stat">
          <div className="label">Outstanding</div>
          <div className="value">{money(totalOutstanding, defaultCurrency)}</div>
          <div className="hint">Unpaid balance</div>
        </div>
      </div>

      <div className="title-row">
        <h3>Recent Invoices</h3>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Business</th>
              <th>Client</th>
              <th>Month / Year</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.length > 0 ? (
              recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.invoiceNo}</strong>
                  </td>
                  <td>{getBusinessName(inv.businessId)}</td>
                  <td>{getCustomerName(inv.customerId)}</td>
                  <td>
                    {inv.month} {inv.year}
                  </td>
                  <td>{formatMoney(inv.total, inv.businessId)}</td>
                  <td>{formatMoney(inv.paid, inv.businessId)}</td>
                  <td>{formatMoney(inv.balance, inv.businessId)}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty">
                  No invoices yet. Add business, customer and items, then generate your first invoice.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
