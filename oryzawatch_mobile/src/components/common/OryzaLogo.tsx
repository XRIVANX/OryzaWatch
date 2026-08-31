import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../../utils/constants';

interface OryzaLogoProps {
  size?: number;
  showText?: boolean;
  glow?: boolean;
}

/**
 * Authentic OryzaWatch Botanical Logo Component
 * Renders the exact SVG vector emblem matching the web portal:
 * - Emerald Forest Circle (#165233)
 * - Concentric Golden Radar Rings
 * - Symmetrical Botanical Rice Leaves & Grains
 * - Crimson Red Geolocation Pin (#dc2626)
 * - Typography: "OryzaWatch" & "PREDICT. ALERT. PROTECT."
 */
export const OryzaLogo: React.FC<OryzaLogoProps> = ({
  size = 40,
  showText = false,
  glow = false,
}) => {
  // If compact icon without text (e.g. for OryzaHeader), we render a crisp Native Vector view for maximum performance and instant load
  if (!showText && size <= 48) {
    return (
      <View
        style={[
          styles.compactCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {/* Outer Emerald Glow / Ring */}
        <View
          style={[
            styles.innerRing,
            {
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
            },
          ]}
        >
          {/* Botanical Rice Stalk Graphic */}
          <Text style={{ fontSize: size * 0.46, lineHeight: size * 0.52 }}>🌾</Text>
          {/* Geolocation Pin Dot Badge */}
          <View
            style={[
              styles.compactPinBadge,
              {
                width: Math.max(size * 0.28, 9),
                height: Math.max(size * 0.28, 9),
                borderRadius: Math.max(size * 0.28, 9) / 2,
                top: size * 0.1,
                right: size * 0.1,
              },
            ]}
          >
            <View style={styles.pinCenterDot} />
          </View>
        </View>
      </View>
    );
  }

  // Full SVG mode matching web portal exact paths
  const svgHtml = showText
    ? `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; overflow:hidden; }
  body { background: transparent; display:flex; justify-content:center; align-items:center; height:100vh; width:100vw; }
  svg { display:block; width:100%; height:100%; }
</style>
</head>
<body>
<svg viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="95" fill="#165233" stroke="rgba(74, 222, 128, 0.4)" stroke-width="2" />
  <circle cx="100" cy="95" r="45" stroke="#facc15" stroke-width="0.7" stroke-dasharray="4,4" fill="none" opacity="0.3" />
  <circle cx="100" cy="95" r="30" stroke="#facc15" stroke-width="0.7" fill="none" opacity="0.4" />
  <circle cx="100" cy="95" r="15" stroke="#facc15" stroke-width="0.7" fill="none" opacity="0.5" />
  <path d="M75,130 C75,90 90,75 100,75 C110,75 125,90 125,130" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" opacity="0.8" />
  <path d="M85,130 C85,95 93,85 100,85 C107,85 115,95 115,130" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" />
  <path d="M100,130 L100,60" fill="none" stroke="#15803d" stroke-width="2.5" />
  <g transform="translate(100,95) rotate(-25) translate(-100,-95)">
    <path d="M100,105 L100,45" fill="none" stroke="#eab308" stroke-width="2" />
    <path d="M100,85 C93,80 93,73 100,70 C107,73 107,80 100,85" fill="#facc15" />
    <path d="M100,70 C93,65 93,58 100,55 C107,58 107,65 100,70" fill="#facc15" />
    <path d="M100,55 C93,50 93,43 100,40 C107,43 107,50 100,55" fill="#facc15" />
    <path d="M100,80 C90,78 88,70 98,68" fill="#facc15" />
    <path d="M100,80 C110,78 112,70 102,68" fill="#facc15" />
    <path d="M100,65 C90,63 88,55 98,53" fill="#facc15" />
    <path d="M100,65 C110,63 112,55 102,53" fill="#facc15" />
  </g>
  <g transform="translate(100,95) rotate(25) translate(-100,-95)">
    <path d="M100,105 L100,45" fill="none" stroke="#eab308" stroke-width="2" />
    <path d="M100,85 C93,80 93,73 100,70 C107,73 107,80 100,85" fill="#facc15" />
    <path d="M100,70 C93,65 93,58 100,55 C107,58 107,65 100,70" fill="#facc15" />
    <path d="M100,55 C93,50 93,43 100,40 C107,43 107,50 100,55" fill="#facc15" />
    <path d="M100,80 C90,78 88,70 98,68" fill="#facc15" />
    <path d="M100,80 C110,78 112,70 102,68" fill="#facc15" />
    <path d="M100,65 C90,63 88,55 98,53" fill="#facc15" />
    <path d="M100,65 C110,63 112,55 102,53" fill="#facc15" />
  </g>
  <g transform="translate(100,95) rotate(0) translate(-100,-95)">
    <path d="M100,105 L100,35" fill="none" stroke="#eab308" stroke-width="2" />
    <path d="M100,75 C93,70 93,63 100,60 C107,63 107,70 100,75" fill="#facc15" />
    <path d="M100,60 C93,55 93,48 100,45 C107,45 107,55 100,60" fill="#facc15" />
    <path d="M100,45 C93,40 93,33 100,30 C107,33 107,40 100,45" fill="#facc15" />
    <path d="M100,70 C90,68 88,60 98,58" fill="#facc15" />
    <path d="M100,70 C110,68 112,60 102,58" fill="#facc15" />
    <path d="M100,55 C90,53 88,45 98,43" fill="#facc15" />
    <path d="M100,55 C110,53 112,45 102,43" fill="#facc15" />
  </g>
  <g transform="translate(100,95)">
    <path d="M0,0 C-8,-8 -12,-16 -12,-24 C-12,-32 -6,-38 0,-38 C6,-38 12,-32 12,-24 C12,-16 8,-8 0,0 Z" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" />
    <circle cx="0" cy="-24" r="4.5" fill="#ffffff" />
  </g>
  <text x="100" y="153" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="-0.02em">OryzaWatch</text>
  <text x="100" y="168" font-family="-apple-system, system-ui, sans-serif" font-weight="700" font-size="6.5" fill="#facc15" text-anchor="middle" letter-spacing="0.08em">PREDICT. ALERT. PROTECT</text>
</svg>
</body>
</html>`
    : `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; overflow:hidden; }
  body { background: transparent; display:flex; justify-content:center; align-items:center; height:100vh; width:100vw; }
  svg { display:block; width:100%; height:100%; }
</style>
</head>
<body>
<svg viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="48" fill="#165233" stroke="rgba(74, 222, 128, 0.4)" stroke-width="1.5" />
  <circle cx="50" cy="48" r="22" stroke="#facc15" stroke-width="0.5" stroke-dasharray="2,2" fill="none" opacity="0.3" />
  <circle cx="50" cy="48" r="15" stroke="#facc15" stroke-width="0.5" fill="none" opacity="0.4" />
  <path d="M38,65 C38,45 45,38 50,38 C55,38 62,45 62,65" fill="none" stroke="#4ade80" stroke-width="1.5" opacity="0.8" />
  <path d="M43,65 C43,48 47,43 50,43 C53,43 57,48 57,65" fill="none" stroke="#22c55e" stroke-width="1.8" />
  <path d="M50,65 L50,30" fill="none" stroke="#15803d" stroke-width="1.2" />
  <g transform="translate(50,48) rotate(-20) translate(-50,-48)">
    <path d="M50,53 L50,23" fill="none" stroke="#eab308" stroke-width="1" />
    <path d="M50,43 C46,40 46,36 50,35 C54,36 54,40 50,43" fill="#facc15" />
    <path d="M50,35 C46,32 46,28 50,27 C54,28 54,32 50,35" fill="#facc15" />
  </g>
  <g transform="translate(50,48) rotate(20) translate(-50,-48)">
    <path d="M50,53 L50,23" fill="none" stroke="#eab308" stroke-width="1" />
    <path d="M50,43 C46,40 46,36 50,35 C54,36 54,40 50,43" fill="#facc15" />
    <path d="M50,35 C46,32 46,28 50,27 C54,28 54,32 50,35" fill="#facc15" />
  </g>
  <g transform="translate(50,48) rotate(0) translate(-50,-48)">
    <path d="M50,53 L50,18" fill="none" stroke="#eab308" stroke-width="1" />
    <path d="M50,38 C46,35 46,31 50,30 C54,31 54,35 50,38" fill="#facc15" />
    <path d="M50,30 C46,27 46,23 50,22 C54,23 54,27 50,30" fill="#facc15" />
  </g>
  <g transform="translate(50,48)">
    <path d="M0,0 C-4,-4 -6,-8 -6,-12 C-6,-16 -3,-19 0,-19 C3,-19 6,-16 6,-12 C6,-8 4,-4 0,0 Z" fill="#dc2626" stroke="#ffffff" stroke-width="0.8" />
    <circle cx="0" cy="-12" r="2" fill="#ffffff" />
  </g>
</svg>
</body>
</html>`;

  return (
    <View
      style={[
        styles.svgContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: 'transparent',
        },
      ]}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: svgHtml }}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        scalesPageToFit={false}
        androidLayerType="hardware"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCircle: {
    backgroundColor: '#165233',
    borderWidth: 1.5,
    borderColor: 'rgba(74, 222, 128, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#165233',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  innerRing: {
    borderWidth: 0.8,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compactPinBadge: {
    position: 'absolute',
    backgroundColor: '#dc2626',
    borderWidth: 1.2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCenterDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#ffffff',
  },
});

export default OryzaLogo;
