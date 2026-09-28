import { money, esc, today, MONTHS } from './formatters.js';
import { downloadAsPdf, sendPdfToWhatsApp, downloadAndSendWhatsApp } from './whatsappPdf.js';

/**
 * Generate a complete, elegant Client Account Statement HTML document.
 */
export function generateStatementHtml(customer = {}, business = {}, invoices = []) {
  const p = business.proposalData || {};
  const cur = business.currency || 'PKR';
  const custInvoices = invoices
    .filter((i) => String(i.customerId) === String(customer.id))
    .sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));

  const totalInvoiced = custInvoices.reduce((sum, i) => sum + Number(i.subtotal || i.total || 0), 0);
  const totalPaid = custInvoices.reduce((sum, i) => sum + Number(i.paid || 0), 0);
  const totalOutstanding = custInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.subtotal || 0) - Number(i.paid || 0)), 0);

  const orgName = p.companyName || 'iSysware Software Solution';
  const orgAddress = p.officeAddress || business.address || '';
  const orgContact = [p.supportPhone || business.phone, p.inquiryEmail || business.email, p.websiteUrl].filter(Boolean).join(' • ');

  // Build sequential ledger transactions
  let runningBalance = 0;
  const ledgerRows = [];

  custInvoices.forEach((inv) => {
    // 1. Invoice Debit
    const invDebit = Number(inv.subtotal || inv.total || 0);
    runningBalance += invDebit;
    ledgerRows.push({
      date: inv.date || '-',
      type: 'Invoice Generated',
      ref: inv.invoiceNo,
      description: `Monthly Fee (${inv.month} ${inv.year})`,
      debit: invDebit,
      credit: 0,
      balance: runningBalance,
      status: inv.status
    });

    // 2. Payments Credit
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        const pAmt = Number(p.amount || 0);
        runningBalance -= pAmt;
        ledgerRows.push({
          date: p.date || '-',
          type: 'Payment Received',
          ref: `REC-${inv.invoiceNo}`,
          description: `${p.method || 'Cash'} Payment (${p.time || ''})`,
          debit: 0,
          credit: pAmt,
          balance: runningBalance,
          status: 'Paid'
        });
      });
    }
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Statement - ${esc(customer.name || 'Client')}</title>
  <style>
    @page { margin: 8mm; size: A4 portrait; }
    * { box-sizing: border-box; }
    html, body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background: #ffffff !important; padding: 0 !important; margin: 0 !important; color: #172033; }
    .statement { width: 750px !important; max-width: 750px !important; margin: 0 !important; padding: 24px 28px !important; background: #ffffff !important; border: 1.5px solid #cbd5e1 !important; border-radius: 10px !important; box-sizing: border-box !important; position: relative; }
    .st-head { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 16px; border-bottom: 2px solid #0b4b8f; }
    .st-brand { display: flex; gap: 14px; }
    .st-logo { width: 56px; height: 56px; border: 1px solid #d6deea; border-radius: 8px; display: grid; place-items: center; overflow: hidden; font-weight: 800; color: #64748b; background: #fafbfd; }
    .st-logo img { width: 100%; height: 100%; object-fit: contain; }
    .st-brand h2 { margin: 0 0 3px; font-size: 20px; font-weight: 850; color: #0b4b8f; }
    .st-brand p { margin: 2px 0; color: #64748b; font-size: 11px; }
    .st-meta { text-align: right; }
    .st-meta h1 { margin: 0 0 4px; font-size: 22px; font-weight: 900; color: #0b4b8f; letter-spacing: 0.5px; }
    .st-meta div { font-size: 11px; margin: 2px 0; color: #475569; }
    
    .st-client-box { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin: 16px 0; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .st-client-box h4 { margin: 0 0 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .st-client-box p { margin: 2px 0; font-size: 11.5px; color: #1e293b; }

    .st-summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
    .st-card { padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
    .st-card.billed { background: #eff6ff; border-color: #bfdbfe; }
    .st-card.paid { background: #f0fdf4; border-color: #bbf7d0; }
    .st-card.due { background: #fef2f2; border-color: #fecaca; }
    .st-card-label { font-size: 9.5px; text-transform: uppercase; font-weight: 750; color: #64748b; margin-bottom: 2px; }
    .st-card-val { font-size: 15px; font-weight: 850; }
    .st-card.billed .st-card-val { color: #1d4ed8; }
    .st-card.paid .st-card-val { color: #15803d; }
    .st-card.due .st-card-val { color: #b91c1c; }

    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    .st-table th, .st-table td { font-size: 10.5px; padding: 7px 8px; border: 1px solid #e2e8f0; text-align: left; }
    .st-table th { background: #0b4b8f; color: #fff; font-weight: 750; font-size: 10.5px; }
    .st-table tr:nth-child(even) td { background: #f8fafc; }
    .st-table tr.pay td { background: #f0fdf4; }

    .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 36px; }
    .sig { text-align: center; border-top: 1px solid #94a3b8; padding-top: 5px; font-size: 10px; color: #64748b; }

    @media print {
      body { background: #fff; padding: 0; }
      .statement { border: 1.5px solid #cbd5e1 !important; border-radius: 10px !important; width: 100% !important; max-width: 100% !important; box-shadow: none; }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="statement">
    <div class="st-head">
      <div class="st-brand">
        <div class="st-logo">${business.logo ? `<img src="${business.logo}" alt="Logo">` : 'LOGO'}</div>
        <div>
          <h2>${esc(orgName)}</h2>
          ${orgAddress ? `<p>${esc(orgAddress)}</p>` : ''}
          ${orgContact ? `<p>${esc(orgContact)}</p>` : ''}
          ${p.ntnTax ? `<p>NTN/Tax: ${esc(p.ntnTax)}</p>` : ''}
        </div>
      </div>
      <div class="st-meta">
        <h1>ACCOUNT STATEMENT</h1>
        <div>Statement Date: <strong>${today()}</strong></div>
        <div>Total Transactions: <strong>${ledgerRows.length}</strong></div>
      </div>
    </div>

    <div class="st-client-box">
      <div>
        <h4>Statement For:</h4>
        <p><strong>${esc(customer.name || 'Client')}</strong></p>
        ${(customer.company || business.name) ? `<p>Organization: ${esc(customer.company || business.name)}</p>` : ''}
        ${customer.phone ? `<p>Phone: ${esc(customer.phone)}</p>` : ''}
        ${customer.whatsapp && customer.whatsapp !== customer.phone ? `<p>WhatsApp: ${esc(customer.whatsapp)}</p>` : ''}
      </div>
      <div>
        <h4>Account Overview:</h4>
        <p>Total Invoices: <strong>${custInvoices.length}</strong></p>
        <p>Account Status: <strong>${totalOutstanding <= 0 ? '✅ Up to Date' : '⚠️ Outstanding Dues'}</strong></p>
      </div>
    </div>

    <div class="st-summary-cards">
      <div class="st-card billed">
        <div class="st-card-label">Total Invoiced</div>
        <div class="st-card-val">${money(totalInvoiced, cur)}</div>
      </div>
      <div class="st-card paid">
        <div class="st-card-label">Total Paid</div>
        <div class="st-card-val">${money(totalPaid, cur)}</div>
      </div>
      <div class="st-card due">
        <div class="st-card-label">Current Balance Due</div>
        <div class="st-card-val">${money(totalOutstanding, cur)}</div>
      </div>
    </div>

    <table class="st-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference #</th>
          <th>Description</th>
          <th style="text-align:right">Invoiced (+)</th>
          <th style="text-align:right">Paid (-)</th>
          <th style="text-align:right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${ledgerRows.length > 0 ? ledgerRows.map((r) => `
          <tr class="${r.credit > 0 ? 'pay' : ''}">
            <td>${esc(r.date)}</td>
            <td><strong>${esc(r.ref)}</strong></td>
            <td>${esc(r.description)}</td>
            <td style="text-align:right">${r.debit > 0 ? money(r.debit, cur) : '-'}</td>
            <td style="text-align:right; color:#16a34a; font-weight:${r.credit > 0 ? '700' : 'normal'}">${r.credit > 0 ? money(r.credit, cur) : '-'}</td>
            <td style="text-align:right; font-weight:700; color:${r.balance > 0 ? '#b91c1c' : '#16a34a'}">${money(r.balance, cur)}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colSpan="6" style="text-align:center; padding:18px; color:#64748b;">No account transactions recorded for this client.</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="sigs">
      <div class="sig">Client Signature / Stamp</div>
      <div class="sig">Authorized Signature</div>
    </div>
  </div>
</body>
</html>`;
}
