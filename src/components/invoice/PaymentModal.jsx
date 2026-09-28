import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { today, money } from '../../utils/formatters';

export default function PaymentModal({
  isOpen,
  onClose,
  invoice,
  business = {},
  customer = {},
  onSubmit
}) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(today());

  useEffect(() => {
    if (isOpen) {
      setPaymentAmount('');
      setMethod('Cash');
      setPaymentDate(today());
    }
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const cur = business.currency || 'PKR';

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount || 0);

    if (amount <= 0) {
      alert('Enter valid payment amount.');
      return;
    }

    if (amount > invoice.balance) {
      alert(`Payment amount due balance (${money(invoice.balance, cur)}) se zyada nahi ho sakti.`);
      return;
    }

    onSubmit(invoice.id, {
      amount,
      method,
      date: paymentDate || today()
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partial Payment"
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="enter-flow" autoComplete="off">
        <div className="grid two" style={{ marginBottom: '14px' }}>
          <div>
            <label>Invoice</label>
            <input className="input" value={invoice.invoiceNo} readOnly />
          </div>
          <div>
            <label>Client</label>
            <input className="input" value={customer.name || '-'} readOnly />
          </div>
          <div>
            <label>Due Amount</label>
            <input className="input" value={money(invoice.balance, cur)} readOnly />
          </div>
          <div>
            <label>
              Payment Amount <span className="req">*</span>
            </label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Enter partial amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label>
              Method <span className="req">*</span>
            </label>
            <select
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
            </select>
          </div>
          <div>
            <label>Date</label>
            <input
              className="input"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
        </div>

        <div className="actions">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Submit Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
