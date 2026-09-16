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
import ThemedDialog from '../../components/common/ThemedDialog';
import ScanResultCard, { LOW_CONFIDENCE } from '../../components/scan/ScanResultCard';
import { diagnosticsApi } from '../../api/diagnostics';
import { analyticsApi } from '../../api/analytics';
import { COLORS, DISEASE_LABELS } from '../../utils/constants';
import { diseaseGuidance } from '../../utils/diseaseAdvice';
import { prepareImageForUpload } from '../../utils/uploadImage';
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

type DialogState = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  title: string;
  message: string;
  highlight?: { label: string; text: string };
  actions: { label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'danger' }[];
};

export default function SubmitReportScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  // Fallback only, for on-device inference on a build that hasn't been
  // rebuilt with the native fast-resize module yet - see classifyLeafFromUri.
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState('leaf.jpg');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onDeviceSupported = isOnDeviceAvailable();
  // Defaults to OFF every time the screen loads - offline inference is a
  // convenience for no-signal fields, not the norm, so it should never be
  // silently on without the farmer choosing it (see toggleOnDevice's warning).
  const [onDeviceEnabled, setOnDeviceEnabled] = useState(false);
  const [localDx, setLocalDx] = useState<LocalDiagnosis | null>(null);
  const [localDxRunning, setLocalDxRunning] = useState(false);
  const [localDxError, setLocalDxError] = useState<string | null>(null);
  // The full upload response, so the result card can show everything the web
  // dashboard shows (per-class breakdown, heatmap, affected area, lesions).
  const [serverDx, setServerDx] = useState<LeafScan | null>(null);
  const [reportStatus, setReportStatus] = useState<'idle' | 'reporting' | 'reported' | 'declined' | 'error'>('idle');
  const [dialog, setDialog] = useState<DialogState | null>(null);

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
    setImageSize({ width: asset.width ?? 0, height: asset.height ?? 0 });
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

  // Resets just the picker/on-device state - used after a successful submit,
  // where serverDx must survive so the success banner can still show it.
  const resetPicker = () => {
    setImageUri(null);
    setImageBase64(null);
    setLocalDx(null);
    setLocalDxError(null);
  };

  // Full reset - used by "Remove Photo", where any previous result should
  // disappear too.
  const clearImage = () => {
    resetPicker();
    setServerDx(null);
    setReportStatus('idle');
  };

  const toggleOnDevice = (value: boolean) => {
    setOnDeviceEnabled(value);
    if (value) {
      Alert.alert(
        'Offline Mode',
        "On-device diagnosis isn't as accurate as the server's full analysis. It's meant for when you have no signal — an internet connection is recommended whenever it's available.",
        [{ text: 'Got it' }],
      );
      void runLocalDiagnosis(imageUri, imageBase64);
    } else {
      setLocalDx(null);
      setLocalDxError(null);
    }
  };

  const submitReport = async (scanId: number) => {
    setReportStatus('reporting');
    try {
      await analyticsApi.reportScan(scanId);
      setReportStatus('reported');
    } catch (e: any) {
      setReportStatus('error');
      setDialog({
        icon: 'cloud-offline-outline',
        iconColor: COLORS.danger,
        title: 'Report Failed',
        message: e?.message ?? 'Please try again from your scan history.',
        actions: [{ label: 'OK', variant: 'primary', onPress: () => setDialog(null) }],
      });
    }
  };

  const promptToReport = (scan: LeafScan) => {
    const diseaseLabel = DISEASE_LABELS[scan.detected_disease] ?? scan.detected_disease;
    const unsure = scan.confidence_score < LOW_CONFIDENCE
      ? " The AI isn't sure about this photo, so consider retaking a closer one first."
      : '';
    setDialog({
      icon: 'alert-circle',
      iconColor: COLORS.danger,
      title: `${diseaseLabel} Detected`,
      message: `${diseaseLabel} was found in this sample.${unsure} Report it to your Agri-Kagawad and the MAO so they can respond?`,
      highlight: { label: 'HOW TO TREAT IT NOW', text: diseaseGuidance(scan.detected_disease).treatment },
      actions: [
        { label: 'Not now', variant: 'outline', onPress: () => { setReportStatus('declined'); setDialog(null); } },
        { label: 'Report', variant: 'primary', onPress: () => { setDialog(null); void submitReport(scan.id); } },
      ],
    });
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      setDialog({
        icon: 'image-outline',
        iconColor: COLORS.primary,
        title: 'Leaf Photo Required',
        message: 'Please capture or attach a photo of the affected rice leaf before submitting.',
        actions: [{ label: 'OK', variant: 'primary', onPress: () => setDialog(null) }],
      });
      return;
    }
    setSubmitting(true);
    setReportStatus('idle');
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
      const upload = await prepareImageForUpload(imageUri, imageName, imageSize.width, imageSize.height);
      const scan = await diagnosticsApi.uploadScan({
        imageUri: upload.uri,
        imageName: upload.name,
        imageType: upload.type,
        latitude: lat,
        longitude: lng,
      });
      setServerDx(scan);
      setSubmitted(true);
      resetPicker();
      setNotes('');
      if (scan.detected_disease !== 'HEALTHY') {
        promptToReport(scan);
      }
    } catch (e: any) {
      if (e?.status === 422) {
        // The server's rice-leaf check rejected the photo (a face, an object,
        // or a non-rice plant). Nothing was saved.
        setDialog({
          icon: 'leaf-outline',
          iconColor: COLORS.warning,
          title: 'Not a Rice Leaf',
          message:
            e.message ||
            "This doesn't look like a rice leaf. Take a close, well-lit photo of a single rice leaf so it fills most of the frame.",
          actions: [
            { label: 'Cancel', variant: 'outline', onPress: () => setDialog(null) },
            { label: 'Retake Photo', variant: 'primary', onPress: () => { setDialog(null); clearImage(); void takePhoto(); } },
          ],
        });
        return;
      }
      setDialog({
        icon: 'warning-outline',
        iconColor: COLORS.danger,
        title: 'Submission Failed',
        message: e?.message || 'Please try again.',
        actions: [{ label: 'OK', variant: 'primary', onPress: () => setDialog(null) }],
      });
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
              <Text style={styles.successTitle}>Scan Saved Successfully!</Text>
              <Text style={styles.successDesc}>The diagnostic sample has been logged to your scan history.</Text>
              {reportStatus === 'reporting' && (
                <Text style={styles.successDesc}>Reporting to your Agri-Kagawad…</Text>
              )}
              {reportStatus === 'reported' && (
                <Text style={[styles.successDesc, { fontWeight: '800' }]}>
                  ✓ Reported — your Agri-Kagawad and the MAO have been notified.
                </Text>
              )}
              {reportStatus === 'declined' && (
                <Text style={styles.successDesc}>Saved to your history only — not reported.</Text>
              )}
              {reportStatus === 'error' && (
                <Text style={[styles.successDesc, { color: COLORS.dangerText }]}>
                  Could not send the report. You can try again from your scan history.
                </Text>
              )}
            </View>
          </View>
        )}

        {submitted && serverDx && <ScanResultCard scan={serverDx} />}

        <Text style={[styles.sectionTitle, submitted && serverDx ? { marginTop: 20 } : null]}>LEAF SAMPLE PHOTO *</Text>
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

      <ThemedDialog
        visible={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        icon={dialog?.icon}
        iconColor={dialog?.iconColor}
        highlight={dialog?.highlight}
        actions={dialog?.actions ?? []}
        onRequestClose={() => setDialog(null)}
      />
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
