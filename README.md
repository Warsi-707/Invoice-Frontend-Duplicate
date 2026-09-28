# Invoice Manager - Frontend

Production-quality React.js frontend for multi-business billing, customer management, invoice generation, payment collections, reversals, reports, and settings.

## Technology Stack
- **Framework**: React.js 18
- **Build Tool**: Vite
- **Language**: JavaScript (ESM)
- **Styling**: Vanilla CSS (faithfully matched with approved prototype design system)
- **State Management**: React Context (`AppContext`) with `localStorage` persistence

## Project Structure
```
frontend/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Topbar.jsx
│   │   │   ├── AppLayout.jsx
│   │   │   └── AdminModal.jsx
│   │   ├── common/
│   │   │   ├── Button.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── Toast.jsx
│   │   └── invoice/
│   │       ├── InvoicePreview.jsx
│   │       ├── InvoiceItems.jsx
│   │       └── PaymentModal.jsx
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── BusinessCustomerPage.jsx
│   │   ├── InvoiceGeneratorPage.jsx
│   │   ├── InvoiceCollectionPage.jsx
│   │   ├── ReversalsPage.jsx
│   │   ├── ReportsPage.jsx
│   │   └── SettingsPage.jsx
│   ├── context/
│   │   └── AppContext.jsx
│   ├── services/
│   │   └── api.js
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── invoice.js
│   │   ├── storage.js
│   │   └── enterFlow.js
│   └── styles/
│       └── app.css
└── README.md
```

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build production bundle:
   ```bash
   npm run build
   ```
