import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getMyLeaves, getPendingLeaves, applyLeave, approveLeave, rejectLeave } from '../../services/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function LeavesScreen() {
  const [role, setRole] = useState<string>('EMPLOYEE');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Employee Form State
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [reason, setReason] = useState('');

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(r => {
      setRole(r || 'EMPLOYEE');
      loadLeaves(r || 'EMPLOYEE');
    });
  }, []);

  const loadLeaves = async (currentRole: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = ['ADMIN', 'SUPERADMIN', 'HM'].includes(currentRole)
        ? await getPendingLeaves()
        : await getMyLeaves();
      setLeaves(data || []);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!leaveDate || !reason) {
      Alert.alert('Error', 'Date and reason are required');
      return;
    }
    setLoading(true);
    try {
      await applyLeave({ 
        leave_date: leaveDate, 
        leave_end_date: leaveEndDate || leaveDate, 
        leave_type: leaveType, 
        reason 
      });
      setShowApplyForm(false);
      setLeaveDate('');
      setLeaveEndDate('');
      setReason('');
      Alert.alert('Success', 'Leave applied successfully');
      loadLeaves(role);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to apply leave');
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveLeave(id);
      Alert.alert('Approved', 'Leave request approved');
      loadLeaves(role);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectLeave(id, 'Rejected by Admin');
      Alert.alert('Rejected', 'Leave request rejected');
      loadLeaves(role);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to reject');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return '#16a34a';
      case 'REJECTED': return '#dc2626';
      default: return '#f59e0b';
    }
  };

  if (loading && leaves.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {role === 'EMPLOYEE' && (
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.applyBtn} 
            onPress={() => setShowApplyForm(!showApplyForm)}
          >
            <Text style={styles.applyBtnText}>
              {showApplyForm ? 'Cancel Application' : '+ Apply for Leave'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showApplyForm && role === 'EMPLOYEE' && (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Start Date (YYYY-MM-DD)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 2026-06-01" 
            value={leaveDate}
            onChangeText={setLeaveDate}
          />
          <Text style={styles.formLabel}>End Date (Optional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 2026-06-02" 
            value={leaveEndDate}
            onChangeText={setLeaveEndDate}
          />
          <Text style={styles.formLabel}>Reason</Text>
          <TextInput 
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
            placeholder="Reason for leave" 
            multiline
            value={reason}
            onChangeText={setReason}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleApply}>
            <Text style={styles.submitBtnText}>Submit Leave Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : leaves.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🏖️</Text>
          <Text style={styles.emptyText}>
            {['ADMIN', 'SUPERADMIN', 'HM'].includes(role) ? 'No pending leave requests' : 'No leave history'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {leaves.map((leave: any) => (
            <View key={leave.id} style={styles.leaveCard}>
              <View style={styles.leaveHeader}>
                <View>
                  {['ADMIN', 'SUPERADMIN', 'HM'].includes(role) && leave.employees && (
                    <Text style={styles.empName}>{leave.employees.name}</Text>
                  )}
                  <Text style={styles.dateText}>
                    {leave.leave_date} {leave.leave_end_date && leave.leave_end_date !== leave.leave_date ? `to ${leave.leave_end_date}` : ''}
                  </Text>
                  <Text style={styles.typeText}>{leave.leave_type}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(leave.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(leave.status) }]}>{leave.status}</Text>
                </View>
              </View>
              
              <Text style={styles.reasonText}>{leave.reason}</Text>

              {['ADMIN', 'SUPERADMIN', 'HM'].includes(role) && leave.status === 'PENDING' && (
                <View style={styles.adminActions}>
                  <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(leave.id)}>
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(leave.id)}>
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  applyBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  formCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: '#f8fafc' },
  submitBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#64748b', fontSize: 15, fontWeight: '500' },
  listContainer: { flex: 1, padding: 16 },
  leaveCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  empName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  dateText: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  typeText: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '500' },
  reasonText: { fontSize: 14, color: '#475569', marginTop: 12, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  adminActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontWeight: '700' },
});
