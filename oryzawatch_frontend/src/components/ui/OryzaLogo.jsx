

const OryzaLogo = ({ size = 32, showText = false }) => {
  if (showText) {
    return (
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: 'block' }}>
        {/* Circle Background */}
        <circle cx="100" cy="100" r="95" fill="#165233" />
        
        {/* Concentric rings */}
        <circle cx="100" cy="95" r="45" stroke="#facc15" strokeWidth="0.7" strokeDasharray="4,4" fill="none" opacity="0.3" />
        <circle cx="100" cy="95" r="30" stroke="#facc15" strokeWidth="0.7" fill="none" opacity="0.4" />
        <circle cx="100" cy="95" r="15" stroke="#facc15" strokeWidth="0.7" fill="none" opacity="0.5" />

        {/* Leaves */}
        <path d="M75,130 C75,90 90,75 100,75 C110,75 125,90 125,130" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <path d="M85,130 C85,95 93,85 100,85 C107,85 115,95 115,130" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M100,130 L100,60" fill="none" stroke="#15803d" strokeWidth="2.5" />

        {/* Rice Stalks (Yellow/Gold grains) */}
        {/* Left stalk */}
        <g transform="translate(100,95) rotate(-25) translate(-100,-95)">
          <path d="M100,105 L100,45" fill="none" stroke="#eab308" strokeWidth="2" />
          <path d="M100,85 C93,80 93,73 100,70 C107,73 107,80 100,85" fill="#facc15" />
          <path d="M100,70 C93,65 93,58 100,55 C107,58 107,65 100,70" fill="#facc15" />
          <path d="M100,55 C93,50 93,43 100,40 C107,43 107,50 100,55" fill="#facc15" />
          <path d="M100,80 C90,78 88,70 98,68" fill="#facc15" />
          <path d="M100,80 C110,78 112,70 102,68" fill="#facc15" />
          <path d="M100,65 C90,63 88,55 98,53" fill="#facc15" />
          <path d="M100,65 C110,63 112,55 102,53" fill="#facc15" />
        </g>

        {/* Right stalk */}
        <g transform="translate(100,95) rotate(25) translate(-100,-95)">
          <path d="M100,105 L100,45" fill="none" stroke="#eab308" strokeWidth="2" />
          <path d="M100,85 C93,80 93,73 100,70 C107,73 107,80 100,85" fill="#facc15" />
          <path d="M100,70 C93,65 93,58 100,55 C107,58 107,65 100,70" fill="#facc15" />
          <path d="M100,55 C93,50 93,43 100,40 C107,43 107,50 100,55" fill="#facc15" />
          <path d="M100,80 C90,78 88,70 98,68" fill="#facc15" />
          <path d="M100,80 C110,78 112,70 102,68" fill="#facc15" />
          <path d="M100,65 C90,63 88,55 98,53" fill="#facc15" />
          <path d="M100,65 C110,63 112,55 102,53" fill="#facc15" />
        </g>
        
        {/* Center stalk */}
        <g transform="translate(100,95) rotate(0) translate(-100,-95)">
          <path d="M100,105 L100,35" fill="none" stroke="#eab308" strokeWidth="2" />
          <path d="M100,75 C93,70 93,63 100,60 C107,63 107,70 100,75" fill="#facc15" />
          <path d="M100,60 C93,55 93,48 100,45 C107,45 107,55 100,60" fill="#facc15" />
          <path d="M100,45 C93,40 93,33 100,30 C107,33 107,40 100,45" fill="#facc15" />
          <path d="M100,70 C90,68 88,60 98,58" fill="#facc15" />
          <path d="M100,70 C110,68 112,60 102,58" fill="#facc15" />
          <path d="M100,55 C90,53 88,45 98,43" fill="#facc15" />
          <path d="M100,55 C110,53 112,45 102,43" fill="#facc15" />
        </g>

        {/* Pin */}
        <g transform="translate(100,95)">
          <path d="M0,0 C-8,-8 -12,-16 -12,-24 C-12,-32 -6,-38 0,-38 C6,-38 12,-32 12,-24 C12,-16 8,-8 0,0 Z" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="0" cy="-24" r="4.5" fill="#ffffff" />
        </g>

        {/* Text */}
        <text x="100" y="152" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="16" fill="#ffffff" textAnchor="middle" letterSpacing="-0.02em">OryzaWatch</text>
        <text x="100" y="167" fontFamily="'Inter', sans-serif" fontWeight="700" fontSize="6.5" fill="#facc15" textAnchor="middle" letterSpacing="0.08em">PREDICT. ALERT. PROTECT</text>
      </svg>
    );
  }

  // Icon only mode
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block' }}>
      <circle cx="50" cy="50" r="48" fill="#165233" />
      
      {/* Concentric rings */}
      <circle cx="50" cy="48" r="22" stroke="#facc15" strokeWidth="0.5" strokeDasharray="2,2" fill="none" opacity="0.3" />
      <circle cx="50" cy="48" r="15" stroke="#facc15" strokeWidth="0.5" fill="none" opacity="0.4" />

      {/* Leaves */}
      <path d="M38,65 C38,45 45,38 50,38 C55,38 62,45 62,65" fill="none" stroke="#4ade80" strokeWidth="1.5" opacity="0.8" />
      <path d="M43,65 C43,48 47,43 50,43 C53,43 57,48 57,65" fill="none" stroke="#22c55e" strokeWidth="1.8" />
      <path d="M50,65 L50,30" fill="none" stroke="#15803d" strokeWidth="1.2" />

      {/* Stalks */}
      <g transform="translate(50,48) rotate(-20) translate(-50,-48)">
        <path d="M50,53 L50,23" fill="none" stroke="#eab308" strokeWidth="1" />
        <path d="M50,43 C46,40 46,36 50,35 C54,36 54,40 50,43" fill="#facc15" />
        <path d="M50,35 C46,32 46,28 50,27 C54,28 54,32 50,35" fill="#facc15" />
      </g>
      <g transform="translate(50,48) rotate(20) translate(-50,-48)">
        <path d="M50,53 L50,23" fill="none" stroke="#eab308" strokeWidth="1" />
        <path d="M50,43 C46,40 46,36 50,35 C54,36 54,40 50,43" fill="#facc15" />
        <path d="M50,35 C46,32 46,28 50,27 C54,28 54,32 50,35" fill="#facc15" />
      </g>
      <g transform="translate(50,48) rotate(0) translate(-50,-48)">
        <path d="M50,53 L50,18" fill="none" stroke="#eab308" strokeWidth="1" />
        <path d="M50,38 C46,35 46,31 50,30 C54,31 54,35 50,38" fill="#facc15" />
        <path d="M50,30 C46,27 46,23 50,22 C54,23 54,27 50,30" fill="#facc15" />
      </g>

      {/* Pin */}
      <g transform="translate(50,48)">
        <path d="M0,0 C-4,-4 -6,-8 -6,-12 C-6,-16 -3,-19 0,-19 C3,-19 6,-16 6,-12 C6,-8 4,-4 0,0 Z" fill="#dc2626" stroke="#ffffff" strokeWidth="0.8" />
        <circle cx="0" cy="-12" r="2" fill="#ffffff" />
      </g>
    </svg>
  );
};

export default OryzaLogo;
