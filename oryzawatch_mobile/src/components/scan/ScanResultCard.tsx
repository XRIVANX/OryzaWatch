// ─────────────────────────────────────────────────────────────────────────────
// Full server diagnosis for one uploaded scan - the mobile counterpart of the
// web dashboard's ScanResultCard (oryzawatch_frontend/src/components/post/
// ScanResultCard.tsx), so both apps show the same analysis for the same photo:
// per-class confidence, Grad-CAM heatmap, affected-area mask, lesion count,
// severity, treatment and spread risk.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, DISEASE_LABELS } from '../../utils/constants';
import { diseaseGuidance } from '../../utils/diseaseAdvice';
import type { LeafScan } from '../../types';

const CLASS_ORDER = ['HEALTHY', 'BLB', 'BLAST'];

// Below this, the photo is probably too far, blurry or unlike the model's
// training close-ups, so the farmer is asked to retake it before acting on it.
export const LOW_CONFIDENCE = 0.7;

interface Props {
  scan: Pick<
    LeafScan,
    'detected_disease' | 'confidence_score' | 'probabilities' | 'heatmap' | 'segmentation_mask' | 'affected_area_ratio' | 'lesion_boxes'
  >;
}

export default function ScanResultCard({ scan }: Props) {
  const guidance = diseaseGuidance(scan.detected_disease);
  const label = DISEASE_LABELS[scan.detected_disease] ?? scan.detected_disease;
  const lowConfidence = scan.confidence_score < LOW_CONFIDENCE;
  const probabilities = scan.probabilities ?? null;
  const lesionCount = scan.lesion_boxes?.length ?? 0;

  return (
    <View style={[styles.card, { borderColor: guidance.color + '55' }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.kickerRow}>
            <View style={[styles.dot, { backgroundColor: guidance.color }]} />
            <Text style={[styles.kicker, { color: guidance.color }]}>AI DIAGNOSIS</Text>
          </View>
          <Text style={styles.disease}>{label}</Text>
        </View>
        <View style={[styles.confidencePill, { backgroundColor: guidance.color + '1f' }]}>
          <Text style={[styles.confidenceText, { color: guidance.color }]}>
            {(scan.confidence_score * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {lowConfidence && (
        <View style={styles.notice}>
          <Ionicons name="camera-reverse-outline" size={16} color={COLORS.warningText} />
          <Text style={styles.noticeText}>
            The AI isn't sure about this photo. For a reliable result, retake a close, well-lit photo of one leaf so it
            fills most of the frame.
          </Text>
        </View>
      )}

      {probabilities && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONFIDENCE BREAKDOWN</Text>
          {CLASS_ORDER.filter((cls) => cls in probabilities).map((cls) => {
            const pct = Math.round((probabilities[cls] ?? 0) * 100);
            return (
              <View key={cls} style={styles.barRow}>
                <Text style={styles.barLabel}>{DISEASE_LABELS[cls] ?? cls}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: diseaseGuidance(cls).color }]} />
                </View>
                <Text style={styles.barPct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {(scan.heatmap || scan.segmentation_mask) && (
        <View style={styles.imageRow}>
          {scan.heatmap && (
            <View style={styles.imageCol}>
              <Text style={styles.sectionLabel}>WHY THIS DIAGNOSIS</Text>
              <Image source={{ uri: scan.heatmap }} style={styles.image} resizeMode="cover" />
            </View>
          )}
          {scan.segmentation_mask && (
            <View style={styles.imageCol}>
              <Text style={styles.sectionLabel}>
                AFFECTED AREA
                {typeof scan.affected_area_ratio === 'number' ? ` · ${Math.round(scan.affected_area_ratio * 100)}%` : ''}
              </Text>
              <Image source={{ uri: scan.segmentation_mask }} style={styles.image} resizeMode="cover" />
            </View>
          )}
        </View>
      )}

      {lesionCount > 0 && (
        <Text style={styles.lesions}>
          <Ionicons name="search" size={12} color={COLORS.textSecondary} /> {lesionCount} lesion
          {lesionCount === 1 ? '' : 's'} detected
        </Text>
      )}

      <View style={[styles.section, styles.adviceBox]}>
        <Text style={styles.sectionLabel}>THREAT SEVERITY</Text>
        <Text style={[styles.adviceStrong, { color: guidance.color }]}>{guidance.severity}</Text>
        <Text style={[styles.sectionLabel, styles.adviceGap]}>WHAT TO DO NOW</Text>
        <Text style={styles.adviceText}>{guidance.treatment}</Text>
        <Text style={[styles.sectionLabel, styles.adviceGap]}>SPREAD RISK</Text>
        <Text style={styles.adviceText}>{guidance.spread}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1.2,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  disease: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary, marginTop: 3 },
  confidencePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  confidenceText: { fontSize: 14, fontWeight: '800' },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight,
    borderColor: COLORS.warningBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  noticeText: { flex: 1, fontSize: 12, color: COLORS.warningText, lineHeight: 17 },
  section: { gap: 7 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: COLORS.textMuted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 11.5, color: COLORS.textSecondary, width: 124 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barPct: { fontSize: 11.5, fontWeight: '700', color: COLORS.textPrimary, width: 36, textAlign: 'right' },
  imageRow: { flexDirection: 'row', gap: 10 },
  imageCol: { flex: 1, gap: 6 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  lesions: { fontSize: 12, color: COLORS.textSecondary },
  adviceBox: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, gap: 3 },
  adviceGap: { marginTop: 8 },
  adviceStrong: { fontSize: 13, fontWeight: '800' },
  adviceText: { fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 18 },
});
