import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text, Easing } from 'react-native';
import { COLORS } from '../../utils/constants';

interface ScanningOverlayProps {
  active: boolean;
  label?: string;
}

// A viewfinder-style scan animation to overlay on a leaf photo preview while
// on-device or server AI diagnosis is running. Pure Animated/View (no new
// native deps) so it drops into any image preview.
export default function ScanningOverlay({ active, label = 'Scanning leaf…' }: ScanningOverlayProps) {
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!active) return;
    sweep.setValue(0);
    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false, // animates `top` (layout), not eligible for the native driver
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    sweepLoop.start();
    glowLoop.start();
    return () => {
      sweepLoop.stop();
      glowLoop.stop();
    };
  }, [active, sweep, glow]);

  if (!active) return null;

  const top = sweep.interpolate({ inputRange: [0, 1], outputRange: ['6%', '90%'] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={styles.tint} />

      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      <Animated.View style={[styles.scanLineWrap, { top }]}>
        <Animated.View style={[styles.scanGlow, { opacity: glow }]} />
        <View style={styles.scanLine} />
      </Animated.View>

      <View style={styles.labelWrap}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

const CORNER_SIZE = 22;

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 20, 12, 0.18)',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: COLORS.primaryBright,
  },
  cornerTL: { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanLineWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'stretch',
  },
  scanGlow: {
    height: 14,
    marginTop: -6,
    backgroundColor: COLORS.primaryBright,
    opacity: 0.35,
    borderRadius: 7,
  },
  scanLine: {
    height: 2,
    marginTop: -8,
    backgroundColor: COLORS.primaryBright,
    borderRadius: 1,
    shadowColor: COLORS.primaryBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  labelWrap: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 20, 12, 0.55)',
  },
  labelText: {
    color: COLORS.white,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
