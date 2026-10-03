import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { today, money } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

export default function PaymentModal({
  isOpen,
  onClose,
  invoice,
  business = {},
  customer = {},
  mode = 'partial', // 'full' | 'partial'
  onSubmit
}) {
  const { state } = useApp();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [trxRef, setTrxRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());

  // Extract Bank Details from Settings
  const bank = state.settings?.bankDetails || {};
  const prop = state.settings?.proposalData || {};
  const activeBankName = bank.bankName || prop.bankName || '';
  const activeAccountTitle = bank.accountTitle || prop.accountTitle || '';
  const activeAccountIban = bank.accountIban || prop.accountIban || '';
  const activeBranch = bank.branchCode || prop.branchCode || '';

  useEffect(() => {
    if (isOpen && invoice) {
      if (mode === 'full') {
        setPaymentAmount(String(invoice.balance || 0));
      } else {
        setPaymentAmount('');
      }
      setMethod('Cash');
      setTrxRef('');
      setPaymentDate(today());
    }
  }, [isOpen, invoice, mode]);

  if (!invoice) return null;

  const cur = business.currency || 'PKR';
  const isFull = mode === 'full';

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = isFull ? Number(invoice.balance || 0) : Number(paymentAmount || 0);

    if (amount <= 0) {
      alert('Enter valid payment amount.');
      return;
    }

    if (amount > invoice.balance) {
      alert(`Payment amount due balance (${money(invoice.balance, cur)}) se zyada nahi ho sakti.`);
      return;
    }

    // Determine final method description
    let finalMethod = method;
    if (method === 'Online') {
      const bankLabel = activeBankName ? `Online - ${activeBankName}` : 'Online Bank Transfer';
      finalMethod = trxRef.trim() ? `${bankLabel} (Ref: ${trxRef.trim()})` : bankLabel;
    }

    onSubmit(invoice.id, {
      amount,
      method: finalMethod,
      date: paymentDate || today(),
      mode
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFull ? 'Full Payment Clearance' : 'Partial Payment'}
      maxWidth="580px"
    >
      <form onSubmit={handleSubmit} className="enter-flow" autoComplete="off">
        <div style={{
          marginBottom: '14px',
          padding: '10px 14px',
          background: isFull ? '#f0fdf4' : '#f8fafc',
          border: isFull ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>
              {isFull ? 'Payment Type: Full Settlement' : 'Payment Type: Partial Installment'}
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
              Invoice {invoice.invoiceNo} • {customer.name || 'Client'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Outstanding Due</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626' }}>
              {money(invoice.balance, cur)}
            </div>
          </div>
        </div>

        <div className="grid two" style={{ marginBottom: '14px' }}>
          <div>
            <label>
              Payment Amount ({cur}) <span className="req">*</span>
            </label>
            <input
              className="input"
              type="number"
              min="1"
              max={invoice.balance}
              placeholder={isFull ? money(invoice.balance, cur) : 'Enter partial amount'}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              readOnly={isFull}
              autoComplete="off"
              autoFocus={!isFull}
              style={isFull ? { background: '#f1f5f9', fontWeight: 700, color: '#16a34a' } : { fontWeight: 600 }}
            />
            {isFull && (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                ✓ Complete remaining balance will be settled.
              </span>
            )}
          </div>

          <div>
            <label>
              Payment Method <span className="req">*</span>
            </label>
            <select
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              <option value="Cash">💵 Cash in Hand</option>
              <option value="Online">🏦 Online / Bank Transfer</option>
            </select>
          </div>

          <div>
            <label>Payment Date <span className="req">*</span></label>
            <input
              className="input"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div>
            <label>Received By</label>
            <input
              className="input"
              value={state.session?.username || state.settings?.admin || 'Admin'}
              readOnly
              style={{ background: '#f8fafc', color: '#475569' }}
            />
          </div>

          {/* Dedicated Online Bank Transfer Details Box */}
          {method === 'Online' && (
            <div style={{
              gridColumn: '1 / -1',
              background: '#f0f9ff',
              border: '1.5px solid #0284c7',
              borderRadius: '10px',
              padding: '14px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: 700, fontSize: '13px' }}>
                  <span>🏦</span> Deposit Bank Account (From Settings)
                </div>
                {activeBankName && (
                  <span style={{ fontSize: '11px', background: '#bae6fd', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    {activeBankName}
                  </span>
                )}
              </div>

              {activeBankName || activeAccountIban ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '12.5px', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e0f2fe' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Bank Name:</span><br />
                    <strong style={{ color: '#0f172a' }}>{activeBankName || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Account Title:</span><br />
                    <strong style={{ color: '#0f172a' }}>{activeAccountTitle || '-'}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748b' }}>Account / IBAN:</span><br />
                    <strong style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '13px' }}>{activeAccountIban || '-'}</strong>
                  </div>
                  {activeBranch && (
                    <div style={{ gridColumn: '1 / -1', color: '#64748b', fontSize: '11.5px' }}>
                      <em>Note: {activeBranch}</em>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#0284c7', background: '#e0f2fe', padding: '8px 12px', borderRadius: '6px' }}>
                  💡 Tip: Aap <strong>Settings &gt; Organization &gt; Online Banking</strong> mein apna Bank Name aur IBAN save kar lein, toh woh hamesha yahan auto-display hoga.
                </div>
              )}

              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: 600 }}>
                  Online Transaction / Ref ID (Optional)
                </label>
                <input
                  className="input"
                  style={{ padding: '7px 10px', fontSize: '12.5px', marginTop: '3px', background: '#ffffff' }}
                  placeholder="e.g. TID-9847234 or Meezan Transfer # 8721"
                  value={trxRef}
                  onChange={(e) => setTrxRef(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        <div className="actions" style={{ marginTop: '16px' }}>
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" style={isFull ? { background: '#16a34a', borderColor: '#16a34a' } : {}}>
            {isFull ? 'Confirm Full Payment' : 'Submit Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
