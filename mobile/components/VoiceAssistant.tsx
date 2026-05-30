import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import * as Speech from 'expo-speech';
import { logVoiceInteraction, getPendingLeaves, approveLeave } from '../services/api';
import * as SecureStore from 'expo-secure-store';

export default function VoiceAssistant() {
  const { isListening, transcript, error, startListening, stopListening, parseIntent, setTranscript } = useVoiceRecognition();
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (transcript && !isListening) {
      processCommand(transcript);
    }
  }, [isListening, transcript]);

  const speak = (text: string) => {
    Speech.speak(text, { language: 'en-US' });
    setFeedback(text);
    setTimeout(() => setFeedback(null), 5000);
  };

  const processCommand = async (text: string) => {
    setProcessing(true);
    setFeedback('Processing...');
    
    const parsed = parseIntent(text);
    let speechResult = '';
    let actionTaken = {};
    
    try {
      const role = await SecureStore.getItemAsync('userRole');

      if (parsed.intent === 'APPROVE_LEAVE') {
        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
          speechResult = "You don't have permission to approve leaves.";
        } else {
          // Fetch pending leaves and approve the first one as an example
          const pending = await getPendingLeaves();
          if (pending && pending.length > 0) {
            const leave = pending[0];
            await approveLeave(leave.id);
            speechResult = `Approved leave for ${leave.employees?.name || 'employee'}.`;
            actionTaken = { action: 'approve_leave', leave_id: leave.id };
          } else {
            speechResult = "There are no pending leaves to approve.";
          }
        }
      } else if (parsed.intent === 'APPLY_LEAVE') {
         speechResult = "Please use the form in the Leaves tab to select your dates.";
      } else {
        speechResult = "I didn't understand that command.";
      }

      speak(speechResult);

      // Log it
      await logVoiceInteraction({
        interaction_type: parsed.intent,
        spoken_input: text,
        parsed_intent: parsed,
        whispr_response: speechResult,
        action_taken: actionTaken,
      });

    } catch (e: any) {
      speechResult = "An error occurred while processing your request.";
      speak(speechResult);
    } finally {
      setProcessing(false);
      setTranscript('');
    }
  };

  return (
    <View style={styles.container}>
      {feedback && (
        <View style={styles.feedbackBubble}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
      
      {transcript ? (
        <View style={styles.transcriptBubble}>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      ) : null}

      <TouchableOpacity 
        style={[styles.micButton, isListening ? styles.listening : null]}
        onPressIn={startListening}
        onPressOut={stopListening}
        activeOpacity={0.7}
      >
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <FontAwesome name="microphone" size={28} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  listening: {
    backgroundColor: '#ef4444',
    transform: [{ scale: 1.1 }],
  },
  transcriptBubble: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: 250,
  },
  transcriptText: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
  },
  feedbackBubble: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: 250,
  },
  feedbackText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
