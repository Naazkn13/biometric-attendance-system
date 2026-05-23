import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getMyAttendance } from '../../services/api';

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AttendanceScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAttendance();
  }, [year, month]);

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyAttendance(year, month);
      setAttendance(data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
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
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
          <Text style={styles.arrowText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthNames[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
          <Text style={styles.arrowText}>▶</Text>
        </TouchableOpacity>
      </View>

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
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 2 }]}>Date</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>In</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>Out</Text>
            <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Hrs</Text>
            <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>Status</Text>
          </View>
          {attendance.map((session: any) => {
            const dateObj = new Date(session.session_date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = dateObj.getDate();
            const badge = getStatusStyle(session.status);
            
            return (
              <View key={session.id} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.dateText}>{dayNum} <Text style={styles.dayText}>{dayName}</Text></Text>
                </View>
                <Text style={[styles.timeText, { flex: 1.5 }]}>{formatTime(session.punch_in_time)}</Text>
                <Text style={[styles.timeText, { flex: 1.5 }]}>{formatTime(session.punch_out_time)}</Text>
                <Text style={[styles.hoursText, { flex: 1, textAlign: 'right', color: session.net_hours > 0 ? '#16a34a' : '#94a3b8' }]}>
                  {session.net_hours || 0}h
                </Text>
                <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>
                      {session.status === 'COMPLETE' ? '✓' : session.status === 'MISSING_OUT' ? 'Miss' : 'Auto'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
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
});
