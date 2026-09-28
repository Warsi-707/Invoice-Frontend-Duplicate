import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import StatusBadge from '../common/StatusBadge';
import { money } from '../../utils/formatters';
import { generateInvoiceHtml, getPreviousInvoiceMonth } from '../../utils/invoice';
import { sendPdfToWhatsApp, downloadAsPdf, downloadAndSendWhatsApp } from '../../utils/whatsappPdf';
import { useApp } from '../../context/AppContext';

export default function InvoicePreview({
  isOpen,
  onClose,
  invoice,
  business = {},
  customer = {}
}) {
  const { state, showToast } = useApp();
  const [isSendingWa, setIsSendingWa] = useState(false);

  if (!invoice) return null;

  const p = business.proposalData || state?.settings?.proposalData || {};
  const cur = invoice.currency || business.currency || state?.settings?.currency || 'PKR';
  const items = invoice.items || [];
  const prevDuesVal = Number(invoice.previousDues || (Number(invoice.total || 0) > Number(invoice.subtotal || 0) ? Number(invoice.total) - Number(invoice.subtotal) : 0));
  const prevMonthLabel = invoice.previousDuesMonths || getPreviousInvoiceMonth(invoice.month, invoice.year);

  const handleDownload = async () => {
    showToast('⚡ Processing PDF...');
    const html = generateInvoiceHtml(invoice, { ...state?.settings, ...business, proposalData: p }, customer);
    const fileName = `${invoice.invoiceNo || 'invoice'}.pdf`;
    const phone = customer.whatsapp || customer.phone;
    const caption = `📄 *Invoice ${invoice.invoiceNo}*\n🏢 ${business.name || p.companyName || ''}\n👤 ${customer.name || 'Client'}\n💰 Total: ${money(invoice.total, cur)}`;

    await downloadAndSendWhatsApp({
      htmlContent: html,
      fileName,
      phone,
      caption,
      onWhatsAppSuccess: () => showToast(`✅ Invoice PDF sent to ${customer.name || 'Client'} via WhatsApp!`)
    });
    showToast('✅ Invoice PDF downloaded!');
  };

  const handleSendWhatsApp = async () => {
    setIsSendingWa(true);
    try {
      const phone = customer.whatsapp || customer.phone;
      if (!phone) { alert('No WhatsApp/phone number for this client.'); return; }
      showToast('⏳ Sending PDF to WhatsApp...');
      const html = generateInvoiceHtml(invoice, { ...state?.settings, ...business, proposalData: p }, customer);
      const fileName = `${invoice.invoiceNo || 'Invoice'}_${customer.name || 'Client'}.pdf`;
      const caption = `📄 *Invoice ${invoice.invoiceNo}*\n🏢 ${business.name || p.companyName || ''}\n👤 ${customer.name || 'Client'}\n💰 Total: ${money(invoice.total, cur)}`;
      await sendPdfToWhatsApp({ phone, htmlContent: html, fileName, caption });
      showToast(`✅ Invoice PDF sent to ${customer.name || 'Client'} via WhatsApp!`);
    } catch (err) {
      alert('WhatsApp error: ' + (err.message || 'Please link WhatsApp in Settings first.'));
    } finally {
      setIsSendingWa(false);
    }
  };

  const compName = p.companyName || state?.settings?.companyName || 'iSysware Software Solution';
  const compTagline = p.tagline || state?.settings?.tagline || 'ERP • Custom Software • Web • AI Solutions';
  const compEmail = p.inquiryEmail || state?.settings?.email || 'info@isysware.com';
  const compPhone = p.supportPhone || state?.settings?.phone || '+92 314 8843707';
  const compWebsite = p.websiteUrl || state?.settings?.website || 'isysware.com';
  const compContact = [compEmail, compPhone, compWebsite].filter(Boolean).join(' • ');

  const bankTitle = p.accountTitle || compName;
  const bankName = p.bankName || 'Meezan Bank';
  const bankIban = p.accountIban || 'PK36MEZN00012345678901';
  const payMethod = p.paymentMethod || 'Bank Transfer / Online';
  const invSubtitle = p.invoiceSubtitle || 'Professional Services Invoice';
  const prepBy = p.preparedBy || compName;
  const thankYouMsg = p.thankYouMsg || `Thank you for choosing ${compName}. • Please reference the invoice number when making payment.`;
  const notesTerms = invoice.notes || p.invoiceNotes || business.footerNote || state?.settings?.footerNote || 'Add payment terms, renewal note, support period, milestone details, tax note, or any client-specific instructions.';

  const issueDate = invoice.date || '';
  const dueDate = invoice.dueDate || invoice.due || issueDate;
  const invNo = invoice.invoiceNo || 'ISW-0001';

  const clientName = customer.name || 'Client Name';
  const clientBusinessName = business.name || customer.company || '';
  const clientPerson = customer.contactPerson || customer.name || clientName;
  const clientContact = [customer.email, customer.phone || customer.whatsapp].filter(Boolean).join(' / ') || '';
  const clientAddr = customer.address || business.address || 'Billing Address';

  const billingPeriod = invoice.billingCycle || (invoice.month && invoice.year ? `${invoice.month} ${invoice.year}` : 'Monthly Cycle');
  const servicePeriod = invoice.servicePeriod || (invoice.month && invoice.year ? `${invoice.month} ${invoice.year}` : issueDate);

  const headerExtra = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Button
        variant="green"
        size="xs"
        onClick={handleSendWhatsApp}
        disabled={isSendingWa}
        style={{ background: '#10b981', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        <span>💬</span>
        <span>{isSendingWa ? 'Sending...' : 'Send WhatsApp'}</span>
      </Button>
      <Button variant="light" size="xs" onClick={handleDownload}>
        ⬇ Download PDF
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Preview"
      headerExtra={headerExtra}
      maxWidth="850px"
      id="invoiceModalRoot"
    >
      <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '8px', color: '#1e293b' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '850', color: '#0b4b8f', margin: '0 0 2px', letterSpacing: '-0.5px' }}>
              {compName}
            </h1>
            <div style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px' }}>
              {compTagline}
            </div>
            <div style={{ fontSize: '10.5px', color: '#0284c7' }}>
              {compContact}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', letterSpacing: '1px', lineHeight: '1' }}>
              INVOICE
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {invSubtitle}
            </div>
          </div>
        </div>

        {/* 4-Column Meta Box */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px', background: '#ffffff' }}>
          <div style={{ padding: '6px 10px', borderRight: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
              INVOICE NO.
            </div>
            <div style={{ fontSize: '12px', fontWeight: '750', color: '#0f172a' }}>
              {invNo}
            </div>
          </div>
          <div style={{ padding: '6px 10px', borderRight: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
              ISSUE DATE
            </div>
            <div style={{ fontSize: '12px', fontWeight: '750', color: '#0f172a' }}>
              {issueDate}
            </div>
          </div>
          <div style={{ padding: '6px 10px', borderRight: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
              DUE DATE
            </div>
            <div style={{ fontSize: '12px', fontWeight: '750', color: '#0f172a' }}>
              {dueDate}
            </div>
          </div>
          <div style={{ padding: '6px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
              CURRENCY
            </div>
            <div style={{ fontSize: '12px', fontWeight: '750', color: '#0f172a' }}>
              {cur}
            </div>
          </div>
        </div>

        {/* 2-Column Bill To & Service Details Box */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #cbd5e1', borderRadius: '4px', marginBottom: '16px', background: '#ffffff' }}>
          <div style={{ padding: '10px 14px', borderRight: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              BILL TO
            </div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
              {clientName}
            </div>
            {clientBusinessName && (
              <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
                <strong>Organization:</strong> {clientBusinessName}
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              Contact: {clientPerson}
            </div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              Email / Phone: {clientContact}
            </div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              Billing Address: {clientAddr}
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              SERVICE DETAILS
            </div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              <strong>Project / Service:</strong> {invoice.project || invoice.projectName || customer.projectName || 'Enterprise Software & Cloud Billing'}
            </div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              <strong>Service Type:</strong> {invoice.serviceType || 'Software Development & Hosting'}
            </div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              <strong>Billing Cycle:</strong> {billingPeriod}
            </div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.35' }}>
              <strong>Service Period:</strong> {servicePeriod}
            </div>
          </div>
        </div>

        {/* Table: INVOICE ITEMS */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            INVOICE ITEMS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ background: '#0b4b8f', color: '#ffffff', fontSize: '10.5px', fontWeight: '750', padding: '6px 8px', textAlign: 'center', width: '5%', border: '1px solid #0b4b8f' }}>#</th>
                <th style={{ background: '#0b4b8f', color: '#ffffff', fontSize: '10.5px', fontWeight: '750', padding: '6px 8px', textAlign: 'left', width: '45%', border: '1px solid #0b4b8f' }}>Description</th>
                <th style={{ background: '#0b4b8f', color: '#ffffff', fontSize: '10.5px', fontWeight: '750', padding: '6px 8px', textAlign: 'left', width: '25%', border: '1px solid #0b4b8f' }}>Billing Period / Milestone</th>
                <th style={{ background: '#0b4b8f', color: '#ffffff', fontSize: '10.5px', fontWeight: '750', padding: '6px 8px', textAlign: 'center', width: '10%', border: '1px solid #0b4b8f' }}>Qty</th>
                <th style={{ background: '#0b4b8f', color: '#ffffff', fontSize: '10.5px', fontWeight: '750', padding: '6px 8px', textAlign: 'right', width: '15%', border: '1px solid #0b4b8f' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x, idx) => (
                <tr key={x.itemId || idx} style={{ background: idx % 2 === 1 ? '#fafcff' : '#ffffff' }}>
                  <td style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #e2e8f0' }}>
                    <strong>{x.name || x.description || 'Service Deliverable'}</strong>
                    {x.desc && <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px' }}>{x.desc}</div>}
                  </td>
                  <td style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #e2e8f0' }}>{x.period || billingPeriod}</td>
                  <td style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{x.qty || 1}</td>
                  <td style={{ fontSize: '11px', padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700' }}>
                    {money(x.amount || (Number(x.qty || 1) * Number(x.price || 0)), cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom 2-Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '14px', marginBottom: '16px' }}>
          {/* Left: Payment Details & Notes */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 12px', background: '#ffffff' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
              PAYMENT DETAILS
            </div>
            <div style={{ display: 'flex', fontSize: '10.5px', margin: '2px 0' }}>
              <span style={{ width: '85px', fontWeight: '700', color: '#475569' }}>Method:</span>
              <span style={{ flex: 1, fontWeight: '600', color: '#0f172a' }}>{payMethod}</span>
            </div>
            <div style={{ display: 'flex', fontSize: '10.5px', margin: '2px 0' }}>
              <span style={{ width: '85px', fontWeight: '700', color: '#475569' }}>Account Title:</span>
              <span style={{ flex: 1, fontWeight: '600', color: '#0f172a' }}>{bankTitle}</span>
            </div>
            <div style={{ display: 'flex', fontSize: '10.5px', margin: '2px 0' }}>
              <span style={{ width: '85px', fontWeight: '700', color: '#475569' }}>Bank / Wallet:</span>
              <span style={{ flex: 1, fontWeight: '600', color: '#0f172a' }}>{bankName}</span>
            </div>
            <div style={{ display: 'flex', fontSize: '10.5px', margin: '2px 0' }}>
              <span style={{ width: '85px', fontWeight: '700', color: '#475569' }}>Account / IBAN:</span>
              <span style={{ flex: 1, fontWeight: '600', color: '#0f172a', fontFamily: 'monospace' }}>{bankIban}</span>
            </div>

            <div style={{ fontSize: '10px', fontWeight: '800', color: '#0b4b8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '4px', marginBottom: '3px' }}>
              NOTES / TERMS
            </div>
            <div style={{ fontSize: '10px', color: '#475569', lineHeight: '1.4' }}>
              {notesTerms}
            </div>
          </div>

          {/* Right: Summary */}
          <div style={{ background: '#edf4fe', border: '1px solid #c7dcfb', borderRadius: '4px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#334155' }}>
              <span>Subtotal</span>
              <strong>{money(invoice.subtotal || invoice.total, cur)}</strong>
            </div>
            {Boolean(invoice.discount) ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#16a34a' }}>
                <span>Discount</span>
                <strong>- {money(invoice.discount, cur)}</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#64748b' }}>
                <span>Discount</span>
                <span>[0.00]</span>
              </div>
            )}
            {Boolean(invoice.taxAmount || invoice.taxPct) ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#334155' }}>
                <span>Tax / VAT {invoice.taxPct ? `(${invoice.taxPct}%)` : ''}</span>
                <strong>{money(invoice.taxAmount, cur)}</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#64748b' }}>
                <span>Tax / VAT</span>
                <span>[0.00]</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 2px', fontSize: '11.5px', fontWeight: '800', color: '#0f172a', borderTop: '1px solid #cbd5e1', marginTop: '4px' }}>
              <span>{prevDuesVal > 0 ? 'CURRENT INVOICE TOTAL' : 'TOTAL'}</span>
              <strong>{money(invoice.total, cur)}</strong>
            </div>
            {prevDuesVal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#d97706', fontWeight: '700' }}>
                <span>Arrears / Prev Dues {prevMonthLabel ? `(${prevMonthLabel})` : ''}</span>
                <strong>+ {money(prevDuesVal, cur)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px', color: '#334155' }}>
              <span>Paid</span>
              <span>{money(invoice.paid || 0, cur)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 2px', fontSize: '13.5px', fontWeight: '900', color: '#0b4b8f', borderTop: '2px solid #0b4b8f', marginTop: '4px' }}>
              <span>{prevDuesVal > 0 ? 'NET AMOUNT PAYABLE' : 'BALANCE DUE'}</span>
              <span>{money(Number(invoice.balance !== undefined ? invoice.balance : invoice.total) + (prevDuesVal > 0 ? prevDuesVal : 0), cur)}</span>
            </div>
          </div>
        </div>

        {/* Signatures Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '8px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10.5px', color: '#475569' }}>
            <strong>Prepared By:</strong> {prepBy}
          </div>
          <div style={{ fontSize: '10.5px', color: '#475569' }}>
            <strong>Authorized Signature:</strong> ______________________
          </div>
        </div>

        {/* Footer Message */}
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#0b4b8f', fontWeight: '700', marginBottom: '6px' }}>
          {thankYouMsg}
        </div>
        <div style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
          {compName} | {compEmail} | {compPhone} | {compWebsite}
        </div>
      </div>
    </Modal>
  );
}
