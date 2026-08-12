import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Image, Alert, ActivityIndicator,
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
      Alert.alert('Permission needed', 'Please grant photo library access to submit a report.');
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
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please grant camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageName(result.assets[0].fileName ?? `leaf_${Date.now()}.jpg`);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('No Image', 'Please attach a photo of the affected leaf.');
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
    <SafeAreaView style={styles.safeArea}>
      <OryzaHeader title="Submit Report" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {submitted && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.successText}>Report submitted! The MAO has been notified.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Leaf Photo *</Text>
        <Text style={styles.sectionDesc}>Attach a clear photo of the affected rice leaf.</Text>

        {/* Image Preview / Picker */}
        {imageUri ? (
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickerBtn} onPress={takePhoto} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
              <Text style={styles.pickerBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerBtn} onPress={pickImage} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={24} color={COLORS.primary} />
              <Text style={styles.pickerBtnText}>Choose from Library</Text>
            </TouchableOpacity>
          </View>
        )}

        {imageUri && (
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setImageUri(null)}>
            <Text style={styles.retakeBtnText}>Remove Photo</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Field Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the symptoms, affected area, estimated % of plants affected..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <View style={styles.infoCard}>
          <Ionicons name="location-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Your GPS coordinates will be automatically attached to this report for mapping.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.white} />
            : (
              <>
                <Ionicons name="send-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitText}>Submit Field Report</Text>
              </>
            )
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.successLight, borderWidth: 1,
    borderColor: '#bbf7d0', borderRadius: 12, padding: 14, marginBottom: 20,
  },
  successText: { flex: 1, fontSize: 13, color: COLORS.success, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  pickerBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
    backgroundColor: COLORS.white, gap: 8,
  },
  pickerBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textAlign: 'center' },
  preview: { width: '100%', height: 220, borderRadius: 12, marginBottom: 8 },
  retakeBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  retakeBtnText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  notesInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.white, minHeight: 120, marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.primaryBg, borderRadius: 10, padding: 12, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
