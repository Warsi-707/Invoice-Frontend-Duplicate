import { MONTHS, money, esc, uid, today } from './formatters.js';
import { downloadAsPdf } from './whatsappPdf.js';

export function nextInvoiceNo(businessId, business, invoices = []) {
  const prefix = business?.prefix || business?.proposalData?.invoicePrefix || 'ISW-';
  const count = (invoices.filter((i) => i.businessId === businessId).length) + 1;
  const year = new Date().getFullYear();
  return `${prefix}${year}-${String(count).padStart(4, '0')}`;
}

export function calculateInvoiceTotals(items = []) {
  const validItems = items.map((item) => {
    const qty = Math.max(0, Number(item.qty || 0));
    const price = Math.max(0, Number(item.price || 0));
    const amount = qty * price;
    return {
      ...item,
      qty,
      price,
      amount
    };
  });

  const subtotal = validItems.reduce((acc, item) => acc + item.amount, 0);
  const total = subtotal;

  return {
    items: validItems,
    subtotal,
    total
  };
}

export function getNextInvoiceMonth(currentMonth, currentYear) {
  let idx = MONTHS.indexOf(currentMonth);
  let y = Number(currentYear || new Date().getFullYear());
  if (idx < 0) return { month: 'January', year: String(y) };
  idx++;
  if (idx >= 12) {
    idx = 0;
    y++;
  }
  return {
    month: MONTHS[idx],
    year: String(y)
  };
}

export function getPreviousInvoiceMonth(currentMonth, currentYear) {
  let idx = MONTHS.indexOf(currentMonth);
  let y = Number(currentYear || new Date().getFullYear());
  if (idx < 0) return '';
  idx--;
  if (idx < 0) {
    idx = 11;
    y--;
  }
  return `${MONTHS[idx]} ${y}`;
}

