import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

interface Props {
  message: string;
}

export default function AlertBanner({ message }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={18} color={COLORS.warning} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  icon: {
    marginRight: 8,
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 20,
    fontWeight: '500',
  },
});
