import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadSyncFile, getMyProfile } from '../../services/api';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function AdminSyncScreen() {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userRole = await SecureStore.getItemAsync('userRole');
      if (['ADMIN', 'SUPERADMIN', 'HM'].includes(userRole || '')) {
        setIsAdmin(true);
      } else {
        Alert.alert('Unauthorized', 'You do not have permission to view this screen.');
        router.replace('/(tabs)');
      }
    } catch (e) {
      router.replace('/login');
    }
  };

  const handlePickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      if (!file.name.toLowerCase().endsWith('.dat')) {
        Alert.alert('Invalid File', 'Please select a .DAT file from the biometric device.');
        return;
      }

      setLoading(true);

      const response = await uploadSyncFile(file.uri, file.name);
      Alert.alert('Success', `File uploaded successfully. Synced ${response.synced_records} records.`);
      
    } catch (error: any) {
      Alert.alert('Upload Failed', error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Sync</Text>
        <Text style={styles.subtitle}>Upload offline .DAT files from WhatsApp</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📁</Text>
        </View>
        <Text style={styles.cardTitle}>Manual USB Sync</Text>
        <Text style={styles.cardDesc}>
          Select the .DAT file you downloaded from the Andheri device (via WhatsApp) to sync offline attendance records.
        </Text>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handlePickAndUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Select .DAT File & Upload</Text>
          )}
        </TouchableOpacity>
      </View>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
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
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
