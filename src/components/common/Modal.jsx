import React, { useEffect } from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  headerExtra = null,
  maxWidth = '950px',
  children,
  id = ''
}) {
  if (!isOpen) return null;

  return (
    <div
      id={id}
      className={`modal ${isOpen ? 'show' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="modal-box"
        style={{ width: `min(${maxWidth}, 96vw)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {headerExtra}
            <button
              type="button"
              className="close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
