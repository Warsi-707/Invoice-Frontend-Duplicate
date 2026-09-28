import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const result = await login(username, password);
      if (!result?.success) {
        setErrorMessage(result?.message || 'Invalid username or password. Default is: admin123');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="loginScreen" className="login-screen">
      <div className="login-shell">
        <div className="login-intro">
          <div className="login-brand">
            <div className="login-brand-mark">IM</div>
            <div>
              <strong>Invoice Manager</strong>
              <small>Multi Business Billing</small>
            </div>
          </div>

          <div className="login-copy">
            <div className="eyebrow">Business Billing Portal</div>
            <h1>Simple invoicing for multiple businesses.</h1>
            <p>
              Manage businesses and customers, generate monthly invoices, collect payments,
              track paid and partial invoices, and keep reversal records in one clean portal.
            </p>
            <div className="login-features">
              <span>Business / Customer</span>
              <span>Invoice Generator</span>
              <span>Collections</span>
              <span>Partial Paid</span>
              <span>Reversals</span>
              <span>Reports</span>
            </div>
          </div>

          <div className="login-foot">© 2026 Invoice Manager. All rights reserved.</div>
        </div>

        <div className="login-form-wrap">
          <h2>Admin Portal</h2>
          <div className="login-sub">Sign in to access the invoice management dashboard.</div>

          {errorMessage && (
            <div className="login-error show" style={{ display: 'block' }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form enter-flow" autoComplete="off">
            <div>
              <label>Username</label>
              <input
                id="loginUser"
                className="login-input"
                placeholder="Administrator"
                autoComplete="off"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage('');
                }}
              />
            </div>
            <div>
              <label>Password</label>
              <input
                id="loginPass"
                className="login-input"
                type="password"
                placeholder="Enter password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
              />
            </div>
            <button type="submit" className="login-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Login Now'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
