import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { getOverrides, deactivateOverride, createOverride, getEmployees, getCorrectionLog } from '../../services/api';

const TYPE_LABELS: any = {
  SET_PUNCH_OUT: 'Set Punch Out',
  SET_PUNCH_IN: 'Set Punch In',
  SET_BOTH: 'Set Both',
  MARK_ABSENT: 'Mark Absent',
  MARK_PRESENT: 'Mark Present',
  OVERRIDE_HOURS: 'Override Hours',
};

function needsIn(type: string) { return ['SET_PUNCH_IN', 'SET_BOTH'].includes(type); }
function needsOut(type: string) { return ['SET_PUNCH_OUT', 'SET_BOTH'].includes(type); }
function needsHours(type: string) { return ['MARK_PRESENT', 'OVERRIDE_HOURS'].includes(type); }

export default function CorrectionsScreen() {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [empModalVisible, setEmpModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [overrideType, setOverrideType] = useState('SET_PUNCH_OUT');
  const [punchIn, setPunchIn] = useState('');
  const [punchOut, setPunchOut] = useState('');
  const [netHours, setNetHours] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const formatDateInput = (text: string, setter: (val: string) => void) => {
    let val = text.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    if (val.length > 4) val = val.substring(0, 4) + '-' + val.substring(4);
    if (val.length > 7) val = val.substring(0, 7) + '-' + val.substring(7);
    setter(val);
  };

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

  const loadLog = async () => {
    try {
      const data = await getCorrectionLog();
      setLog(data || []);
      setLogModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load audit log');
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
    if (!date) return Alert.alert('Error', 'Date is required');
    if (!reason) return Alert.alert('Error', 'Reason is required');

    if (needsIn(overrideType) && !punchIn) return Alert.alert('Error', 'Punch In time required (HH:MM)');
    if (needsOut(overrideType) && !punchOut) return Alert.alert('Error', 'Punch Out time required (HH:MM)');
    if (needsHours(overrideType) && !netHours) return Alert.alert('Error', 'Net Hours required');

    setSubmitting(true);
    try {
      const payload: any = {
        employee_id: selectedEmp.id,
        session_date: date,
        override_type: overrideType,
        reason: reason
      };

      if (needsIn(overrideType) && punchIn) {
        payload.override_punch_in = new Date(`${date}T${punchIn}`).toISOString();
      }
      if (needsOut(overrideType) && punchOut) {
        payload.override_punch_out = new Date(`${date}T${punchOut}`).toISOString();
      }
      if (needsHours(overrideType) && netHours) {
        payload.override_net_hours = parseFloat(netHours);
      }

      await createOverride(payload);

      Alert.alert('Success', `Correction applied`);
      setModalVisible(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && overrides.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  const active = overrides.filter(o => o.is_active);
  const inactive = overrides.filter(o => !o.is_active);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Corrections</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.logBtn} onPress={loadLog}>
              <Text style={styles.logBtnText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
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
              <Text style={styles.typeLabel}>{TYPE_LABELS[o.override_type] || o.override_type}</Text>
              <Text style={styles.valText}>
                {o.override_punch_in && `IN: ${new Date(o.override_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} `}
                {o.override_punch_out && `OUT: ${new Date(o.override_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} `}
                {o.override_net_hours && `Hrs: ${o.override_net_hours}`}
              </Text>
              <Text style={styles.reasonText}>"{o.reason}"</Text>
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
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={styles.modalTitle}>New Correction</Text>
          
          <Text style={styles.label}>Employee *</Text>
          <TouchableOpacity style={styles.input} onPress={() => setEmpModalVisible(true)}>
            <Text>{selectedEmp ? selectedEmp.name : 'Select Employee...'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Date *</Text>
          <TextInput 
            style={styles.input} 
            value={date} 
            onChangeText={(text) => formatDateInput(text, setDate)} 
            placeholder="YYYY-MM-DD" 
            keyboardType="numeric"
            maxLength={10}
          />

          <Text style={styles.label}>Type *</Text>
          <View style={styles.typeGrid}>
            {Object.entries(TYPE_LABELS).map(([key, label]: any) => (
              <TouchableOpacity 
                key={key} 
                style={[styles.typeBtn, overrideType === key && styles.typeBtnActive]}
                onPress={() => setOverrideType(key)}
              >
                <Text style={[styles.typeBtnText, overrideType === key && {color: '#fff'}]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {needsIn(overrideType) && (
            <View>
              <Text style={styles.label}>Punch In Time (HH:MM) *</Text>
              <TextInput style={styles.input} value={punchIn} onChangeText={setPunchIn} placeholder="09:30" />
            </View>
          )}

          {needsOut(overrideType) && (
            <View>
              <Text style={styles.label}>Punch Out Time (HH:MM) *</Text>
              <TextInput style={styles.input} value={punchOut} onChangeText={setPunchOut} placeholder="18:30" />
            </View>
          )}

          {needsHours(overrideType) && (
            <View>
              <Text style={styles.label}>Net Hours *</Text>
              <TextInput style={styles.input} value={netHours} onChangeText={setNetHours} placeholder="e.g. 8.5" keyboardType="numeric" />
            </View>
          )}

          <Text style={styles.label}>Reason *</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Enter reason..." />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnRejectText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnApproveText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
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

      {/* Audit Log Modal */}
      <Modal visible={logModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Audit Log</Text>
          <ScrollView>
            {log.length === 0 ? <Text style={styles.emptyText}>No log entries found.</Text> : log.map(entry => {
               const act = entry.action === 'CREATED' ? 'bg-green' : entry.action === 'DEACTIVATED' ? 'bg-red' : 'bg-gray';
               return (
                 <View key={entry.id} style={styles.logCard}>
                   <View style={styles.logHeader}>
                     <Text style={[styles.logAction, act === 'bg-green' ? {color: '#16a34a'} : act === 'bg-red' ? {color: '#dc2626'} : {}]}>{entry.action}</Text>
                     <Text style={styles.logTime}>{new Date(entry.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
                   </View>
                   <Text style={styles.logEmp}>{entry.session_overrides?.employees?.name || 'Unknown'}</Text>
                   <Text style={styles.logDetail}>Date: {entry.session_overrides?.session_date}</Text>
                   <Text style={styles.logDetail}>By: {entry.performed_by_name}</Text>
                 </View>
               );
            })}
          </ScrollView>
          <TouchableOpacity style={[styles.btn, {marginTop: 10}]} onPress={() => setLogModalVisible(false)}>
            <Text style={{textAlign: 'center', fontWeight: '700'}}>Close</Text>
          </TouchableOpacity>
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
  logBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  logBtnText: { color: '#475569', fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  empName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  revokeText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  inactiveText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  detailsBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
  dateLabel: { fontSize: 13, color: '#334155', fontWeight: '800', marginBottom: 2 },
  typeLabel: { fontSize: 12, color: '#0ea5e9', fontWeight: '700', marginBottom: 4 },
  valText: { fontSize: 12, fontFamily: 'monospace', color: '#475569', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff', paddingTop: 40 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  typeBtn: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', minWidth: '45%' },
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
  pickerItemText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  logCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logAction: { fontSize: 12, fontWeight: '800' },
  logTime: { fontSize: 11, color: '#94a3b8' },
  logEmp: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  logDetail: { fontSize: 12, color: '#475569' }
});
