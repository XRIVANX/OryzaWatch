import React, { useMemo } from 'react';

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  type: 'leaf' | 'dew' | 'grain';
}

export const LeafParticles: React.FC<{ count?: number }> = ({ count = 16 }) => {
  const particles: Particle[] = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: -10 - Math.random() * 40,
      size: 14 + Math.random() * 16,
      duration: 14 + Math.random() * 18,
      delay: Math.random() * 10,
      type: i % 3 === 0 ? 'leaf' : i % 3 === 1 ? 'dew' : 'grain',
    }));
  }, [count]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="leaf-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.type === 'leaf' && (
            <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C7.5 7 6 12 6 17c0 3.3 2.7 6 6 6s6-2.7 6-6c0-5-1.5-10-6-15z"
                fill="rgba(46, 158, 89, 0.16)"
                stroke="rgba(35, 126, 70, 0.28)"
                strokeWidth="0.9"
              />
              <path d="M12 4v16" stroke="rgba(35, 126, 70, 0.22)" strokeWidth="0.8" />
            </svg>
          )}
          {p.type === 'dew' && (
            <div
              style={{
                width: `${p.size / 2.5}px`,
                height: `${p.size / 2.5}px`,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(110, 231, 159, 0.4) 0%, rgba(46, 158, 89, 0.05) 70%)',
                boxShadow: '0 0 6px rgba(46, 158, 89, 0.2)',
              }}
            />
          )}
          {p.type === 'grain' && (
            <svg width={p.size * 0.8} height={p.size * 0.8} viewBox="0 0 24 24" fill="none">
              <ellipse
                cx="12"
                cy="12"
                rx="4"
                ry="8"
                transform="rotate(25 12 12)"
                fill="rgba(234, 179, 8, 0.18)"
                stroke="rgba(202, 138, 4, 0.3)"
                strokeWidth="0.8"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
};

export default LeafParticles;
