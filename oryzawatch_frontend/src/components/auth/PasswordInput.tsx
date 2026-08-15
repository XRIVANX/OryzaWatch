import React, { useState } from 'react';

interface PasswordInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = true,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' }}>
      <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
        {label} {required && <span style={{ color: 'var(--leaf-primary)' }}>*</span>}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={showPassword ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          style={{
            width: '100%',
            padding: '11px 40px 11px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: '#ffffff',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--border-focus)';
            e.target.style.boxShadow = '0 0 0 3px rgba(46, 158, 89, 0.12)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: 'absolute',
            right: '12px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
          }}
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? '👁' : '🔒'}
        </button>
      </div>
    </div>
  );
};

export default PasswordInput;
