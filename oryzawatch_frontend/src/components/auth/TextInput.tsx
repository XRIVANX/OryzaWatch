import React from 'react';

interface TextInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = true,
  icon,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' }}>
    <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
      {label} {required && <span style={{ color: 'var(--leaf-primary)' }}>*</span>}
    </label>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && (
        <span style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          {icon}
        </span>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: icon ? '11px 14px 11px 40px' : '11px 14px',
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
    </div>
  </div>
);

export default TextInput;
