import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import { money } from '../utils/formatters';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const {
    state,
    getBusinessName,
    getCustomerName,
    formatMoney,
    getCurrency,
    reportsTab,
    setReportsTab
  } = useApp();

  const currentTab = reportsTab === 'paid' ? 'paid' : reportsTab === 'unpaid' ? 'unpaid' : 'collections';

  const [businessFilter, setBusinessFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter invoices
  const filteredInvoices = state.invoices.filter((inv) => {
    const matchesBiz = !businessFilter || inv.businessId === businessFilter;
    const matchesFrom = !fromDate || inv.date >= fromDate;
    const matchesTo = !toDate || inv.date <= toDate;

    const clientName = (getCustomerName(inv.customerId) || '').toLowerCase();
    const invNo = (inv.invoiceNo || '').toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || clientName.includes(query) || invNo.includes(query);

    return matchesBiz && matchesFrom && matchesTo && matchesSearch;
  });

  // Calculate payments summary
  const allPayments = filteredInvoices.flatMap((inv) =>
    (inv.payments || []).map((p, idx) => ({
      ...p,
      uniqueId: `${inv.id}-${idx}`,
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

  // Categorize invoices
  const paidInvoices = filteredInvoices.filter((i) => i.status === 'Paid');
  const unpaidInvoices = filteredInvoices.filter((i) => i.status !== 'Paid');

  const totalOutstanding = unpaidInvoices.reduce(
    (sum, i) => sum + Math.max(0, Number(i.subtotal || i.total || 0) - Number(i.paid || 0)),
    0
  );
  const totalPaidRevenue = paidInvoices.reduce(
    (sum, i) => sum + Number(i.paid || i.total || 0),
    0
  );

  const activeCurrency = businessFilter ? getCurrency(businessFilter) : state.settings?.currency || 'PKR';

  // Export to Excel handler based on current active submodule
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toISOString().slice(0, 10);

    if (currentTab === 'collections') {
      const rows = allPayments.map((p, idx) => ({
        '#': idx + 1,
        'Payment Date': p.date || '-',
        'Invoice #': p.invoiceNo || '-',
        'Business': p.businessName,
        'Client': p.customerName,
        [`Amount (${activeCurrency})`]: Number(p.amount || 0),
        'Payment Method / Ref ID': p.method || 'Cash',
        'Received By': p.receivedBy || 'Admin'
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ '#': '', Info: 'No collection records found' }]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 16 },
        { wch: 32 },
        { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Collections');
      XLSX.writeFile(wb, `Invoice_Collections_Report_${dateStr}.xlsx`);
    } else if (currentTab === 'paid') {
      const rows = paidInvoices.map((inv, idx) => ({
        '#': idx + 1,
        'Invoice #': inv.invoiceNo || '-',
        'Business': getBusinessName(inv.businessId),
        'Client': getCustomerName(inv.customerId),
        'Date': inv.date || '-',
        [`Total (${activeCurrency})`]: Number(inv.total || 0),
        [`Collected (${activeCurrency})`]: Number(inv.paid || 0),
        [`Outstanding (${activeCurrency})`]: 0,
        'Status': 'Paid'
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ '#': '', Info: 'No paid invoices found' }]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Paid Invoices');
      XLSX.writeFile(wb, `Paid_Invoices_Report_${dateStr}.xlsx`);
    } else {
      const rows = unpaidInvoices.map((inv, idx) => ({
        '#': idx + 1,
        'Invoice #': inv.invoiceNo || '-',
        'Business': getBusinessName(inv.businessId),
        'Client': getCustomerName(inv.customerId),
        'Date': inv.date || '-',
        [`Total (${activeCurrency})`]: Number(inv.total || 0),
        [`Collected (${activeCurrency})`]: Number(inv.paid || 0),
        [`Outstanding Due (${activeCurrency})`]: Number(inv.balance || 0),
        'Status': inv.status || 'Unpaid'
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ '#': '', Info: 'No unpaid invoices found' }]);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Unpaid Invoices');
      XLSX.writeFile(wb, `Unpaid_Invoices_Report_${dateStr}.xlsx`);
    }
  };

  const getModuleTitle = () => {
    if (currentTab === 'collections') return 'Invoice Collection';
    if (currentTab === 'paid') return 'Paid Invoices';
    return 'Unpaid Invoices';
  };

  const getModuleSubtitle = () => {
    if (currentTab === 'collections') return 'All payments & collections received';
    if (currentTab === 'paid') return 'Fully settled invoices';
    return 'Pending collections & outstanding balances';
  };

  const getRecordCount = () => {
    if (currentTab === 'collections') return `${allPayments.length} Payment Receipts`;
    if (currentTab === 'paid') return `${paidInvoices.length} Paid Invoices`;
    return `${unpaidInvoices.length} Pending Invoices`;
  };

  return (
    <section id="reports" className="page active">
      <div className="panel">
        {/* Panel Head */}
        <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
              Financial &amp; Invoicing Reports
            </span>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#0284c7' }}>
              {getModuleTitle()}
            </span>
            <span style={{ fontSize: '11px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              {getRecordCount()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{getModuleSubtitle()}</span>
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
              title={`Download ${getModuleTitle()} to Excel (.xlsx)`}
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
              <label>Search Client / Invoice #</label>
              <input
                className="input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
          </div>

          {/* Module 1: Invoice Collection */}
          {currentTab === 'collections' && (
            <>
              {/* Clean SaaS KPI Cards */}
              <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '18px' }}>
                <div className="stat">
                  <div className="label">Total Collection</div>
                  <div className="value" style={{ color: '#0284c7', fontSize: '18px' }}>{money(totalCollected, activeCurrency)}</div>
                  <div className="hint">{allPayments.length} payments received</div>
                </div>
                <div className="stat">
                  <div className="label">Cash Collected</div>
                  <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>{money(cashCollected, activeCurrency)}</div>
                  <div className="hint">Cash payments</div>
                </div>
                <div className="stat">
                  <div className="label">Online Collected</div>
                  <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>{money(onlineCollected, activeCurrency)}</div>
                  <div className="hint">Bank / Online transfer</div>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th>Payment Date</th>
                      <th>Invoice #</th>
                      <th>Business</th>
                      <th>Client</th>
                      <th>Method / Details</th>
                      <th>Received By</th>
                      <th style={{ textAlign: 'right' }}>Collected Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.length > 0 ? (
                      allPayments.map((p, idx) => (
                        <tr key={p.uniqueId || idx}>
                          <td style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{p.date}</td>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                              {p.invoiceNo}
                            </strong>
                          </td>
                          <td>{p.businessName}</td>
                          <td style={{ fontWeight: 600 }}>{p.customerName}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0'
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
                        <td colSpan="8" className="empty">
                          No collection records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {allPayments.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan="5" style={{ textAlign: 'right', color: '#334155' }}>
                          Total Collections:
                        </td>
                        <td style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Cash: {money(cashCollected, activeCurrency)} | Online: {money(onlineCollected, activeCurrency)}
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
            </>
          )}

          {/* Module 2: Paid Invoices */}
          {currentTab === 'paid' && (
            <>
              {/* Clean SaaS KPI Cards */}
              <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '18px' }}>
                <div className="stat">
                  <div className="label">Paid Invoices</div>
                  <div className="value" style={{ color: '#0284c7', fontSize: '18px' }}>{paidInvoices.length}</div>
                  <div className="hint">Fully settled</div>
                </div>
                <div className="stat">
                  <div className="label">Settled Revenue</div>
                  <div className="value" style={{ color: '#16a34a', fontSize: '18px' }}>{money(totalPaidRevenue, activeCurrency)}</div>
                  <div className="hint">100% collected</div>
                </div>
                <div className="stat">
                  <div className="label">Total Invoices</div>
                  <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>{filteredInvoices.length}</div>
                  <div className="hint">Invoices generated</div>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
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
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                              {inv.invoiceNo}
                            </strong>
                          </td>
                          <td>{getBusinessName(inv.businessId)}</td>
                          <td style={{ fontWeight: 600 }}>{getCustomerName(inv.customerId)}</td>
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
                        <td colSpan="9" className="empty">
                          No paid invoices found.
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
            </>
          )}

          {/* Module 3: Unpaid Invoices */}
          {currentTab === 'unpaid' && (
            <>
              {/* Clean SaaS KPI Cards */}
              <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '18px' }}>
                <div className="stat">
                  <div className="label">Unpaid Invoices</div>
                  <div className="value" style={{ color: unpaidInvoices.length > 0 ? '#dc2626' : '#0284c7', fontSize: '18px' }}>
                    {unpaidInvoices.length}
                  </div>
                  <div className="hint">Pending collections</div>
                </div>
                <div className="stat">
                  <div className="label">Outstanding Due</div>
                  <div className="value" style={{ color: totalOutstanding > 0 ? '#dc2626' : '#0284c7', fontSize: '18px' }}>
                    {money(totalOutstanding, activeCurrency)}
                  </div>
                  <div className="hint">Uncollected balance</div>
                </div>
                <div className="stat">
                  <div className="label">Total Invoices</div>
                  <div className="value" style={{ color: '#0f172a', fontSize: '18px' }}>{filteredInvoices.length}</div>
                  <div className="hint">Invoices generated</div>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
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
                    {unpaidInvoices.length > 0 ? (
                      unpaidInvoices.map((inv, idx) => (
                        <tr key={inv.id}>
                          <td style={{ color: '#64748b', fontSize: '11px' }}>{idx + 1}</td>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                              {inv.invoiceNo}
                            </strong>
                          </td>
                          <td>{getBusinessName(inv.businessId)}</td>
                          <td style={{ fontWeight: 600 }}>{getCustomerName(inv.customerId)}</td>
                          <td>{inv.date}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.total, inv.businessId)}</td>
                          <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatMoney(inv.paid || 0, inv.businessId)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            {formatMoney(inv.balance, inv.businessId)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <StatusBadge status={inv.status} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="empty">
                          No unpaid invoices found! All invoices are settled.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {unpaidInvoices.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan="7" style={{ textAlign: 'right', color: '#334155' }}>
                          Total Outstanding Due:
                        </td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontSize: '13px', fontWeight: 800 }}>
                          {money(totalOutstanding, activeCurrency)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
