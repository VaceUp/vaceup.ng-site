import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button, Card, EmptyState, Note, Screen, Separator } from '@/components/ui';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { light as colors, spacing, type } from '@/theme';

export default function AlertsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api.notifications({ page: 1 });
      setItems(result.results);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load your notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: number) => {
    await api.markNotificationRead(id).catch(() => undefined);
    void load();
  };

  const markAll = async () => {
    await api.markAllNotificationsRead().catch(() => undefined);
    void load();
  };

  const unread = items.filter((item) => !item.is_read).length;

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.navy950} />}
    >
      {error ? <Note tone="error">{error}</Note> : null}
      {items.length > 0 && unread > 0
        ? <Button label={`Mark ${unread} as read`} onPress={() => void markAll()} intent="neutral" icon="check-circle" />
        : null}
      {items.length === 0
        ? <EmptyState icon="bell" title="No notifications yet" body="Lesson feedback, announcements and challenge updates will land here." />
        : items.map((item, index) => (
          <Card key={item.id} style={item.is_read ? undefined : styles.unread}>
            <View style={styles.head}>
              <Feather name={item.is_read ? 'bell-off' : 'bell'} size={16} color={item.is_read ? colors.textMuted : colors.focus} />
              <Text style={[type.subheading, { flex: 1 }]} numberOfLines={2}>{item.title}</Text>
            </View>
            <Text style={[type.body, styles.body]}>{item.body}</Text>
            <View style={styles.foot}>
              <Text style={[type.caption, styles.muted]}>{new Date(item.created_at).toLocaleString()}</Text>
              {!item.is_read && (
                <Pressable accessibilityRole="button" onPress={() => void markRead(item.id)} style={styles.readButton}>
                  <Text style={[type.caption, { color: colors.focus, fontWeight: '700' }]}>Mark read</Text>
                </Pressable>
              )}
            </View>
            {index < items.length - 1 ? <Separator /> : null}
          </Card>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { borderColor: colors.focus, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  body: { color: colors.text },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.textMuted },
  readButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing(2) },
});
