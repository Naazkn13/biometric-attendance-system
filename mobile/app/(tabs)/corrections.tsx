import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getOverrides, deactivateOverride, createOverride, getEmployees, getCorrectionLog } from '../../services/api';

const TYPE_LABELS: Record<string, string> = {
  SET_PUNCH_OUT: 'Set Punch Out',
  SET_PUNCH_IN: 'Set Punch In',
  SET_BOTH: 'Set Both',
  MARK_ABSENT: 'Mark Absent',
  MARK_PRESENT: 'Mark Present',
  OVERRIDE_HOURS: 'Override Hours',
};

function needsIn(t: string) { return ['SET_PUNCH_IN', 'SET_BOTH'].includes(t); }
function needsOut(t: string) { return ['SET_PUNCH_OUT', 'SET_BOTH'].includes(t); }
function needsHours(t: string) { return ['MARK_PRESENT', 'OVERRIDE_HOURS'].includes(t); }

// ── Inline calendar ─────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({ value, onChange, onClose }: {
  value: string; onChange: (d: string) => void; onClose: () => void;
}) {
  const initial = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const selected = value || '';

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function pickDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    onClose();
  }

  function isSelected(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return selected === `${viewYear}-${m}-${d}`;
  }

  const isToday = (day: number) => {
    const now = new Date();
    return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
  };

  return (
    <View style={cal.container}>
      {/* Header nav */}
      <View style={cal.nav}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={cal.navBtn}>
          <FontAwesome name="chevron-left" size={14} color="#3b82f6" />
        </TouchableOpacity>
        <Text style={cal.monthTitle}>{FULL_MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={cal.navBtn}>
          <FontAwesome name="chevron-right" size={14} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.row}>
        {DOW.map(d => <Text key={d} style={cal.dow}>{d}</Text>)}
      </View>

      {/* Day grid */}
      <View style={cal.grid}>
        {cells.map((day, i) => day === null
          ? <View key={`e${i}`} style={cal.cell} />
          : (
            <TouchableOpacity
              key={day}
              style={[cal.cell, isSelected(day) && cal.cellSelected, isToday(day) && !isSelected(day) && cal.cellToday]}
              onPress={() => pickDay(day)}
            >
              <Text style={[cal.dayText, isSelected(day) && { color: '#fff', fontWeight: '800' }, isToday(day) && !isSelected(day) && { color: '#3b82f6', fontWeight: '700' }]}>
                {day}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <TouchableOpacity style={cal.cancelBtn} onPress={onClose}>
        <Text style={cal.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const cal = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 16, margin: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  row: { flexDirection: 'row', marginBottom: 4 },
  dow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 100 },
  cellSelected: { backgroundColor: '#3b82f6' },
  cellToday: { backgroundColor: '#eff6ff' },
  dayText: { fontSize: 13, color: '#334155' },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
});

// ── Main Screen ──────────────────────────────────────────────────────────────
function fresh() {
  return {
    selectedEmp: null as any,
    date: new Date().toISOString().split('T')[0],
    overrideType: 'SET_PUNCH_OUT',
    punchIn: '',
    punchOut: '',
    netHours: '',
    reason: '',
  };
}

export default function CorrectionsScreen() {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [empModalVisible, setEmpModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [calVisible, setCalVisible] = useState(false);

  const [form, setForm] = useState(fresh());
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function setField(key: keyof ReturnType<typeof fresh>, val: any) {
    setForm(f => ({ ...f, [key]: val }));
  }

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovData, empData] = await Promise.all([getOverrides(), getEmployees()]);
      setOverrides(ovData || []);
      setEmployees((empData || []).filter((e: any) => e.is_active));
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadLog = async () => {
    try {
      const data = await getCorrectionLog();
      setLog(data || []);
      setLogModalVisible(true);
    } catch {
      Alert.alert('Error', 'Failed to load audit log');
    }
  };

  const handleDeactivate = async (id: string) => {
    Alert.alert('Confirm', 'Revoke this correction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try { await deactivateOverride(id); loadData(); }
        catch (e: any) { Alert.alert('Error', e.response?.data?.detail || e.message); }
      }}
    ]);
  };

  const buildPayload = () => {
    const { selectedEmp, date, overrideType, punchIn, punchOut, netHours, reason } = form;
    if (!selectedEmp) { Alert.alert('Error', 'Please select an employee'); return null; }
    if (!date) { Alert.alert('Error', 'Date is required'); return null; }
    if (!reason.trim()) { Alert.alert('Error', 'Reason is required'); return null; }
    if (needsIn(overrideType) && !punchIn) { Alert.alert('Error', 'Punch In time required (HH:MM)'); return null; }
    if (needsOut(overrideType) && !punchOut) { Alert.alert('Error', 'Punch Out time required (HH:MM)'); return null; }
    if (needsHours(overrideType) && !netHours) { Alert.alert('Error', 'Net Hours required'); return null; }

    const payload: any = {
      employee_id: selectedEmp.id,
      session_date: date,
      override_type: overrideType,
      reason: reason.trim(),
    };
    if (needsIn(overrideType) && punchIn) payload.override_punch_in = new Date(`${date}T${punchIn}`).toISOString();
    if (needsOut(overrideType) && punchOut) payload.override_punch_out = new Date(`${date}T${punchOut}`).toISOString();
    if (needsHours(overrideType) && netHours) payload.override_net_hours = parseFloat(netHours);
    return payload;
  };

  const handleSubmit = async (andAnother = false) => {
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      await createOverride(payload);
      if (andAnother) {
        // Reset form but keep modal open for next correction
        setForm(f => ({ ...fresh(), selectedEmp: f.selectedEmp })); // keep employee
        Alert.alert('Done', 'Correction saved. Add another.');
      } else {
        setModalVisible(false);
        setForm(fresh());
        Alert.alert('Success', 'Correction applied.');
      }
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && overrides.length === 0) {
    return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  const active = overrides.filter(o => o.is_active);
  const inactive = overrides.filter(o => !o.is_active);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <Text style={s.title}>Corrections</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={s.logBtn} onPress={loadLog}>
              <Text style={s.logBtnText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={() => { setForm(fresh()); setModalVisible(true); }}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && <Text style={s.errorText}>❌ {error}</Text>}

        <Text style={s.sectionTitle}>Active Corrections ({active.length})</Text>
        {active.length === 0
          ? <Text style={s.emptyText}>No active corrections.</Text>
          : active.map(o => (
            <View key={o.id} style={[s.card, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
              <View style={s.cardHeader}>
                <Text style={s.empName}>{o.employees?.name || 'Unknown'}</Text>
                <TouchableOpacity onPress={() => handleDeactivate(o.id)}>
                  <Text style={s.revokeText}>Revoke</Text>
                </TouchableOpacity>
              </View>
              <View style={s.detailsBox}>
                <Text style={s.dateLabel}>Date: {o.session_date}</Text>
                <Text style={s.typeLabel}>{TYPE_LABELS[o.override_type] || o.override_type}</Text>
                <Text style={s.valText}>
                  {o.override_punch_in && `IN: ${new Date(o.override_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} `}
                  {o.override_punch_out && `OUT: ${new Date(o.override_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} `}
                  {o.override_net_hours && `Hrs: ${o.override_net_hours}`}
                </Text>
                <Text style={s.reasonText}>"{o.reason}"</Text>
              </View>
            </View>
          ))
        }

        <Text style={[s.sectionTitle, { marginTop: 20 }]}>Past Corrections ({inactive.length})</Text>
        {inactive.length === 0
          ? <Text style={s.emptyText}>No past corrections.</Text>
          : inactive.map(o => (
            <View key={o.id} style={[s.card, { opacity: 0.7 }]}>
              <View style={s.cardHeader}>
                <Text style={s.empName}>{o.employees?.name || 'Unknown'}</Text>
                <Text style={s.inactiveText}>INACTIVE</Text>
              </View>
              <View style={s.detailsBox}>
                <Text style={s.dateLabel}>Date: {o.session_date}</Text>
                <Text style={s.typeLabel}>{TYPE_LABELS[o.override_type] || o.override_type}</Text>
                <Text style={s.reasonText}>"{o.reason}"</Text>
              </View>
            </View>
          ))
        }
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Add Correction Modal ─────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            ref={scrollRef}
            style={s.modalContainer}
            contentContainerStyle={{ paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>New Correction</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={s.modalClose}>
                <FontAwesome name="times" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Employee */}
            <Text style={s.label}>Employee *</Text>
            <TouchableOpacity style={s.input} onPress={() => setEmpModalVisible(true)}>
              <Text style={{ color: form.selectedEmp ? '#0f172a' : '#94a3b8', fontSize: 15 }}>
                {form.selectedEmp ? form.selectedEmp.name : 'Select employee…'}
              </Text>
            </TouchableOpacity>

            {/* Date — calendar picker */}
            <Text style={s.label}>Date *</Text>
            <TouchableOpacity style={[s.input, s.inputRow]} onPress={() => setCalVisible(true)}>
              <Text style={{ color: form.date ? '#0f172a' : '#94a3b8', fontSize: 15, flex: 1 }}>
                {form.date || 'Select date…'}
              </Text>
              <FontAwesome name="calendar" size={16} color="#3b82f6" />
            </TouchableOpacity>

            {/* Type grid */}
            <Text style={s.label}>Correction Type *</Text>
            <View style={s.typeGrid}>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.typeBtn, form.overrideType === key && s.typeBtnActive]}
                  onPress={() => setField('overrideType', key)}
                >
                  <Text style={[s.typeBtnText, form.overrideType === key && { color: '#fff' }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {needsIn(form.overrideType) && (
              <>
                <Text style={s.label}>Punch In (HH:MM) *</Text>
                <TextInput
                  style={s.input}
                  value={form.punchIn}
                  onChangeText={v => setField('punchIn', v)}
                  placeholder="09:30"
                  keyboardType="numbers-and-punctuation"
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                />
              </>
            )}

            {needsOut(form.overrideType) && (
              <>
                <Text style={s.label}>Punch Out (HH:MM) *</Text>
                <TextInput
                  style={s.input}
                  value={form.punchOut}
                  onChangeText={v => setField('punchOut', v)}
                  placeholder="18:30"
                  keyboardType="numbers-and-punctuation"
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                />
              </>
            )}

            {needsHours(form.overrideType) && (
              <>
                <Text style={s.label}>Net Hours *</Text>
                <TextInput
                  style={s.input}
                  value={form.netHours}
                  onChangeText={v => setField('netHours', v)}
                  placeholder="8.5"
                  keyboardType="decimal-pad"
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                />
              </>
            )}

            <Text style={s.label}>Reason *</Text>
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              value={form.reason}
              onChangeText={v => setField('reason', v)}
              placeholder="Enter reason…"
              multiline
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            />

            {/* 3-button row: Cancel | + Add Another | Submit */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <TouchableOpacity
                style={[s.btn, s.btnCancel]}
                onPress={() => { setModalVisible(false); setForm(fresh()); }}
              >
                <Text style={s.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnAnother]}
                onPress={() => handleSubmit(true)}
                disabled={submitting}
              >
                <Text style={s.btnAnotherText}>+ Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, s.btnSubmit]}
                onPress={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnSubmitText}>Submit</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Calendar Modal ────────────────────────────────────────────── */}
      <Modal visible={calVisible} animationType="fade" transparent>
        <View style={s.overlay}>
          <CalendarPicker
            value={form.date}
            onChange={d => setField('date', d)}
            onClose={() => setCalVisible(false)}
          />
        </View>
      </Modal>

      {/* ── Employee Picker ───────────────────────────────────────────── */}
      <Modal visible={empModalVisible} animationType="fade" transparent>
        <View style={s.overlay}>
          <View style={s.pickerModal}>
            <Text style={s.modalTitle}>Select Employee</Text>
            <ScrollView>
              {employees.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={s.pickerItem}
                  onPress={() => { setField('selectedEmp', e); setEmpModalVisible(false); }}
                >
                  <Text style={s.pickerItemText}>{e.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.btn, s.btnCancel, { marginTop: 10 }]} onPress={() => setEmpModalVisible(false)}>
              <Text style={s.btnCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Audit Log ─────────────────────────────────────────────────── */}
      <Modal visible={logModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalContainer}>
          <View style={s.modalHeaderRow}>
            <Text style={s.modalTitle}>Audit Log</Text>
            <TouchableOpacity onPress={() => setLogModalVisible(false)} style={s.modalClose}>
              <FontAwesome name="times" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {log.length === 0
              ? <Text style={s.emptyText}>No entries yet.</Text>
              : log.map(entry => (
                <View key={entry.id} style={s.logCard}>
                  <View style={s.logHeader}>
                    <Text style={[s.logAction, { color: entry.action === 'CREATED' ? '#16a34a' : entry.action === 'DEACTIVATED' ? '#dc2626' : '#64748b' }]}>
                      {entry.action}
                    </Text>
                    <Text style={s.logTime}>{new Date(entry.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
                  </View>
                  <Text style={s.logEmp}>{entry.session_overrides?.employees?.name || 'Unknown'}</Text>
                  <Text style={s.logDetail}>Date: {entry.session_overrides?.session_date}</Text>
                  <Text style={s.logDetail}>By: {entry.performed_by_name}</Text>
                </View>
              ))
            }
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  addBtn: { backgroundColor: '#f97316', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  logBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  logBtnText: { color: '#475569', fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  errorText: { color: '#ef4444', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  empName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  revokeText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  inactiveText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  detailsBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
  dateLabel: { fontSize: 13, color: '#334155', fontWeight: '800', marginBottom: 2 },
  typeLabel: { fontSize: 12, color: '#0ea5e9', fontWeight: '700', marginBottom: 4 },
  valText: { fontSize: 12, color: '#475569', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  // modal
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff', paddingTop: 48 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  modalClose: { padding: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 8, minWidth: '45%', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#3b82f6' },
  typeBtnText: { fontWeight: '600', color: '#475569', fontSize: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#64748b', fontWeight: '600' },
  btnAnother: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  btnAnotherText: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  btnSubmit: { backgroundColor: '#f97316' },
  btnSubmitText: { color: '#fff', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  pickerModal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%', margin: 20 },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  logCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logAction: { fontSize: 12, fontWeight: '800' },
  logTime: { fontSize: 11, color: '#94a3b8' },
  logEmp: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  logDetail: { fontSize: 12, color: '#475569' },
});
