import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { VoiceOverlay } from '../../components/VoiceOverlay';
import { getMyProfile, logVoiceInteraction } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export default function VoiceDashboard() {
  const { isListening, transcript, error, startListening, stopListening, parseIntent, setTranscript } = useVoiceRecognition();
  const { expoPushToken } = usePushNotifications();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await getMyProfile();
      setProfile(data);
    } catch (e) {
      router.replace('/login');
    }
  };

  useEffect(() => {
    if (error) {
      Alert.alert('Voice Error', error);
    }
  }, [error]);

  useEffect(() => {
    if (transcript) {
      const timeout = setTimeout(() => {
        handleTranscribedText(transcript);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [transcript]);

  const handleTranscribedText = async (text: string) => {
    const intent = parseIntent(text);
    if (intent !== 'Unknown') {
      stopListening();
      try {
        await logVoiceInteraction({
          interaction_type: 'ATTENDANCE_PUNCH',
          spoken_input: text,
          parsed_intent: { action: intent },
        });
        
        Alert.alert('Success', `Successfully recorded: ${intent}`);
        setTranscript('');
      } catch (e: any) {
        Alert.alert('Error', e.response?.data?.detail || 'Failed to submit attendance');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {profile?.employees?.name?.split(' ')[0] || 'Employee'} 👋</Text>
        <Text style={styles.subtitle}>Ready to punch in?</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Not Checked In</Text>
        </View>
      </View>

      <View style={styles.micContainer}>
        <TouchableOpacity 
          style={styles.micButton} 
          onPress={startListening}
          onLongPress={stopListening}
        >
          <Text style={styles.micIcon}>🎙️</Text>
        </TouchableOpacity>
        <Text style={styles.micHint}>Tap to speak</Text>
      </View>

      <VoiceOverlay visible={isListening} transcript={transcript} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 48,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  micIcon: {
    fontSize: 48,
  },
  micHint: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
});
