import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function HolidaysScreen() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('EMPLOYEE');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(r => setRole(r || 'EMPLOYEE'));
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await getHolidays();
      // Only show day_type = HOLIDAY
      const onlyHolidays = (data || []).filter((d: any) => d.day_type === 'HOLIDAY');
      onlyHolidays.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setHolidays(onlyHolidays);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = ['ADMIN', 'SUPERADMIN', 'HM'].includes(role);

  const openAdd = () => {
    setEditingDate(null);
    setFormDate('');
    setFormDescription('');
    setModalVisible(true);
  };

  const openEdit = (h: any) => {
    setEditingDate(h.date);
    setFormDate(h.date);
    setFormDescription(h.description || '');
    setModalVisible(true);
  };

  const handleDelete = (dateStr: string) => {
    Alert.alert('Confirm Delete', `Remove holiday on ${dateStr}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteHoliday(dateStr);
          loadHolidays();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.detail || e.message);
        }
      }}
    ]);
  };

  const handleSubmit = async () => {
    if (!formDate || !formDescription) {
      return Alert.alert('Error', 'Date and description are required.');
    }
    setSubmitting(true);
    try {
      if (editingDate) {
        await updateHoliday(editingDate, { description: formDescription });
      } else {
        await createHoliday({ date: formDate, description: formDescription });
      }
      setModalVisible(false);
      loadHolidays();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && holidays.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Holiday Master</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && <Text style={styles.errorText}>❌ {error}</Text>}

        {holidays.length === 0 && !loading ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No upcoming holidays found.</Text>
          </View>
        ) : (
          holidays.map((h) => {
            const d = new Date(h.date);
            const monthStr = monthNames[d.getMonth()].substring(0, 3).toUpperCase();
            const dayNum = d.getDate();
            const isUpcoming = d >= new Date(new Date().setHours(0,0,0,0));
            
            return (
              <View key={h.date} style={[styles.card, !isUpcoming && { opacity: 0.6 }]}>
                <View style={[styles.dateBox, !isUpcoming && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                  <Text style={[styles.dateMonth, !isUpcoming && { color: '#64748b' }]}>{monthStr}</Text>
                  <Text style={[styles.dateNum, !isUpcoming && { color: '#64748b' }]}>{dayNum}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.holidayName}>{h.description || 'Public Holiday'}</Text>
                  <Text style={styles.holidayDay}>{d.toLocaleDateString('en-US', { weekday: 'long' })} {d.getFullYear()}</Text>
                  
                  {isAdmin && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity onPress={() => openEdit(h)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(h.date)} style={[styles.actionBtn, { marginLeft: 10 }]}>
                        <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.badgeBox}>
                  <Text style={[styles.badgeText, isUpcoming ? {color: '#0f766e'} : {}]}>{isUpcoming ? 'Upcoming' : 'Past'}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{editingDate ? 'Edit Holiday' : 'Add Holiday'}</Text>
          
          <Text style={styles.label}>Date *</Text>
          <TextInput 
            style={[styles.input, editingDate && { opacity: 0.5 }]} 
            value={formDate} 
            onChangeText={setFormDate} 
            placeholder="YYYY-MM-DD" 
            editable={!editingDate}
          />

          <Text style={styles.label}>Holiday Name *</Text>
          <TextInput 
            style={styles.input} 
            value={formDescription} 
            onChangeText={setFormDescription} 
            placeholder="e.g., Diwali, Christmas" 
          />

          <View style={styles.alertBox}>
            <Text style={styles.alertText}>ℹ️ This holiday will be a paid day off. Overtime applies if worked.</Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{editingDate ? 'Update' : 'Save'}</Text>}
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
  addBtn: { backgroundColor: '#14b8a6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  emptyText: { color: '#64748b', fontSize: 15, fontStyle: 'italic', marginTop: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  dateBox: {
    width: 60, height: 60, borderRadius: 12, backgroundColor: '#f0fdfa',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  dateMonth: { fontSize: 11, fontWeight: '800', color: '#0f766e', letterSpacing: 0.5 },
  dateNum: { fontSize: 22, fontWeight: '800', color: '#0f766e', marginTop: -2 },
  infoBox: { flex: 1 },
  holidayName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  holidayDay: { fontSize: 13, color: '#64748b' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  actionBtn: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  badgeBox: { backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff', paddingTop: 40 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 15 },
  alertBox: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#dcfce7' },
  alertText: { color: '#166534', fontSize: 13, fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#64748b', fontWeight: '700' },
  btnSave: { backgroundColor: '#14b8a6' },
  btnSaveText: { color: '#fff', fontWeight: '700' },
});
