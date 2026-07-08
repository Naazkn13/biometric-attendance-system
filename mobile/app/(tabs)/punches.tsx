import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { getPunchesByDate } from '@/services/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// For simple date formatting
const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

export default function PunchesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPunches = useCallback(async (dateToFetch: Date) => {
    try {
      const dateStr = formatDate(dateToFetch);
      const response = await getPunchesByDate(dateStr);
      setData(response);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch punches');
      setData(null);
    }
  }, []);

  const loadData = async (dateToFetch = currentDate, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    await fetchPunches(dateToFetch);

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    loadData(currentDate);
  }, [currentDate, fetchPunches]);

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE': return '#4ade80'; // green
      case 'OPEN': return '#facc15';     // yellow
      case 'AUTO_CHECKOUT': return '#f87171'; // red warning
      case 'ABSENT': return '#9ca3af';   // gray
      default: return colors.text;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETE': return 'check-circle';
      case 'OPEN': return 'clock-o';
      case 'AUTO_CHECKOUT': return 'exclamation-triangle';
      case 'ABSENT': return 'times-circle';
      default: return 'circle-o';
    }
  };

  const renderEmployeeCard = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.empName, { color: colors.text }]}>{item.employee_name}</Text>
        <View style={styles.statusBadge}>
          <FontAwesome name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} style={{ marginRight: 4 }} />
          <Text style={{ color: getStatusColor(item.status), fontWeight: 'bold', fontSize: 12 }}>
            {item.status}
          </Text>
        </View>
      </View>

      {item.status === 'ABSENT' ? (
        <Text style={[styles.absentText, { color: colors.text }]}>No punches for this date.</Text>
      ) : (
        <View style={styles.sessionsContainer}>
          {item.punches.map((punch: any, idx: number) => (
            <View key={idx} style={styles.sessionRow}>
              <View style={styles.punchTime}>
                <Text style={{ color: colors.text, fontSize: 13, opacity: 0.7 }}>IN</Text>
                <Text style={{ color: colors.text, fontWeight: '500' }}>{punch.in}</Text>
              </View>
              <FontAwesome name="long-arrow-right" size={16} color={colors.text} style={{ opacity: 0.3 }} />
              <View style={styles.punchTime}>
                <Text style={{ color: colors.text, fontSize: 13, opacity: 0.7 }}>OUT</Text>
                <Text style={{ color: colors.text, fontWeight: '500' }}>{punch.out || '—'}</Text>
              </View>
              <View style={styles.durationCol}>
                <Text style={{ color: colors.text, fontSize: 12, opacity: 0.7 }}>{punch.duration}</Text>
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>Day Total:</Text>
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.total_hours} hrs</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Date Navigation Header */}
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6' }]}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.navBtn}>
          <FontAwesome name="chevron-left" size={20} color={colors.tint} />
        </TouchableOpacity>
        
        <View style={styles.dateDisplay}>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          {formatDate(currentDate) === formatDate(new Date()) && (
            <Text style={{ color: colors.tint, fontSize: 12, fontWeight: 'bold' }}>TODAY</Text>
          )}
        </View>

        <TouchableOpacity onPress={() => changeDate(1)} style={styles.navBtn} disabled={formatDate(currentDate) === formatDate(new Date())}>
          <FontAwesome 
            name="chevron-right" 
            size={20} 
            color={formatDate(currentDate) === formatDate(new Date()) ? 'gray' : colors.tint} 
          />
        </TouchableOpacity>
      </View>

      {/* Summary Banner */}
      {data?.summary && (
        <View style={styles.summaryBanner}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Present: {data.summary.present}
          </Text>
          <Text style={{ color: 'white', opacity: 0.5 }}>|</Text>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Absent: {data.summary.absent}
          </Text>
        </View>
      )}

      {/* Main List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={() => loadData(currentDate)} style={{ marginTop: 15 }}>
            <Text style={{ color: colors.tint }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data?.employees || []}
          keyExtractor={(item) => item.employee_id}
          renderItem={renderEmployeeCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(currentDate, true)} />
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 50, color: colors.text, opacity: 0.5 }}>
              No employees found.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)'
  },
  navBtn: { padding: 10 },
  dateDisplay: { alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: 'bold' },
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    backgroundColor: '#3b82f6',
    padding: 10,
  },
  listContent: { padding: 10, paddingBottom: 30 },
  card: {
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    paddingBottom: 8,
  },
  empName: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  absentText: { fontStyle: 'italic', opacity: 0.5, marginTop: 5 },
  sessionsContainer: { marginTop: 5 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(150,150,150,0.05)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  punchTime: { alignItems: 'center', width: 80 },
  durationCol: { alignItems: 'flex-end', width: 60 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  }
});
