import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import OryzaHeader from '../../components/common/OryzaHeader';
import ScanningOverlay from '../../components/common/ScanningOverlay';
import { diagnosticsApi } from '../../api/diagnostics';
import { COLORS, DISEASE_LABELS } from '../../utils/constants';
import {
  classifyLeafFromUri,
  isOnDeviceAvailable,
  onDeviceUnavailableReason,
  warmUpLeafModel,
  type LocalDiagnosis,
} from '../../ml/leafModel';
import type { LeafScan } from '../../types';

const DISEASE_COLOR: Record<string, string> = {
  HEALTHY: COLORS.success,
  BLB: COLORS.danger,
  BLAST: COLORS.warning,
};

export default function SubmitReportScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  // Fallback only, for on-device inference on a build that hasn't been
  // rebuilt with the native fast-resize module yet - see classifyLeafFromUri.
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState('leaf.jpg');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onDeviceSupported = isOnDeviceAvailable();
  const [onDeviceEnabled, setOnDeviceEnabled] = useState(onDeviceSupported);
  const [localDx, setLocalDx] = useState<LocalDiagnosis | null>(null);
  const [localDxRunning, setLocalDxRunning] = useState(false);
  const [localDxError, setLocalDxError] = useState<string | null>(null);
  const [serverDx, setServerDx] = useState<Pick<
    LeafScan,
    'detected_disease' | 'confidence_score' | 'heatmap' | 'segmentation_mask' | 'affected_area_ratio'
  > | null>(null);

  useEffect(() => {
    if (onDeviceSupported) warmUpLeafModel();
  }, [onDeviceSupported]);

  const runLocalDiagnosis = async (uri: string | null, base64: string | null) => {
    if (!uri || !onDeviceEnabled || !onDeviceSupported) return;
    setLocalDxRunning(true);
    setLocalDxError(null);
    setLocalDx(null);
    try {
      setLocalDx(await classifyLeafFromUri(uri, base64));
    } catch (e: any) {
      setLocalDxError(e?.message ?? 'On-device diagnosis failed.');
    } finally {
      setLocalDxRunning(false);
    }
  };

  const acceptPickerResult = (
    result: ImagePicker.ImagePickerResult,
    fallbackName: string,
  ) => {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setImageBase64(asset.base64 ?? null);
    setImageName(asset.fileName ?? fallbackName);
    setSubmitted(false);
    setServerDx(null);
    void runLocalDiagnosis(asset.uri, asset.base64 ?? null);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please grant photo library access to submit a field report.');
      return;
    }
    // No allowsEditing/aspect - the full photo is used as-is (a forced 4:3 crop
    // step here was cutting off part of the leaf before the user could submit).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    acceptPickerResult(result, 'leaf.jpg');
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please grant camera access to take a leaf sample photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });
    acceptPickerResult(result, `leaf_${Date.now()}.jpg`);
  };

  const clearImage = () => {
    setImageUri(null);
    setImageBase64(null);
    setLocalDx(null);
    setLocalDxError(null);
    setServerDx(null);
  };

  const toggleOnDevice = (value: boolean) => {
    setOnDeviceEnabled(value);
    if (value) void runLocalDiagnosis(imageUri, imageBase64);
    else {
      setLocalDx(null);
      setLocalDxError(null);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('Leaf Photo Required', 'Please capture or attach a photo of the affected rice leaf.');
      return;
    }
    setSubmitting(true);
    try {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      let lat = 7.3047, lng = 125.6839;
      if (locPerm.status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        // The backend stores these as DecimalField(decimal_places=6) and rejects
        // anything more precise; raw GPS readings often come back with more
        // digits than that (float precision), so round before sending.
        lat = Number(loc.coords.latitude.toFixed(6));
        lng = Number(loc.coords.longitude.toFixed(6));
      }
      const scan = await diagnosticsApi.uploadScan({
        imageUri,
        imageName,
        imageType: 'image/jpeg',
        latitude: lat,
        longitude: lng,
      });
      setServerDx({
        detected_disease: scan.detected_disease,
        confidence_score: scan.confidence_score,
        heatmap: scan.heatmap,
        segmentation_mask: scan.segmentation_mask,
        affected_area_ratio: scan.affected_area_ratio,
      });
      setSubmitted(true);
      clearImage();
      setNotes('');
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <OryzaHeader title="Submit Field Report" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {submitted && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Report Dispatched Successfully!</Text>
              <Text style={styles.successDesc}>The diagnostic sample has been logged and the MAO dashboard notified.</Text>
              {serverDx && (
                <Text style={styles.successDesc}>
                  Server diagnosis: {DISEASE_LABELS[serverDx.detected_disease] ?? serverDx.detected_disease}
                  {' '}({(serverDx.confidence_score * 100).toFixed(1)}%)
                  {typeof serverDx.affected_area_ratio === 'number'
                    ? ` · ${Math.round(serverDx.affected_area_ratio * 100)}% of leaf affected`
                    : ''}
                </Text>
              )}
              {serverDx?.heatmap && (
                <Image
                  source={{ uri: serverDx.heatmap }}
                  style={styles.explainabilityPreview}
                  resizeMode="cover"
                />
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>LEAF SAMPLE PHOTO *</Text>
        <Text style={styles.sectionDesc}>Capture or select a high-resolution close-up of the infected leaf area.</Text>

        {/* Image Preview / Picker */}
        {imageUri ? (
          <View style={styles.previewContainer}>
            <View style={styles.previewImageWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              <ScanningOverlay
                active={localDxRunning || submitting}
                label={submitting ? 'Uploading & analyzing…' : 'Scanning leaf on device…'}
              />
            </View>
            <TouchableOpacity style={styles.retakeBtn} onPress={clearImage} activeOpacity={0.7} disabled={submitting}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={styles.retakeBtnText}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickerBtn} onPress={takePhoto} activeOpacity={0.85}>
              <View style={styles.pickerIconCircle}>
                <Ionicons name="camera" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.pickerBtnText}>Take Camera Photo</Text>
              <Text style={styles.pickerBtnSub}>Direct Field Capture</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={pickImage} activeOpacity={0.85}>
              <View style={styles.pickerIconCircle}>
                <Ionicons name="images" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.pickerBtnText}>Choose from Library</Text>
              <Text style={styles.pickerBtnSub}>Select Gallery Image</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* On-device (offline) diagnosis */}
        <View style={styles.odRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.odTitle}>On-device diagnosis</Text>
            <Text style={styles.odSub}>
              {onDeviceSupported
                ? 'Runs the bundled AI model offline for an instant field estimate.'
                : onDeviceUnavailableReason()}
            </Text>
          </View>
          <Switch
            value={onDeviceEnabled}
            onValueChange={toggleOnDevice}
            disabled={!onDeviceSupported}
            trackColor={{ true: COLORS.primaryBright, false: COLORS.border }}
            thumbColor={COLORS.white}
          />
        </View>

        {onDeviceEnabled && onDeviceSupported && (localDxRunning || localDx || localDxError) && (
          <View style={styles.dxCard}>
            {localDxRunning && (
              <View style={styles.dxRunning}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.dxRunningText}>Analyzing leaf on device…</Text>
              </View>
            )}

            {!localDxRunning && localDxError && (
              <Text style={styles.dxErrorText}>
                <Ionicons name="warning-outline" size={13} color={COLORS.danger} /> {localDxError}
              </Text>
            )}

            {!localDxRunning && localDx && (
              <>
                <View style={styles.dxHeader}>
                  <Text style={styles.dxHeaderLabel}>ON-DEVICE ESTIMATE</Text>
                  <View style={[styles.dxPill, { backgroundColor: (DISEASE_COLOR[localDx.disease] ?? COLORS.primary) + '22' }]}>
                    <Text style={[styles.dxPillText, { color: DISEASE_COLOR[localDx.disease] ?? COLORS.primary }]}>
                      {DISEASE_LABELS[localDx.disease] ?? localDx.disease} · {(localDx.confidence * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
                {(['HEALTHY', 'BLB', 'BLAST'] as const).map((cls) => {
                  const p = localDx.probabilities[cls] ?? 0;
                  return (
                    <View key={cls} style={styles.dxBarRow}>
                      <Text style={styles.dxBarLabel}>{DISEASE_LABELS[cls] ?? cls}</Text>
                      <View style={styles.dxBarTrack}>
                        <View
                          style={[
                            styles.dxBarFill,
                            { width: `${Math.round(p * 100)}%`, backgroundColor: DISEASE_COLOR[cls] ?? COLORS.primary },
                          ]}
                        />
                      </View>
                      <Text style={styles.dxBarPct}>{(p * 100).toFixed(0)}%</Text>
                    </View>
                  );
                })}
                <Text style={styles.dxFootnote}>
                  Advisory only. The server re-runs the diagnosis on upload and that result is authoritative.
                </Text>
              </>
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>FIELD OBSERVATIONS (OPTIONAL)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe symptoms (e.g. water-soaked lesions, yellowing, blast spots, approximate % of plot affected)..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.infoCard}>
          <Ionicons name="navigate-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Your current GPS coordinates will automatically pin this sample to the Municipal Spatiotemporal Map.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color={COLORS.white} />
              <Text style={styles.submitText}>Submit for AI Diagnostic</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.successLight,
    borderWidth: 1.2,
    borderColor: COLORS.successBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  successTitle: { fontSize: 13.5, color: COLORS.successText, fontWeight: '800' },
  successDesc: { fontSize: 12, color: COLORS.successText, marginTop: 2, lineHeight: 17 },
  explainabilityPreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 2,
  },
  sectionDesc: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginBottom: 14,
    marginLeft: 2,
  },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  pickerBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.borderBright,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  pickerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pickerBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  pickerBtnSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  previewContainer: {
    marginBottom: 12,
  },
  previewImageWrap: {
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  retakeBtnText: { fontSize: 12.5, color: COLORS.danger, fontWeight: '700' },
  odRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  odTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.textPrimary },
  odSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
  dxCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    gap: 8,
  },
  dxRunning: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dxRunningText: { fontSize: 12.5, color: COLORS.textSecondary },
  dxErrorText: { fontSize: 12, color: COLORS.dangerText, lineHeight: 17 },
  dxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dxHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
  },
  dxPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dxPillText: { fontSize: 11.5, fontWeight: '800' },
  dxBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dxBarLabel: { fontSize: 11, color: COLORS.textSecondary, width: 118 },
  dxBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  dxBarFill: { height: 8, borderRadius: 4 },
  dxBarPct: { fontSize: 11, color: COLORS.textSecondary, width: 34, textAlign: 'right' },
  dxFootnote: { fontSize: 10.5, color: COLORS.textMuted, marginTop: 4, lineHeight: 15 },
  notesInput: {
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    minHeight: 110,
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.primaryBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.primaryPastel,
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18, fontWeight: '500' },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});
