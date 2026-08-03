import type { CSSProperties, ChangeEvent } from 'react';

interface PasswordProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}

const Password = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = true,
}: PasswordProps) => {
  return (
    <div style={styles.group}>
      <label style={styles.label}>{label}</label>
      <input
        type="password"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  group: { display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '14px' },
  label: { fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 },
  input: {
    padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
    fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
};

export default Password;