export function generateInvoiceHtml(invoice = {}, business = {}, customer = {}) {
  const p = business.proposalData || business.settings?.proposalData || {};
  const cur = invoice.currency || business.currency || 'PKR';
  const items = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [
    { name: invoice.notes || 'Professional Software Services', qty: 1, price: invoice.subtotal || invoice.total || 0, amount: invoice.subtotal || invoice.total || 0 }
  ];
  
  const prevDuesVal = Number(invoice.previousDues || (Number(invoice.total || 0) > Number(invoice.subtotal || 0) ? Number(invoice.total) - Number(invoice.subtotal) : 0));
  const prevMonthLabel = invoice.previousDuesMonths || getPreviousInvoiceMonth(invoice.month, invoice.year);

  const compName = p.companyName || 'iSysware Software Solution';
  const compTagline = p.tagline || 'ERP • Custom Software • Web • AI Solutions';
  const compEmail = p.inquiryEmail || 'info@isysware.com';
  const compPhone = p.supportPhone || '+92 314 8843707';
  const compWebsite = p.websiteUrl || 'isysware.com';
  const compContact = [compEmail, compPhone, compWebsite].filter(Boolean).join(' • ');
  
  const bankTitle = p.accountTitle || compName;
  const bankName = p.bankName || 'Meezan Bank';
  const bankIban = p.accountIban || 'PK36MEZN00012345678901';
  const payMethod = p.paymentMethod || 'Bank Transfer / Online';
  const invSubtitle = p.invoiceSubtitle || 'Professional Services Invoice';
  const prepBy = p.preparedBy || compName;
  
  const issueDate = invoice.date || today();
  const dueDate = invoice.dueDate || invoice.due || issueDate;
  const invNo = invoice.invoiceNo || 'ISW-0001';

  const clientName = customer.name || 'Client Name';
  const clientBusinessName = business.name || customer.company || '';
  const clientPerson = customer.contactPerson || customer.name || clientName;
  const clientContact = [customer.email, customer.phone || customer.whatsapp].filter(Boolean).join(' / ') || '';
  const clientAddr = customer.address || business.address || 'Billing Address';

  const billingPeriod = invoice.billingCycle || (invoice.month && invoice.year ? `${invoice.month} ${invoice.year}` : 'Monthly Cycle');
  const servicePeriod = invoice.servicePeriod || (invoice.month && invoice.year ? `${invoice.month} ${invoice.year}` : issueDate);
  const notesTerms = invoice.notes || p.invoiceNotes || business.footerNote || 'Add payment terms, renewal note, support period, milestone details, tax note, or any client-specific instructions.';
  const thankYouMsg = p.thankYouMsg || `Thank you for choosing ${compName}. • Please reference the invoice number when making payment.`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(invNo)}</title>
  <style>
    @page {
      margin: 8mm;
      size: A4 portrait;
    }
    * { box-sizing: border-box; }
    html, body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .inv-container {
      width: 750px !important;
      max-width: 750px !important;
      margin: 0 !important;
      padding: 24px 28px !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
      border: 1.5px solid #cbd5e1 !important;
      border-radius: 10px !important;
      color: #1e293b;
    }
    .inv-top-content {
      width: 100%;
    }
    .inv-bottom-content {
      width: 100%;
    }
    
    /* Top Header */
    .inv-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .inv-brand-name {
      font-size: 24px;
      font-weight: 850;
      color: #0b4b8f;
      letter-spacing: -0.5px;
      margin: 0 0 3px;
    }
    .inv-brand-sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      margin: 0 0 3px;
    }
    .inv-brand-contact {
      font-size: 10.5px;
      color: #0284c7;
      margin: 0;
      font-weight: 500;
    }
    .inv-title-col {
      text-align: right;
    }
    .inv-main-title {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 1px;
      margin: 0 0 2px;
      line-height: 1;
    }
    .inv-main-sub {
      font-size: 11px;
      color: #64748b;
      margin: 0;
      font-weight: 500;
    }

    /* 4-Column Meta Box */
    .inv-meta-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 14px;
      background: #ffffff;
    }
    .inv-meta-item {
      padding: 7px 12px;
      border-right: 1px solid #cbd5e1;
    }
    .inv-meta-item:last-child {
      border-right: none;
    }
    .inv-meta-label {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .inv-meta-val {
      font-size: 12px;
      font-weight: 750;
      color: #0f172a;
    }

    /* 2-Column Party & Service Grid */
    .inv-party-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      margin-bottom: 14px;
      background: #ffffff;
    }
    .inv-party-col {
      padding: 10px 14px;
    }
    .inv-party-col:first-child {
      border-right: 1px solid #cbd5e1;
    }
    .inv-party-head {
      font-size: 10px;
      font-weight: 800;
      color: #0b4b8f;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .inv-party-client-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .inv-party-text {
      font-size: 11px;
      color: #334155;
      margin: 2px 0;
      line-height: 1.35;
    }

    /* Table */
    .inv-table-wrap {
      margin-bottom: 14px;
    }
    .inv-table-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #0b4b8f;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    table.inv-table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      box-sizing: border-box !important;
      page-break-inside: avoid;
    }
    table.inv-table th {
      background: #0b4b8f;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 750;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #0b4b8f;
      box-sizing: border-box !important;
    }
    table.inv-table td {
      font-size: 11px;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      box-sizing: border-box !important;
      word-break: break-word !important;
    }
    table.inv-table tbody tr:nth-child(even) {
      background: #fafcff;
    }

    /* Bottom 2-Column Section */
    .inv-bottom-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .inv-payment-box {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 9px 12px;
      background: #ffffff;
    }
    .inv-section-title {
      font-size: 10px;
      font-weight: 800;
      color: #0b4b8f;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 5px;
    }
    .inv-pay-row {
      display: flex;
      font-size: 10.5px;
      margin: 2px 0;
      line-height: 1.35;
    }
    .inv-pay-label {
      width: 85px;
      font-weight: 700;
      color: #475569;
    }
    .inv-pay-val {
      flex: 1;
      font-weight: 600;
      color: #0f172a;
    }
    .inv-notes-content {
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
      margin-top: 3px;
    }

    /* Summary Box */
    .inv-summary-box {
      background: #edf4fe;
      border: 1px solid #c7dcfb;
      border-radius: 4px;
      padding: 9px 12px;
    }
    .inv-sum-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2.5px 0;
      font-size: 11px;
      color: #334155;
    }
    .inv-sum-row.total-row {
      font-weight: 800;
      color: #0f172a;
      border-top: 1px solid #cbd5e1;
      margin-top: 4px;
      padding-top: 5px;
    }
    .inv-sum-row.due-row {
      font-size: 13.5px;
      font-weight: 900;
      color: #0b4b8f;
      border-top: 2px solid #0b4b8f;
      margin-top: 5px;
      padding-top: 5px;
    }

    /* Signature row */
    .inv-sig-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 8px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .inv-prep-by {
      font-size: 10.5px;
      color: #475569;
    }
    .inv-auth-sig {
      font-size: 10.5px;
      color: #475569;
    }

    /* Footer message */
    .inv-footer-msg {
      text-align: center;
      font-size: 10px;
      color: #0b4b8f;
      font-weight: 750;
      margin-bottom: 6px;
    }
    .inv-footer-bottom {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 5px;
    }

    @media print {
      html, body { background: #fff !important; margin: 0 !important; }
      .inv-container {
        width: 100% !important;
        max-width: 100% !important;
        border: 1.5px solid #cbd5e1 !important;
        border-radius: 10px !important;
        box-shadow: none !important;
      }
      @page { margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="inv-container">
    <div class="inv-top-content">
      <!-- Top Header -->
      <div class="inv-top">
        <div>
          <h1 class="inv-brand-name">${esc(compName)}</h1>
          <div class="inv-brand-sub">${esc(compTagline)}</div>
          <div class="inv-brand-contact">${esc(compContact)}</div>
        </div>
        <div class="inv-title-col">
          <div class="inv-main-title">INVOICE</div>
          <div class="inv-main-sub">${esc(invSubtitle)}</div>
        </div>
      </div>

      <!-- 4-Column Meta Box -->
      <div class="inv-meta-bar">
        <div class="inv-meta-item">
          <div class="inv-meta-label">INVOICE NO.</div>
          <div class="inv-meta-val">${esc(invNo)}</div>
        </div>
        <div class="inv-meta-item">
          <div class="inv-meta-label">ISSUE DATE</div>
          <div class="inv-meta-val">${esc(issueDate)}</div>
        </div>
        <div class="inv-meta-item">
          <div class="inv-meta-label">DUE DATE</div>
          <div class="inv-meta-val">${esc(dueDate)}</div>
        </div>
        <div class="inv-meta-item">
          <div class="inv-meta-label">CURRENCY</div>
          <div class="inv-meta-val">${esc(cur)}</div>
        </div>
      </div>

      <!-- Bill To & Service Details 2-Column Box -->
      <div class="inv-party-grid">
        <div class="inv-party-col">
          <div class="inv-party-head">BILL TO</div>
          <div class="inv-party-client-name">${esc(clientName)}</div>
          ${clientBusinessName ? `<div class="inv-party-text"><strong>Organization:</strong> ${esc(clientBusinessName)}</div>` : ''}
          <div class="inv-party-text">Contact: ${esc(clientPerson)}</div>
          <div class="inv-party-text">Email / Phone: ${esc(clientContact)}</div>
          <div class="inv-party-text">Billing Address: ${esc(clientAddr)}</div>
        </div>
        <div class="inv-party-col">
          <div class="inv-party-head">SERVICE DETAILS</div>
          <div class="inv-party-text"><strong>Project / Service:</strong> ${esc(invoice.project || invoice.projectName || customer.projectName || 'Enterprise Software & Cloud Billing')}</div>
          <div class="inv-party-text"><strong>Service Type:</strong> ${esc(invoice.serviceType || 'Software Development & Hosting')}</div>
          <div class="inv-party-text"><strong>Billing Cycle:</strong> ${esc(billingPeriod)}</div>
          <div class="inv-party-text"><strong>Service Period:</strong> ${esc(servicePeriod)}</div>
        </div>
      </div>

      <!-- Table: INVOICE ITEMS -->
      <div class="inv-table-wrap">
        <div class="inv-table-title">INVOICE ITEMS</div>
        <table class="inv-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 45%;">Description</th>
              <th style="width: 25%;">Billing Period / Milestone</th>
              <th style="width: 10%; text-align: center;">Qty</th>
              <th style="width: 15%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((x, idx) => `
              <tr>
                <td style="text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
                <td>
                  <strong>${esc(x.name || x.description || 'Service Deliverable')}</strong>
                  ${x.desc ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">${esc(x.desc)}</div>` : ''}
                </td>
                <td>${esc(x.period || billingPeriod)}</td>
                <td style="text-align: center;">${x.qty || 1}</td>
                <td style="text-align: right; font-weight: 700;">${money(x.amount || (Number(x.qty || 1) * Number(x.price || 0)), cur)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Bottom 2-Column Section -->
      <div class="inv-bottom-grid">
        <!-- Left: Payment Details & Notes -->
        <div class="inv-payment-box">
          <div class="inv-section-title">PAYMENT DETAILS</div>
          <div class="inv-pay-row">
            <span class="inv-pay-label">Method:</span>
            <span class="inv-pay-val">${esc(payMethod)}</span>
          </div>
          <div class="inv-pay-row">
            <span class="inv-pay-label">Account Title:</span>
            <span class="inv-pay-val">${esc(bankTitle)}</span>
          </div>
          <div class="inv-pay-row">
            <span class="inv-pay-label">Bank / Wallet:</span>
            <span class="inv-pay-val">${esc(bankName)}</span>
          </div>
          <div class="inv-pay-row">
            <span class="inv-pay-label">Account / IBAN:</span>
            <span class="inv-pay-val" style="font-family: monospace; font-size: 11px;">${esc(bankIban)}</span>
          </div>

          <div class="inv-section-title" style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 5px;">NOTES / TERMS</div>
          <div class="inv-notes-content">${esc(notesTerms)}</div>
        </div>

        <!-- Right: Financial Summary -->
        <div class="inv-summary-box">
          <div class="inv-sum-row">
            <span>Subtotal</span>
            <strong>${money(invoice.subtotal || invoice.total, cur)}</strong>
          </div>
          ${Boolean(invoice.discount) ? `
            <div class="inv-sum-row">
              <span>Discount</span>
              <strong style="color: #16a34a;">- ${money(invoice.discount, cur)}</strong>
            </div>
          ` : `
            <div class="inv-sum-row">
              <span>Discount</span>
              <span>[0.00]</span>
            </div>
          `}
          ${Boolean(invoice.taxAmount || invoice.taxPct) ? `
            <div class="inv-sum-row">
              <span>Tax / VAT ${invoice.taxPct ? `(${invoice.taxPct}%)` : ''}</span>
              <strong>${money(invoice.taxAmount, cur)}</strong>
            </div>
          ` : `
            <div class="inv-sum-row">
              <span>Tax / VAT</span>
              <span>[0.00]</span>
            </div>
          `}
          <div class="inv-sum-row total-row">
            <span>${prevDuesVal > 0 ? 'CURRENT INVOICE TOTAL' : 'TOTAL'}</span>
            <strong>${money(invoice.total, cur)}</strong>
          </div>
          ${prevDuesVal > 0 ? `
            <div class="inv-sum-row" style="color: #d97706; font-weight: 700;">
              <span>Arrears / Prev Dues ${prevMonthLabel ? `(${esc(prevMonthLabel)})` : ''}</span>
              <strong>+ ${money(prevDuesVal, cur)}</strong>
            </div>
          ` : ''}
          <div class="inv-sum-row">
            <span>Paid</span>
            <span>${money(invoice.paid || 0, cur)}</span>
          </div>
          <div class="inv-sum-row due-row">
            <span>${prevDuesVal > 0 ? 'NET AMOUNT PAYABLE' : 'BALANCE DUE'}</span>
            <span>${money(Number(invoice.balance !== undefined ? invoice.balance : invoice.total) + (prevDuesVal > 0 ? prevDuesVal : 0), cur)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Section Pinned to Bottom -->
    <div class="inv-bottom-content">
      <!-- Signatures Row -->
      <div class="inv-sig-row">
        <div class="inv-prep-by">
          <strong>Prepared By:</strong> ${esc(prepBy)}
        </div>
        <div class="inv-auth-sig">
          <strong>Authorized Signature:</strong> ______________________
        </div>
      </div>

      <!-- Footer Message & Contact -->
      <div class="inv-footer-msg">${esc(thankYouMsg)}</div>
      <div class="inv-footer-bottom">${esc(compName)} | ${esc(compEmail)} | ${esc(compPhone)} | ${esc(compWebsite)}</div>
    </div>
  </div>
</body>
</html>`;
}

export async function downloadInvoiceFile(invoice, business = {}, customer = {}, customName = '') {
  const doc = generateInvoiceHtml(invoice, business, customer);
  const filename = customName || `${invoice.invoiceNo || 'invoice'}.pdf`;
  await downloadAsPdf(doc, filename);
}
