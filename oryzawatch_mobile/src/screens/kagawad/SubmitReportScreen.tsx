import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import OryzaHeader from '../../components/common/OryzaHeader';
import { diagnosticsApi } from '../../api/diagnostics';
import { COLORS } from '../../utils/constants';

export default function SubmitReportScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState('leaf.jpg');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please grant photo library access to submit a field report.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageName(result.assets[0].fileName ?? 'leaf.jpg');
      setSubmitted(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please grant camera access to take a leaf sample photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageName(result.assets[0].fileName ?? `leaf_${Date.now()}.jpg`);
      setSubmitted(false);
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
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      await diagnosticsApi.uploadScan({
        imageUri,
        imageName,
        imageType: 'image/jpeg',
        latitude: lat,
        longitude: lng,
      });
      setSubmitted(true);
      setImageUri(null);
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
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>LEAF SAMPLE PHOTO *</Text>
        <Text style={styles.sectionDesc}>Capture or select a high-resolution close-up of the infected leaf area.</Text>

        {/* Image Preview / Picker */}
        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setImageUri(null)} activeOpacity={0.7}>
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
