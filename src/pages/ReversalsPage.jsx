import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { money } from '../utils/formatters';

export default function ReversalsPage() {
  const { state, getBusinessName, getCustomerName, formatMoney } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [businessFilter, setBusinessFilter] = useState('');

  const query = searchTerm.toLowerCase();
  const reversals = (state.reversals || []).filter((rev) => {
    const bName = getBusinessName(rev.businessId);
    const cName = getCustomerName(rev.customerId);
    const searchString = `${rev.invoiceNo || ''} ${bName} ${cName}`.toLowerCase();

    const matchesSearch = !query || searchString.includes(query);
    const matchesBusiness = !businessFilter || rev.businessId === businessFilter;

    return matchesSearch && matchesBusiness;
  });

  return (
    <section id="reversals" className="page active">
      <div className="panel">
        <div className="panel-head">
          <span>Reversals</span>
          <span>Payment Reversal History</span>
        </div>
        <div className="panel-body">
          <div className="toolbar">
            <div className="grow">
              <label>Search Reversals</label>
              <input
                id="revSearch"
                className="input"
                placeholder="Invoice, business, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="sm">
              <label>Business</label>
              <select
                id="revBiz"
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
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Business</th>
                  <th>Client</th>
                  <th>Reversed Amount</th>
                  <th style={{ textAlign: 'center' }}>Method</th>
                  <th>Payment Date</th>
                  <th>Reversed At</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {reversals.length > 0 ? (
                  reversals.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.invoiceNo}</strong>
                      </td>
                      <td>{getBusinessName(r.businessId)}</td>
                      <td>{getCustomerName(r.customerId)}</td>
                      <td style={{ color: '#7c3aed', fontWeight: '750' }}>
                        {formatMoney(r.amount, r.businessId)}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <StatusBadge status={r.method || 'Cash'} />
                      </td>
                      <td>{r.paymentDate || '-'}</td>
                      <td>{r.reversedAt || '-'}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <StatusBadge status="Reversed" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="empty">
                      No reversals yet.
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
