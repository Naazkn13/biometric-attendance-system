import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { getMyAttendance, getAttendanceSessions, triggerSessionBuilder, triggerAutoCheckout } from '../../services/api';
import * as SecureStore from 'expo-secure-store';

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AttendanceScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  
  // Admin Filters
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  
  const formatDateInput = (text: string, setter: (val: string) => void) => {
    let val = text.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    if (val.length > 4) val = val.substring(0, 4) + '-' + val.substring(4);
    if (val.length > 7) val = val.substring(0, 7) + '-' + val.substring(7);
    setter(val);
  };
  
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(r => {
      setRole(r || 'EMPLOYEE');
      setRoleLoaded(true);
    });
  }, []);

  const isAdmin = ['ADMIN', 'SUPERADMIN', 'HM'].includes(role);

  useEffect(() => {
    if (roleLoaded) {
      loadAttendance();
    }
  }, [year, month, roleLoaded, dateFrom, dateTo, statusFilter]);

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const data = await getAttendanceSessions({ date_from: dateFrom, date_to: dateTo, status: statusFilter || undefined });
        setAttendance(data || []);
      } else {
        const data = await getMyAttendance(year, month);
        setAttendance(data || []);
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBuilder = async () => {
    try {
      await triggerSessionBuilder();
      Alert.alert('Success', 'Session Builder triggered.');
      loadAttendance();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    }
  };

  const handleTriggerCheckout = async () => {
    try {
      await triggerAutoCheckout();
      Alert.alert('Success', 'Auto Checkout triggered.');
      loadAttendance();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETE': return { bg: '#dcfce7', text: '#166534' };
      case 'MISSING_OUT': return { bg: '#fee2e2', text: '#991b1b' };
      case 'AUTO_CHECKOUT': return { bg: '#fef3c7', text: '#92400e' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <View style={styles.container}>
      {isAdmin ? (
        <View style={styles.adminFilters}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleTriggerBuilder}>
              <Text style={styles.actionBtnText}>▶ Run Builder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleTriggerCheckout}>
              <Text style={styles.actionBtnText}>⏰ Auto Checkout</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>From Date</Text>
              <TextInput 
                style={styles.filterInput} 
                value={dateFrom} 
                onChangeText={(text) => formatDateInput(text, setDateFrom)} 
                placeholder="YYYY-MM-DD" 
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>To Date</Text>
              <TextInput 
                style={styles.filterInput} 
                value={dateTo} 
                onChangeText={(text) => formatDateInput(text, setDateTo)} 
                placeholder="YYYY-MM-DD" 
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <TouchableOpacity style={styles.filterSubmitBtn} onPress={loadAttendance}>
              <Text style={styles.filterSubmitText}>Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthNames[month - 1]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
            <Text style={styles.arrowText}>▶</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary */}
      {!loading && !error && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#16a34a' }]}>
            <Text style={styles.summaryNumber}>{attendance.filter(s => s.status === 'COMPLETE').length}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.summaryNumber}>{attendance.filter(s => s.status === 'AUTO_CHECKOUT').length}</Text>
            <Text style={styles.summaryLabel}>Auto Out</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={styles.summaryNumber}>{attendance.filter(s => s.status === 'MISSING_OUT').length}</Text>
            <Text style={styles.summaryLabel}>Missing</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : attendance.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
          <Text style={styles.emptyText}>No records for {monthNames[month - 1]} {year}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} style={styles.listContainer} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
            <View style={{ minWidth: isAdmin ? 600 : 500, paddingRight: 16 }}>
              {/* Header */}
              <View style={styles.tableHeader}>
                {isAdmin && <Text style={[styles.headerCell, { flex: 2 }]}>Employee</Text>}
                <Text style={[styles.headerCell, { flex: 1.5 }]}>Date</Text>
                <Text style={[styles.headerCell, { flex: 1.5 }]}>In</Text>
                <Text style={[styles.headerCell, { flex: 1.5 }]}>Out</Text>
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Hrs</Text>
                {!isAdmin && <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>Day Pay</Text>}
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Stat</Text>
              </View>
              {attendance.map((session: any) => {
                const dateObj = new Date(session.session_date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dateObj.getDate();
                const badge = getStatusStyle(session.status);
                
                const basicSalary = session.employees?.basic_salary || 0;
                const dayPay = session.net_hours > 0 ? (basicSalary / 30).toFixed(2) : '0.00';
                
                return (
                  <View key={session.id} style={styles.tableRow}>
                    {isAdmin && (
                      <Text style={[styles.dateText, { flex: 2, color: '#3b82f6', fontSize: 12 }]} numberOfLines={1}>
                        {session.employee_name || 'Unknown'}
                      </Text>
                    )}
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.dateText}>{dayNum} <Text style={styles.dayText}>{dayName}</Text></Text>
                    </View>
                    <Text style={[styles.timeText, { flex: 1.5 }]}>{formatTime(session.punch_in_time)}</Text>
                    <Text style={[styles.timeText, { flex: 1.5 }]}>{formatTime(session.punch_out_time)}</Text>
                    <Text style={[styles.hoursText, { flex: 1, textAlign: 'right', color: session.net_hours > 0 ? '#16a34a' : '#94a3b8' }]}>
                      {session.net_hours || 0}h
                    </Text>
                    {!isAdmin && (
                      <Text style={[styles.timeText, { flex: 1.5, textAlign: 'right', color: session.net_hours > 0 ? '#16a34a' : '#94a3b8', fontWeight: '700' }]}>
                        ₹{dayPay}
                      </Text>
                    )}
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={[styles.statusText, { color: badge.text }]}>
                        {session.status === 'COMPLETE' ? '✓' : session.status === 'MISSING_OUT' ? 'X' : '!'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 4,
    marginTop: 4,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 3,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  hoursText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminFilters: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 13,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  filterInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
  },
  filterSubmitBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSubmitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
