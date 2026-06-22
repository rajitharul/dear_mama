import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addMood,
  deleteLog,
  listMoods,
  signedFileUrl,
  uploadCareFile,
  type CareLog,
  type MoodData,
  type MoodRating,
  type PendingFile,
  type TestFileRef,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, DateField, Field, Pill } from '@/ui';

// The single mood scale: one pick per check-in, each with an emoji.
const MOOD_LEVELS: { rating: MoodRating; label: string; emoji: string }[] = [
  { rating: 1, label: 'Very low', emoji: '😢' },
  { rating: 2, label: 'Low', emoji: '😟' },
  { rating: 3, label: 'Okay', emoji: '😐' },
  { rating: 4, label: 'Good', emoji: '🙂' },
  { rating: 5, label: 'Great', emoji: '😄' },
];
const moodMeta = (r: MoodRating) => MOOD_LEVELS.find((m) => m.rating === r)!;

/** Mood logger: a history list of check-ins + a form to add one with an emoji mood pick. */
export function MoodLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [logs, setLogs] = useState<CareLog<MoodData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listMoods();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<MoodData>('mood');
      setLogs(cached);
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load only sets state after awaited work, so the cascading-render rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function confirmDelete(log: CareLog<MoodData>) {
    Alert.alert('Delete check-in?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, 'mood');
          } catch (e) {
            setLogs(prev); // revert
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (mode === 'add') {
    return (
      <AddMoodForm
        userId={userId}
        onCancel={() => setMode('list')}
        onSaved={(log) => {
          setLogs((l) => [log, ...l]);
          setMode('list');
        }}
      />
    );
  }

  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          paddingHorizontal: t.spacing.xl,
          paddingTop: t.spacing.sm,
        }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onBack}>
          <Ionicons name="chevron-back" size={26} color={t.colors.text} />
        </Pressable>
        <AppText variant="subtitle">Mood check-in</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Log how you feel" icon="add" onPress={() => setMode('add')} />

        {stale ? (
          <Pill label="Showing saved entries — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="happy-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No check-ins yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Log how you feel” to gently note your mood — a small moment for yourself, week to week.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => {
            const mood = moodMeta(log.data.rating);
            return (
              <Animated.View key={log.id} entering={entering(i * 50)}>
                <Card style={{ gap: t.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: t.radius.md,
                        backgroundColor: t.colors.accentSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text style={{ fontSize: 24 }}>{mood.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="subtitle">{mood.label}</AppText>
                      <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}</AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete check-in"
                      hitSlop={10}
                      onPress={() => confirmDelete(log)}>
                      <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
                    </Pressable>
                  </View>
                  {log.data.note ? (
                    <View style={{ marginLeft: 44 + t.spacing.md }}>
                      <AppText variant="bodyMuted">{log.data.note}</AppText>
                    </View>
                  ) : null}
                  {log.data.files?.length ? (
                    <View
                      style={{
                        marginLeft: 44 + t.spacing.md,
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: t.spacing.sm,
                      }}>
                      {log.data.files.map((f) => (
                        <PhotoThumb key={f.path} file={f} size={64} />
                      ))}
                    </View>
                  ) : null}
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** The single emoji mood scale: 5 faces, single-choice. */
function MoodScale({ value, onChange }: { value: MoodRating; onChange: (r: MoodRating) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.xs }}>
      <AppText variant="label">How are you feeling?</AppText>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        {MOOD_LEVELS.map((m) => {
          const selected = m.rating === value;
          return (
            <Pressable
              key={m.rating}
              onPress={() => onChange(m.rating)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={m.label}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: t.spacing.xs,
                paddingVertical: t.spacing.md,
                borderRadius: t.radius.md,
                borderWidth: 1.5,
                borderColor: selected ? t.colors.accent : t.colors.border,
                backgroundColor: selected ? t.colors.accentSoft : t.colors.surface,
              }}>
              <Text style={{ fontSize: 26, opacity: selected ? 1 : 0.5 }}>{m.emoji}</Text>
              <AppText variant="caption" color={selected ? t.colors.accent : t.colors.textSecondary} center>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A stored photo thumbnail loaded via a short-lived signed URL; taps open it full-screen. */
function PhotoThumb({ file, size }: { file: TestFileRef; size: number }) {
  const t = useTheme();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // signedFileUrl resolves after a bounded network call; not a cascading render.
    signedFileUrl(file.path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [file.path]);

  async function open() {
    const u = url ?? (await signedFileUrl(file.path));
    if (!u) {
      Alert.alert('Could not open photo', 'Please check your connection and try again.');
      return;
    }
    setUrl(u);
    await WebBrowser.openBrowserAsync(u);
  }

  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={open}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.surfaceMuted,
          borderWidth: 1,
          borderColor: t.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        {url ? (
          <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Ionicons name="image-outline" size={20} color={t.colors.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

function AddMoodForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<MoodData>) => void;
}) {
  const t = useTheme();
  const [rating, setRating] = useState<MoodRating>(3);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [newFiles, setNewFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);

  function addFile(f: PendingFile) {
    setNewFiles((prev) => [...prev, f]);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    addFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', kind: 'image', size: a.fileSize });
  }

  async function choosePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo access in Settings to choose a photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    addFile({ uri: a.uri, name: a.fileName ?? `image-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', kind: 'image', size: a.fileSize });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const uploaded: TestFileRef[] = [];
      for (const f of newFiles) uploaded.push(await uploadCareFile(userId, f));
      const payload: MoodData = {
        kind: 'mood',
        rating,
        note: note.trim() || undefined,
        files: uploaded.length ? uploaded : undefined,
      };
      const log = await addMood(userId, payload, date);
      onSaved(log);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            paddingHorizontal: t.spacing.xl,
            paddingTop: t.spacing.sm,
          }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={12} onPress={onCancel}>
            <Ionicons name="chevron-back" size={26} color={t.colors.text} />
          </Pressable>
          <AppText variant="subtitle">Log how you feel</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <MoodScale value={rating} onChange={setRating} />

          <Card style={{ gap: t.spacing.lg }}>
            <DateField label="Date & time" mode="datetime" value={date} onChange={setDate} maximumDate={new Date()} />
            <Field
              label="How are you feeling?"
              placeholder="How’s the day so far for you?"
              value={note}
              onChangeText={setNote}
              multiline
            />
          </Card>

          <Card style={{ gap: t.spacing.md }}>
            <AppText variant="label">PHOTOS (OPTIONAL)</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Take photo" variant="secondary" icon="camera-outline" onPress={takePhoto} style={{ flexGrow: 1 }} />
              <Button label="Choose photo" variant="secondary" icon="images-outline" onPress={choosePhoto} style={{ flexGrow: 1 }} />
            </View>

            {newFiles.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {newFiles.map((f) => (
                  <View key={f.uri} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: f.uri }}
                      style={{ width: 72, height: 72, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}
                      contentFit="cover"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${f.name}`}
                      hitSlop={8}
                      onPress={() => setNewFiles((prev) => prev.filter((x) => x.uri !== f.uri))}
                      style={{ position: 'absolute', top: -8, right: -8, backgroundColor: t.colors.surface, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.border }}>
                      <Ionicons name="close-circle" size={22} color={t.colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : 'Save check-in'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
