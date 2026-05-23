import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';

interface VoiceOverlayProps {
  visible: boolean;
  transcript: string;
}

export function VoiceOverlay({ visible, transcript }: VoiceOverlayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.micCircle}>
            <Text style={styles.micIcon}>🎙️</Text>
          </View>
          
          <Text style={styles.statusText}>Listening...</Text>
          <Text style={styles.transcriptText}>
            {transcript || "Say 'Punch In' or 'Punch Out'"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
  },
  pulseCircle: {
    position: 'absolute',
    top: 32,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    zIndex: 2,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  micIcon: {
    fontSize: 32,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  transcriptText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    minHeight: 40,
  },
});
