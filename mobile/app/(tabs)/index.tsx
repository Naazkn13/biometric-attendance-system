import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getMyProfile } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function EmployeeDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('EMPLOYEE');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userRole = await SecureStore.getItemAsync('userRole');
      setRole(userRole || 'EMPLOYEE');

      if (userRole === 'EMPLOYEE') {
        const data = await getMyProfile();
        setProfile(data);
      }
    } catch (e) {
      // If profile fetch fails for employee, redirect to login
      const userRole = await SecureStore.getItemAsync('userRole');
      if (userRole === 'EMPLOYEE') {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('userRole');
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // ── ADMIN DASHBOARD ──
  if (role === 'ADMIN') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Admin Panel 🔐</Text>
          <Text style={styles.subtitle}>Manage attendance & payroll</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.adminGrid}>
            <View style={styles.adminItem}>
              <FontAwesome name="upload" size={28} color="#3b82f6" />
              <Text style={styles.adminItemText}>Upload .dat</Text>
              <Text style={styles.adminItemHint}>Go to Admin Sync tab</Text>
            </View>
            <View style={styles.adminItem}>
              <FontAwesome name="bed" size={28} color="#f59e0b" />
              <Text style={styles.adminItemText}>Leaves</Text>
              <Text style={styles.adminItemHint}>Check pending approvals</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardText}>
            💡 Navigate to the <Text style={{ fontWeight: '800' }}>Leaves</Text> tab to manage and approve pending leave requests from employees.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── EMPLOYEE DASHBOARD ──
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {profile?.name?.split(' ')[0] || 'Employee'} 👋</Text>
        <Text style={styles.subtitle}>Welcome to your AttendPay Portal</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Employee Code:</Text>
          <Text style={styles.infoValue}>{profile?.device_user_id || '--'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Designation:</Text>
          <Text style={styles.infoValue}>{profile?.designation || 'Staff'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Shift Hours:</Text>
          <Text style={styles.infoValue}>{profile?.shift_hours || 8} Hours</Text>
        </View>
      </View>

      <View style={styles.notificationCard}>
        <Text style={styles.notificationText}>
          📱 Push Notifications are active. You will receive alerts when your attendance is synced or leaves are approved!
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <FontAwesome name="sign-out" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
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
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '700',
  },
  notificationCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 20,
  },
  notificationText: {
    color: '#1e40af',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  adminGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  adminItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  adminItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  adminItemHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoCardText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
