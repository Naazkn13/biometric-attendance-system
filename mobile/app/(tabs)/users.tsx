import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { getAdmins, createAdmin, getEmployees, setEmployeePassword } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function UsersScreen() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'admins' | 'employees'>('admins');

  const [adminModal, setAdminModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPw, setNewPw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, e] = await Promise.all([getAdmins(), getEmployees()]);
      setAdmins(a || []);
      setEmployees(e || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Username and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      await createAdmin(newUsername.trim(), newPassword);
      await loadData();
      setAdminModal(false);
      setNewUsername('');
      setNewPassword('');
      Alert.alert('Success', 'Admin account created.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to create admin');
    } finally {
      setSubmitting(false);
    }
  };

  const openPwModal = (emp: any) => {
    setSelectedEmp(emp);
    setNewPw('');
    setPwModal(true);
  };

  const handleSetPassword = async () => {
    if (!newPw.trim()) {
      Alert.alert('Error', 'Password cannot be empty.');
      return;
    }
    setSubmitting(true);
    try {
      await setEmployeePassword(selectedEmp.id, newPw);
      setPwModal(false);
      Alert.alert('Success', `Password set for ${selectedEmp.name}.`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to set password');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'admins' && styles.tabBtnActive]}
          onPress={() => setTab('admins')}
        >
          <Text style={[styles.tabText, tab === 'admins' && styles.tabTextActive]}>
            Admins ({admins.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'employees' && styles.tabBtnActive]}
          onPress={() => setTab('employees')}
        >
          <Text style={[styles.tabText, tab === 'employees' && styles.tabTextActive]}>
            Employee Access ({employees.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {tab === 'admins' ? (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => setAdminModal(true)}>
              <FontAwesome name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add Admin</Text>
            </TouchableOpacity>

            {admins.map((admin) => (
              <View key={admin.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <FontAwesome name="shield" size={18} color="#8b5cf6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{admin.username}</Text>
                    <Text style={styles.meta}>Last login: {formatDate(admin.last_login_at)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: admin.is_active ? '#dcfce7' : '#fee2e2' }]}>
                    <Text style={[styles.badgeText, { color: admin.is_active ? '#166534' : '#991b1b' }]}>
                      {admin.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {admins.length === 0 && (
              <View style={styles.empty}>
                <FontAwesome name="shield" size={36} color="#cbd5e1" />
                <Text style={styles.emptyText}>No admin accounts</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionNote}>
              Set or reset login passwords for employee mobile app access.
            </Text>
            {employees.map((emp) => (
              <View key={emp.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: '#f5f3ff' }]}>
                    <Text style={[styles.avatarText, { color: '#8b5cf6' }]}>
                      {emp.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{emp.name}</Text>
                    <Text style={styles.meta}>ID: {emp.device_user_id || '--'}</Text>
                  </View>
                  <TouchableOpacity style={styles.pwBtn} onPress={() => openPwModal(emp)}>
                    <FontAwesome name="key" size={13} color="#8b5cf6" />
                    <Text style={styles.pwBtnText}>Set PW</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Admin Modal */}
      <Modal visible={adminModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Admin Account</Text>
            <TouchableOpacity onPress={() => setAdminModal(false)}>
              <Text style={styles.closeBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter username"
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter password"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreateAdmin}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Creating...' : 'Create Admin'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Set Employee Password Modal */}
      <Modal visible={pwModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Password</Text>
            <TouchableOpacity onPress={() => setPwModal(false)}>
              <Text style={styles.closeBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.empNameLabel}>{selectedEmp?.name}</Text>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPw}
              onChangeText={setNewPw}
              placeholder="Enter new password"
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSetPassword}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Saving...' : 'Save Password'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#8b5cf6', borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#8b5cf6' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#8b5cf6' },
  scrollContainer: { padding: 16, paddingBottom: 100 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#8b5cf6', borderRadius: 12,
    paddingVertical: 12, marginBottom: 16,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionNote: { fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  pwBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#f5f3ff', borderRadius: 8,
  },
  pwBtnText: { fontSize: 12, fontWeight: '700', color: '#8b5cf6' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: '#f1f5f9' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  closeBtn: { fontSize: 15, fontWeight: '700', color: '#8b5cf6' },
  modalBody: { padding: 20 },
  empNameLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#8b5cf6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
