import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api';

const TYPE_ICON: Record<string, { name: string; color: string; bg: string }> = {
  LEAVE_REQUEST:       { name: 'calendar-times-o', color: '#f59e0b', bg: '#fef3c7' },
  LEAVE_APPROVED:      { name: 'check-circle',     color: '#10b981', bg: '#d1fae5' },
  LEAVE_REJECTED:      { name: 'times-circle',     color: '#ef4444', bg: '#fee2e2' },
  LEAVE_TEAM_BROADCAST:{ name: 'bullhorn',         color: '#6366f1', bg: '#eef2ff' },
  DEFAULT:             { name: 'bell',             color: '#64748b', bg: '#f1f5f9' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data || []);
    } catch {
      // silent — already shown via TTS
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* silent */ } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderItem = ({ item }: { item: any }) => {
    const icon = TYPE_ICON[item.notification_type] || TYPE_ICON.DEFAULT;
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        onPress={() => !item.is_read && handleMarkRead(item.id)}
        activeOpacity={0.85}
      >
        <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
          <FontAwesome name={icon.name as any} size={18} color={icon.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, !item.is_read && styles.cardTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.dot} />}
          </View>
          <Text style={styles.cardMsg} numberOfLines={2}>{item.spoken_message}</Text>
          <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Notifications{unreadCount > 0 ? ` (${unreadCount} new)` : ''}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markingAll} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>{markingAll ? 'Marking…' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <FontAwesome name="bell-slash-o" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptyHint}>Leave requests, approvals, and announcements will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#3b82f6" />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#eff6ff', borderRadius: 8 },
  markAllText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardUnread: {
    borderLeftWidth: 3, borderLeftColor: '#3b82f6',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#475569' },
  cardTitleUnread: { color: '#0f172a', fontWeight: '700' },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#3b82f6', flexShrink: 0,
  },
  cardMsg: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 4 },
  cardTime: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
  emptyHint: { fontSize: 12, color: '#cbd5e1', textAlign: 'center' },
});
