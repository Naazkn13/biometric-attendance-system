import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { getOverrides, deactivateOverride, createOverride, getEmployees } from '../../services/api';

export default function CorrectionsScreen() {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [empModalVisible, setEmpModalVisible] = useState(false);
  
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [overrideType, setOverrideType] = useState('MARK_PRESENT');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovData, empData] = await Promise.all([getOverrides(), getEmployees()]);
      setOverrides(ovData || []);
      setEmployees((empData || []).filter((e: any) => e.is_active));
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    Alert.alert('Confirm', 'Revoke this active correction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try {
          await deactivateOverride(id);
          Alert.alert('Success', 'Override revoked.');
          loadData();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || e.message);
        }
      }}
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedEmp) return Alert.alert('Error', 'Please select an employee');
    if (!reason) return Alert.alert('Error', 'Reason is required');

    setSubmitting(true);
    try {
      // Generate dates between dateFrom and dateTo
      const start = new Date(dateFrom);
      const end = new Date(dateTo);
      const dates = [];
      let current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      for (const d of dates) {
        await createOverride({
          employee_id: selectedEmp.id,
          session_date: d,
          override_type: overrideType,
          override_status: 'COMPLETE',
          reason: reason
        });
      }

      Alert.alert('Success', `Applied correction to ${dates.length} day(s)`);
      setModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  const active = overrides.filter(o => o.is_active);
  const inactive = overrides.filter(o => !o.is_active);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Corrections</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        
        {error && <Text style={styles.errorText}>❌ {error}</Text>}

        <Text style={styles.sectionTitle}>Active Corrections ({active.length})</Text>
        {active.length === 0 ? <Text style={styles.emptyText}>No active corrections.</Text> : active.map(o => (
          <View key={o.id} style={[styles.card, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.empName}>{o.employees?.name || 'Unknown'}</Text>
              <TouchableOpacity onPress={() => handleDeactivate(o.id)}>
                <Text style={styles.revokeText}>Revoke</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailsBox}>
              <Text style={styles.dateLabel}>Date: {o.session_date}</Text>
              <Text style={styles.reasonText}>"{o.reason}" ({o.override_type})</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Past Corrections</Text>
        {inactive.length === 0 ? <Text style={styles.emptyText}>No past corrections.</Text> : inactive.map(o => (
          <View key={o.id} style={[styles.card, { opacity: 0.7 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.empName}>{o.employees?.name || 'Unknown'}</Text>
              <Text style={styles.inactiveText}>INACTIVE</Text>
            </View>
            <View style={styles.detailsBox}>
              <Text style={styles.dateLabel}>Date: {o.session_date}</Text>
              <Text style={styles.reasonText}>"{o.reason}"</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Correction Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>New Correction</Text>
          
          <Text style={styles.label}>Employee</Text>
          <TouchableOpacity style={styles.input} onPress={() => setEmpModalVisible(true)}>
            <Text>{selectedEmp ? selectedEmp.name : 'Select Employee...'}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date From</Text>
              <TextInput style={styles.input} value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date To</Text>
              <TextInput style={styles.input} value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <Text style={styles.label}>Type</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {['MARK_PRESENT', 'COMPLETE_DAY'].map(t => (
              <TouchableOpacity 
                key={t} 
                style={[styles.typeBtn, overrideType === t && styles.typeBtnActive]}
                onPress={() => setOverrideType(t)}
              >
                <Text style={[styles.typeBtnText, overrideType === t && {color: '#fff'}]}>{t.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Reason</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Enter reason..." />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnRejectText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnApproveText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Employee Picker Modal */}
      <Modal visible={empModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.modalTitle}>Select Employee</Text>
            <ScrollView>
              {employees.map(e => (
                <TouchableOpacity key={e.id} style={styles.pickerItem} onPress={() => { setSelectedEmp(e); setEmpModalVisible(false); }}>
                  <Text style={styles.pickerItemText}>{e.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.btn, {marginTop: 10}]} onPress={() => setEmpModalVisible(false)}>
              <Text style={{textAlign: 'center', fontWeight: '700'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  addBtn: { backgroundColor: '#f97316', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  empName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  revokeText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  inactiveText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  detailsBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
  dateLabel: { fontSize: 13, color: '#334155', fontWeight: '600', marginBottom: 4 },
  reasonText: { fontSize: 14, color: '#64748b', fontStyle: 'italic' },
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff', paddingTop: 40 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 15 },
  typeBtn: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#3b82f6' },
  typeBtnText: { fontWeight: '600', color: '#475569', fontSize: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  btnReject: { backgroundColor: '#fff' },
  btnRejectText: { color: '#64748b', fontWeight: '600' },
  btnApprove: { backgroundColor: '#f97316', borderColor: '#f97316' },
  btnApproveText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  pickerModal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 16, fontWeight: '600', color: '#0f172a' }
});
