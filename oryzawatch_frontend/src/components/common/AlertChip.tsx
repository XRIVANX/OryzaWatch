import React from 'react';

interface AlertChipProps {
  color: string;
  bg: string;
  border: string;
  icon: string;
  label: string;
  pulse?: boolean;
}

export const AlertChip: React.FC<AlertChipProps> = ({
  color,
  bg,
  border,
  icon,
  label,
  pulse = false,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 'var(--radius-pill)',
      padding: '5px 14px',
      fontSize: '12px',
      fontWeight: 600,
      color,
      backdropFilter: 'blur(8px)',
      boxShadow: pulse ? `0 0 12px ${border}` : '0 2px 6px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease',
    }}
  >
    <span style={{ fontSize: '13px' }}>{icon}</span>
    <span>{label}</span>
  </div>
);

export default AlertChip;
