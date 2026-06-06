import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { getPayrollRecords, calculateAllPayroll, calculateEmployeePayroll, finalizePayroll } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function periodLabel(periodStart: string) {
  const d = new Date(periodStart);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PayrollScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [year, month]);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPayrollRecords(year, month);
      setRecords(data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateAll = () => {
    Alert.alert(
      'Calculate Payroll',
      `Calculate payroll for all employees for ${MONTHS[month - 1]} ${year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Calculate', onPress: async () => {
            setActioning(true);
            try {
              const dateFrom = `${year}-${pad(month)}-01`;
              const lastDay = new Date(year, month, 0).getDate();
              const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;
              await calculateAllPayroll(dateFrom, dateTo);
              await loadRecords();
              Alert.alert('Done', 'Payroll calculated successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'Calculation failed');
            } finally {
              setActioning(false);
            }
          }
        }
      ]
    );
  };

  const handleCalculateOne = (rec: any) => {
    const name = rec.employee_name || 'this employee';
    Alert.alert(
      'Recalculate Payroll',
      `Recalculate payroll for ${name} for ${MONTHS[month - 1]} ${year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Calculate', onPress: async () => {
            setActioning(true);
            try {
              const dateFrom = `${year}-${pad(month)}-01`;
              const lastDay = new Date(year, month, 0).getDate();
              const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;
              await calculateEmployeePayroll(rec.employee_id, dateFrom, dateTo);
              await loadRecords();
              Alert.alert('Done', `Payroll recalculated for ${name}.`);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'Calculation failed');
            } finally {
              setActioning(false);
            }
          }
        }
      ]
    );
  };

  const handleFinalizeAll = () => {
    const draftIds = records.filter(r => r.status === 'DRAFT').map(r => r.id);
    if (draftIds.length === 0) {
      Alert.alert('Nothing to finalize', 'All records are already finalized.');
      return;
    }
    Alert.alert(
      'Finalize Payroll',
      `Finalize ${draftIds.length} draft record(s) for ${MONTHS[month - 1]} ${year}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize', style: 'destructive', onPress: async () => {
            setActioning(true);
            try {
              await finalizePayroll(draftIds);
              await loadRecords();
              Alert.alert('Done', 'Records finalized.');
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'Finalize failed');
            } finally {
              setActioning(false);
            }
          }
        }
      ]
    );
  };

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const totalNet = records.reduce((s, r) => s + (r.net_pay || 0), 0);
  const draftCount = records.filter(r => r.status === 'DRAFT').length;
  const finalCount = records.filter(r => r.status === 'FINAL').length;

  return (
    <View style={styles.container}>
      {/* Month selector */}
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthArrow}>
          <FontAwesome name="chevron-left" size={14} color="#3b82f6" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthArrow}>
          <FontAwesome name="chevron-right" size={14} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadRecords}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{records.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={[styles.summaryCard, { borderColor: '#fde68a' }]}>
              <Text style={[styles.summaryNum, { color: '#b45309' }]}>{draftCount}</Text>
              <Text style={styles.summaryLabel}>Draft</Text>
            </View>
            <View style={[styles.summaryCard, { borderColor: '#bbf7d0' }]}>
              <Text style={[styles.summaryNum, { color: '#166534' }]}>{finalCount}</Text>
              <Text style={styles.summaryLabel}>Final</Text>
            </View>
            <View style={[styles.summaryCard, { borderColor: '#bfdbfe' }]}>
              <Text style={[styles.summaryNum, { color: '#1d4ed8', fontSize: 14 }]}>₹{(totalNet / 1000).toFixed(0)}k</Text>
              <Text style={styles.summaryLabel}>Net Pay</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
              onPress={handleCalculateAll}
              disabled={actioning}
            >
              <FontAwesome name="calculator" size={14} color="#3b82f6" />
              <Text style={[styles.actionBtnText, { color: '#3b82f6' }]}>Calculate All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: draftCount > 0 ? '#fefce8' : '#f1f5f9' }]}
              onPress={handleFinalizeAll}
              disabled={actioning || draftCount === 0}
            >
              <FontAwesome name="check-circle" size={14} color={draftCount > 0 ? '#b45309' : '#94a3b8'} />
              <Text style={[styles.actionBtnText, { color: draftCount > 0 ? '#b45309' : '#94a3b8' }]}>
                Finalize ({draftCount})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Records */}
          {records.map((rec) => (
            <View key={rec.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(rec.employee_name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{rec.employee_name || '—'}</Text>
                  <Text style={styles.period}>{periodLabel(rec.period_start)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: rec.status === 'FINAL' ? '#dcfce7' : '#fef9c3' }]}>
                  <Text style={[styles.badgeText, { color: rec.status === 'FINAL' ? '#166534' : '#b45309' }]}>
                    {rec.status}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Days Present</Text>
                  <Text style={styles.infoValue}>{rec.days_present ?? '--'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Basic</Text>
                  <Text style={styles.infoValue}>₹{(rec.basic_salary || 0).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Net Pay</Text>
                  <Text style={[styles.infoValue, { color: '#166534', fontWeight: '800' }]}>
                    ₹{(rec.net_pay || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.recalcBtn}
                onPress={() => handleCalculateOne(rec)}
                disabled={actioning}
              >
                <FontAwesome name="refresh" size={11} color="#6366f1" />
                <Text style={styles.recalcBtnText}>Recalculate</Text>
              </TouchableOpacity>
            </View>
          ))}

          {records.length === 0 && (
            <View style={styles.empty}>
              <FontAwesome name="money" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>No payroll records for this month</Text>
              <Text style={styles.emptyHint}>Tap "Calculate All" to generate records.</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  monthBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  monthArrow: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: '800', color: '#0f172a', minWidth: 110, textAlign: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 100 },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#3b82f6', borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0',
  },
  summaryNum: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  summaryLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#3b82f6' },
  empName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  period: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  infoGrid: { flexDirection: 'row', gap: 8 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 13, color: '#334155', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
  emptyHint: { fontSize: 12, color: '#cbd5e1' },
  recalcBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, alignSelf: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#eef2ff', borderRadius: 8,
  },
  recalcBtnText: { fontSize: 11, color: '#6366f1', fontWeight: '700' },
});
