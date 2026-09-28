import React from 'react';
import WhatsAppScannerCard from '../components/whatsapp/WhatsAppScannerCard';

export default function WhatsAppScanPage() {
  return (
    <div className="wa-scan-page-wrapper">
      <div className="wa-scan-container">
        <div className="wa-scan-header-logo">
          <div className="logo-icon">📊</div>
          <h2>Invoice Manager — WhatsApp Link</h2>
        </div>
        <WhatsAppScannerCard isStandalone={true} />
      </div>
    </div>
  );
}
