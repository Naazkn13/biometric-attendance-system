import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            await SecureStore.deleteItemAsync('token');
            router.replace('/');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6' }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
          <FontAwesome name="user-md" size={40} color={colors.tint} style={{ marginBottom: 10 }} />
          <Text style={[styles.roleText, { color: colors.text }]}>Logged in as Doctor</Text>
          <Text style={{ color: colors.text, opacity: 0.5 }}>V-Care Hospital Admin</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
          
          <TouchableOpacity style={[styles.actionRow, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FontAwesome name="users" size={18} color={colors.text} style={{ width: 25 }} />
              <Text style={{ color: colors.text, fontSize: 16 }}>Manage Employees</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={colors.text} style={{ opacity: 0.3 }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRow, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FontAwesome name="mobile-phone" size={22} color={colors.text} style={{ width: 25, marginLeft: 2 }} />
              <Text style={{ color: colors.text, fontSize: 16 }}>Manage Devices</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={colors.text} style={{ opacity: 0.3 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={18} color="white" style={{ marginRight: 10 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20 },
  infoCard: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleText: { fontSize: 18, fontWeight: 'bold' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.5, marginBottom: 10, marginLeft: 5 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
