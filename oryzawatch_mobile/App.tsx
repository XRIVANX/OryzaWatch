import React, { useRef, useEffect, useState } from 'react';
import { Animated, StyleSheet, View, Easing, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [isLoading] = useState(true);
  const [dotCount, setDotCount] = useState(0);
  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeText = useRef(new Animated.Value(0)).current;

  // Dot animation
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  // Infinite spin
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  // Fade in
  useEffect(() => {
    Animated.timing(fadeText, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [fadeText]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getDots = () => {
    switch (dotCount) {
      case 0: return '';
      case 1: return '.';
      case 2: return '..';
      case 3: return '...';
      default: return '';
    }
  };

  return (
    <View style={styles.loadingContainer}>
      <Animated.View style={[styles.contentWrapper, { opacity: fadeText }]}>
        <Text style={styles.appTitle}>🌾 OryzaWatch</Text>

        <View style={styles.messageGroup}>
          <Text style={styles.messageText}>OryzaWatch Mobile Coming Soon</Text>
          <Text style={styles.messageText}>(Working Progress)</Text>
        </View>

        <Text style={styles.loadingText}>
          Loading{getDots()}
        </Text>

        {/* Fixed leaf container – square and centered */}
        <Animated.View
          style={[
            styles.leafContainer,
            { transform: [{ rotate: spin }] },
          ]}
        >
          <Text style={styles.leaf}>🌿</Text>
        </Animated.View>
      </Animated.View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f9f0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  contentWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  appTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#1b5e20',
    marginBottom: 20,
  },
  messageGroup: {
    alignItems: 'center',
    marginBottom: 20,
  },
  messageText: {
    fontSize: 20,
    color: '#2e7d32',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 28,
    marginBottom: 2,
  },
  loadingText: {
    fontSize: 18,
    color: '#558b2f',
    fontWeight: '500',
    marginBottom: 25,
    textAlign: 'center',
    minWidth: 100,
  },
  leafContainer: {
    width: 70,          // square container
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaf: {
    fontSize: 56,
    textAlign: 'center',
    lineHeight: 70,     // match container height to center vertically
  },
});