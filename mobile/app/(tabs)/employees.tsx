import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { getEmployees, getPunchesByEmployee, getPunchesByEmployeeDate } from '@/services/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EmployeesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill-down states
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [singleDateData, setSingleDateData] = useState<any>(null);

  // Load employee list
  const loadEmployees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getEmployees();
      setEmployees(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch employees');
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Load employee history (monthly)
  const loadHistory = async (emp: any) => {
    setSelectedEmployee(emp);
    setHistoryLoading(true);
    setSingleDateData(null);
    setSelectedDate(null);
    try {
      const now = new Date();
      const data = await getPunchesByEmployee(emp.id, now.getMonth() + 1, now.getFullYear());
      setHistoryData(data);
    } catch (err: any) {
      console.error(err);
    }
    setHistoryLoading(false);
  };

  // Load single date details
  const loadSingleDate = async (date: Date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    setHistoryLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const data = await getPunchesByEmployeeDate(selectedEmployee.id, dateStr);
      setSingleDateData(data);
    } catch (err: any) {
      console.error(err);
    }
    setHistoryLoading(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      loadSingleDate(selectedDate);
    }
  };

  // -------------------------------------------------------------
  // RENDER: LIST VIEW
  // -------------------------------------------------------------
  if (!selectedEmployee) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6' }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Employees</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.tint} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: 'red' }}>{error}</Text>
            <TouchableOpacity onPress={() => loadEmployees()} style={{ marginTop: 15 }}>
              <Text style={{ color: colors.tint }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={employees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEmployees(true)} />}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.empCard, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}
                onPress={() => loadHistory(item)}
              >
                <View>
                  <Text style={[styles.empName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={{ color: colors.text, opacity: 0.5, marginTop: 4 }}>ID: {item.device_user_id}</Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color={colors.tint} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // -------------------------------------------------------------
  // RENDER: DRILL-DOWN VIEW (History)
  // -------------------------------------------------------------
  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: colorScheme === 'dark' ? '#111827' : '#f3f4f6', justifyContent: 'flex-start' }]}>
        <TouchableOpacity onPress={() => setSelectedEmployee(null)} style={{ padding: 10, marginRight: 10 }}>
          <FontAwesome name="arrow-left" size={20} color={colors.tint} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{selectedEmployee.name}'s History</Text>
      </View>

      <View style={{ padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity 
          style={[styles.datePickerBtn, { borderColor: colors.tint }]}
          onPress={() => setShowDatePicker(true)}
        >
          <FontAwesome name="calendar" size={16} color={colors.tint} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.tint, fontWeight: '500' }}>
            {selectedDate ? selectedDate.toLocaleDateString() : 'Pick a specific date...'}
          </Text>
        </TouchableOpacity>
        {selectedDate && (
          <TouchableOpacity onPress={() => { setSelectedDate(null); setSingleDateData(null); }} style={{ padding: 5 }}>
            <FontAwesome name="times-circle" size={20} color="red" />
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
        />
      )}

      {historyLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.tint} /></View>
      ) : singleDateData ? (
        // RENDER SINGLE DATE DETAILED VIEW
        <View style={styles.singleDateContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Detailed Sessions: {singleDateData.date}</Text>
          {singleDateData.sessions.length === 0 ? (
            <Text style={{ color: colors.text, opacity: 0.5, marginTop: 20, textAlign: 'center' }}>No punches on this date.</Text>
          ) : (
            singleDateData.sessions.map((s: any) => (
              <View key={s.session_number} style={[styles.detailSessionCard, { backgroundColor: colorScheme === 'dark' ? '#374151' : '#f9fafb' }]}>
                <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 10 }}>Session {s.session_number}</Text>
                <View style={styles.detailRow}><Text style={{ color: colors.text, opacity: 0.7 }}>IN:</Text><Text style={{ color: colors.text, fontWeight: '500' }}>{s.punch_in_local}</Text></View>
                <View style={styles.detailRow}><Text style={{ color: colors.text, opacity: 0.7 }}>OUT:</Text><Text style={{ color: colors.text, fontWeight: '500' }}>{s.punch_out_local || '—'}</Text></View>
                <View style={styles.detailRow}><Text style={{ color: colors.text, opacity: 0.7 }}>Duration:</Text><Text style={{ color: colors.text, fontWeight: '500' }}>{s.duration}</Text></View>
              </View>
            ))
          )}
          {singleDateData.sessions.length > 0 && (
            <View style={styles.dayTotalBox}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Day Total: {singleDateData.day_total}</Text>
            </View>
          )}
        </View>
      ) : historyData ? (
        // RENDER MONTHLY LIST VIEW
        <>
          <View style={styles.summaryBanner}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>{historyData.month}</Text>
            <Text style={{ color: 'white' }}>Present: {historyData.summary.days_present}  |  Absent: {historyData.summary.days_absent}</Text>
          </View>
          <FlatList
            data={historyData.days.filter((d: any) => d.status !== 'ABSENT')} // only show days they came in
            keyExtractor={(item) => item.date}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.historyCard, { backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff' }]}>
                <View style={styles.historyCardHeader}>
                  <Text style={[styles.historyDate, { color: colors.text }]}>{new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.total_hours} hrs</Text>
                </View>
                {item.punches.map((p: any, idx: number) => (
                  <View key={idx} style={styles.historyPunchRow}>
                    <Text style={{ color: colors.text, opacity: 0.8 }}>{p.in}  →  {p.out || '—'}</Text>
                    <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>{p.duration}</Text>
                  </View>
                ))}
              </View>
            )}
            ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: colors.text, opacity: 0.5 }}>No attendance data for this month.</Text>}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContent: { padding: 10, paddingBottom: 30 },
  empCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  empName: { fontSize: 16, fontWeight: 'bold' },
  summaryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#3b82f6',
    padding: 12,
    paddingHorizontal: 20,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    flex: 1,
  },
  historyCard: {
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    paddingBottom: 8,
  },
  historyDate: { fontWeight: 'bold', fontSize: 15 },
  historyPunchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  singleDateContainer: { padding: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  detailSessionCard: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  dayTotalBox: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  }
});
