import { useState, useCallback } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('speechstart', () => setIsListening(true));
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  
  useSpeechRecognitionEvent('speechend', () => setIsListening(false));
  useSpeechRecognitionEvent('end', () => setIsListening(false));

  useSpeechRecognitionEvent('error', (e) => {
    setError(e.message || 'Speech recognition failed');
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (e) => {
    if (e.results && e.results.length > 0) {
      const text = e.results[0].transcript || '';
      setTranscript(text);
    }
  });

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission not granted');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
      });
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
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
