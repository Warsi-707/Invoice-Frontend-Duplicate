import React from 'react';
import Button from '../common/Button';
import { money } from '../../utils/formatters';

export default function InvoiceItems({
  items,
  onChange,
  currency = 'PKR'
}) {
  const handleItemChange = (index, field, value) => {
    const updated = items.map((item, idx) => {
      if (idx !== index) return item;
      const newItem = { ...item, [field]: value };
      const q = Math.max(0, Number(newItem.qty || 0));
      const p = Math.max(0, Number(newItem.price || 0));
      newItem.amount = q * p;
      return newItem;
    });
    onChange(updated);
  };

  const handleAddItem = () => {
    onChange([
      ...items,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: '',
        qty: 1,
        price: '',
        amount: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      // If only 1 row, clear it instead of removing
      onChange([
        {
          id: `item-${Date.now()}`,
          name: '',
          qty: 1,
          price: '',
          amount: 0
        }
      ]);
    } else {
      onChange(items.filter((_, idx) => idx !== index));
    }
  };

  return (
    <div className="items-card">
      <div className="items-card-head">
        <h3>Items / Services</h3>
        <Button variant="light" size="xs" onClick={handleAddItem}>
          + Add Item
        </Button>
      </div>

      <div className="items-grid-header">
        <div>Description *</div>
        <div>Qty</div>
        <div>Unit Price</div>
        <div>Amount</div>
        <div></div>
      </div>

      <div className="item-stack">
        {items.map((item, index) => {
          const qtyNum = Math.max(0, Number(item.qty || 0));
          const priceNum = Math.max(0, Number(item.price || 0));
          const rowAmount = qtyNum * priceNum;

          return (
            <div key={item.id || index} className="item-row">
              <div>
                <input
                  className="input"
                  placeholder="Item or service description"
                  value={item.name || ''}
                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={item.qty ?? 1}
                  onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={item.price ?? ''}
                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="amount-box">
                {money(rowAmount, currency)}
              </div>
              <div>
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => handleRemoveItem(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="item-help">
        Product, service, rent, repair, consultancy, spare parts — kisi bhi business ka item likh sakte ho.
      </div>
    </div>
  );
}
