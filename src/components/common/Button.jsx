import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  onClick,
  disabled = false,
  ...props
}) {
  const sizeClass = size === 'xs' ? 'xs' : '';
  const variantClass = variant; // primary, light, danger, green, action-paid, action-partial, action-reversal, action-share, action-pdf

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
