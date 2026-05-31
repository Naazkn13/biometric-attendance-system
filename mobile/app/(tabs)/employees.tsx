import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { getEmployees } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>❌ {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Employee Directory</Text>
        
        {employees.map((emp) => (
          <TouchableOpacity key={emp.id} style={styles.card} onPress={() => setSelectedEmp(emp)}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{emp.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName} numberOfLines={1}>{emp.name}</Text>
                  <Text style={styles.empDesignation} numberOfLines={1}>{emp.designation || 'Staff'}</Text>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: emp.is_active ? '#dcfce7' : '#fee2e2' }]}>
                <Text style={[styles.badgeText, { color: emp.is_active ? '#166534' : '#991b1b' }]}>
                  {emp.is_active ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Employee Details Modal */}
      <Modal visible={!!selectedEmp} animationType="slide" presentationStyle="pageSheet">
        {selectedEmp && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Employee Details</Text>
              <TouchableOpacity onPress={() => setSelectedEmp(null)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalAvatarContainer}>
                <View style={[styles.avatar, { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3b82f6' }]}>
                  <Text style={[styles.avatarText, { fontSize: 36, color: '#fff' }]}>{selectedEmp.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.empName, { fontSize: 24, marginTop: 12 }]}>{selectedEmp.name}</Text>
                <Text style={[styles.empDesignation, { fontSize: 16 }]}>{selectedEmp.designation || 'Staff'}</Text>
                <View style={[styles.badge, { backgroundColor: selectedEmp.is_active ? '#dcfce7' : '#fee2e2', marginTop: 8 }]}>
                  <Text style={[styles.badgeText, { color: selectedEmp.is_active ? '#166534' : '#991b1b' }]}>
                    {selectedEmp.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionHeader}>HR Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Device ID / Code</Text>
                  <Text style={styles.modalValue}>{selectedEmp.device_user_id || '--'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Shift Assigned</Text>
                  <Text style={styles.modalValue}>{selectedEmp.shift?.name || 'Standard'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Base Salary</Text>
                  <Text style={styles.modalValue}>₹{selectedEmp.basic_salary || 0}</Text>
                </View>
              </View>
              
              <View style={styles.modalSection}>
                <Text style={styles.sectionHeader}>Contact</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Email</Text>
                  <Text style={styles.modalValue}>{selectedEmp.email || '--'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Phone</Text>
                  <Text style={styles.modalValue}>{selectedEmp.phone || '--'}</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
  },
  empName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  empDesignation: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
  },
  modalAvatarContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  modalSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
});
