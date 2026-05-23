import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ExpoSpeechRecognition from 'expo-speech-recognition';

export function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Note: expo-speech-recognition API might vary slightly, but generally follows standard speech events
  useEffect(() => {
    const startSub = ExpoSpeechRecognition.addSpeechStartListener(() => setIsListening(true));
    const endSub = ExpoSpeechRecognition.addSpeechEndListener(() => setIsListening(false));
    const errorSub = ExpoSpeechRecognition.addSpeechErrorListener((e) => {
      setError(e.error?.message || 'Speech recognition failed');
      setIsListening(false);
    });
    const resultSub = ExpoSpeechRecognition.addSpeechResultsListener((e) => {
      const text = e.results?.[0]?.transcript || '';
      setTranscript(text);
    });

    return () => {
      startSub.remove();
      endSub.remove();
      errorSub.remove();
      resultSub.remove();
    };
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    try {
      const { granted } = await ExpoSpeechRecognition.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission not granted');
        return;
      }
      await ExpoSpeechRecognition.startSpeechRecognitionAsync({
        language: 'en-US',
      });
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      await ExpoSpeechRecognition.stopSpeechRecognitionAsync();
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const parseIntent = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('punch in') || lower.includes('check in')) {
      return 'Punch In';
    }
    if (lower.includes('punch out') || lower.includes('check out') || lower.includes('checkout')) {
      return 'Punch Out';
    }
    return 'Unknown';
  };

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    parseIntent,
    setTranscript,
  };
}
