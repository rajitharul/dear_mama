import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
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
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addTestResult,
  deleteLog,
  listTestResults,
  removeCareFiles,
  signedFileUrl,
  uploadCareFile,
  type CareLog,
  type PendingFile,
  type TestFileRef,
  type TestResultData,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, DateField, Field, Pill } from '@/ui';

type RecordType = 'attachment' | 'value';

const fileRefsOf = (data: TestResultData): TestFileRef[] =>
  data.kind === 'test_attachment' ? data.files : data.file ? [data.file] : [];

/** Pill flagging a lab value against its reference range, when one is set. */
function rangeStatus(d: Extract<TestResultData, { kind: 'test_value' }>):
  | { label: string; tone: 'success' | 'danger' }
  | null {
  if (typeof d.refLow !== 'number' && typeof d.refHigh !== 'number') return null;
  if (typeof d.refLow === 'number' && d.value < d.refLow) return { label: 'Below range', tone: 'danger' };
  if (typeof d.refHigh === 'number' && d.value > d.refHigh) return { label: 'Above range', tone: 'danger' };
  return { label: 'In range', tone: 'success' };
}

const rangeText = (d: Extract<TestResultData, { kind: 'test_value' }>): string | null => {
  if (typeof d.refLow === 'number' && typeof d.refHigh === 'number') return `Ref ${d.refLow}–${d.refHigh}`;
  if (typeof d.refLow === 'number') return `Ref ≥ ${d.refLow}`;
  if (typeof d.refHigh === 'number') return `Ref ≤ ${d.refHigh}`;
  return null;
};

/** Test results & scans: a history list of lab values and stored scan/report files. */
export function TestResultsLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [logs, setLogs] = useState<CareLog<TestResultData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listTestResults();
      setLogs(fresh);
      setStale(false);
    } catch {
      const cached = await loadLogCache<TestResultData>('test_result');
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

  function confirmDelete(log: CareLog<TestResultData>) {
    Alert.alert('Delete result?', 'This will remove it and any attached files from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await removeCareFiles(fileRefsOf(log.data).map((f) => f.path));
            await deleteLog(log.id, 'test_result');
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
      <AddTestResultForm
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
        <AppText variant="subtitle">Test results & scans</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Add a result" icon="add" onPress={() => setMode('add')} />

        {stale ? (
          <Pill label="Showing saved results — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="document-text-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No results yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Add a lab value, or snap a photo of a report or scan to keep it safe in one place.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => (
            <Animated.View key={log.id} entering={entering(i * 50)}>
              <ResultCard log={log} onDelete={() => confirmDelete(log)} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ log, onDelete }: { log: CareLog<TestResultData>; onDelete: () => void }) {
  const t = useTheme();
  const d = log.data;
  const isValue = d.kind === 'test_value';
  const range = isValue ? rangeStatus(d) : null;
  const files = fileRefsOf(d);

  return (
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
          <Ionicons name={isValue ? 'flask-outline' : 'document-text-outline'} size={22} color={t.colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="subtitle">{isValue ? d.name : d.title}</AppText>
          <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy')}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete result"
          hitSlop={10}
          onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
        </Pressable>
      </View>

      <View style={{ marginLeft: 44 + t.spacing.md, gap: t.spacing.sm }}>
        {isValue ? (
          <>
            <AppText variant="body" weight="bold">
              {d.value}
              {d.unit ? ` ${d.unit}` : ''}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, alignItems: 'center' }}>
              {range ? <Pill label={range.label} tone={range.tone} icon="pulse-outline" /> : null}
              {rangeText(d) ? <AppText variant="caption">{rangeText(d)}</AppText> : null}
            </View>
          </>
        ) : null}

        {d.note ? <AppText variant="bodyMuted">{d.note}</AppText> : null}

        {files.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginTop: t.spacing.xs }}>
            {files.map((f) => (
              <SavedFile key={f.path} file={f} />
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** A stored file: image thumbnail (via signed URL) or a tappable PDF chip; opens in-app. */
function SavedFile({ file }: { file: TestFileRef }) {
  const t = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    if (file.kind === 'image') {
      // signedFileUrl resolves after a bounded network call; not a cascading render.
      signedFileUrl(file.path).then((u) => active && setUrl(u));
    }
    return () => {
      active = false;
    };
  }, [file.path, file.kind]);

  async function open() {
    if (opening) return;
    setOpening(true);
    const u = url ?? (await signedFileUrl(file.path));
    setOpening(false);
    if (!u) {
      Alert.alert('Could not open file', 'Please check your connection and try again.');
      return;
    }
    if (file.kind === 'image') setUrl(u);
    await WebBrowser.openBrowserAsync(u);
  }

  if (file.kind === 'image') {
    return (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={open}>
        <View
          style={{
            width: 72,
            height: 72,
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
            <Ionicons name="image-outline" size={24} color={t.colors.textTertiary} />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${file.name}`}
      onPress={open}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radius.md,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        maxWidth: 220,
      }}>
      {opening ? (
        <ActivityIndicator size="small" color={t.colors.accent} />
      ) : (
        <Ionicons name="document-attach-outline" size={16} color={t.colors.accent} />
      )}
      <AppText variant="caption" color={t.colors.text} style={{ flexShrink: 1 }} numberOfLines={1}>
        {file.name}
      </AppText>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: 'attachment', label: 'Scan / report' },
  { value: 'value', label: 'Lab value' },
];

function AddTestResultForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<TestResultData>) => void;
}) {
  const t = useTheme();
  const [recordType, setRecordType] = useState<RecordType>('attachment');

  // Scan / report fields
  const [title, setTitle] = useState('');
  // Lab value fields
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [refLow, setRefLow] = useState('');
  const [refHigh, setRefHigh] = useState('');

  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [errors, setErrors] = useState<{ title?: string; name?: string; value?: string; files?: string }>({});
  const [saving, setSaving] = useState(false);

  const isValue = recordType === 'value';
  const maxFiles = isValue ? 1 : 8;

  function addFile(f: PendingFile) {
    setErrors((e) => ({ ...e, files: undefined }));
    // In lab-value mode a single optional file replaces any prior pick.
    setFiles((prev) => (isValue ? [f] : [...prev, f]));
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
    addFile({
      uri: a.uri,
      name: a.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: a.mimeType ?? 'image/jpeg',
      kind: 'image',
      size: a.fileSize,
    });
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
    addFile({
      uri: a.uri,
      name: a.fileName ?? `image-${Date.now()}.jpg`,
      mimeType: a.mimeType ?? 'image/jpeg',
      kind: 'image',
      size: a.fileSize,
    });
  }

  async function attachPdf() {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    addFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf', kind: 'pdf', size: a.size });
  }

  function removeFile(uri: string) {
    setFiles((prev) => prev.filter((f) => f.uri !== uri));
  }

  async function save() {
    if (saving) return;
    const next: typeof errors = {};
    let data: TestResultData;

    if (isValue) {
      const cleanName = name.trim();
      const num = Number(value.trim());
      if (!cleanName) next.name = 'Please name the test';
      if (!value.trim() || !Number.isFinite(num)) next.value = 'Enter a number';
      if (next.name || next.value) {
        setErrors(next);
        return;
      }
      const low = refLow.trim() ? Number(refLow.trim()) : undefined;
      const high = refHigh.trim() ? Number(refHigh.trim()) : undefined;
      data = {
        kind: 'test_value',
        name: cleanName,
        value: num,
        unit: unit.trim() || undefined,
        refLow: Number.isFinite(low) ? low : undefined,
        refHigh: Number.isFinite(high) ? high : undefined,
        note: note.trim() || undefined,
        file: undefined, // filled after upload
      };
    } else {
      const cleanTitle = title.trim();
      if (!cleanTitle) next.title = 'Please give it a title';
      if (files.length === 0) next.files = 'Attach at least one photo or PDF';
      if (next.title || next.files) {
        setErrors(next);
        return;
      }
      data = { kind: 'test_attachment', title: cleanTitle, note: note.trim() || undefined, files: [] };
    }

    setErrors({});
    setSaving(true);
    try {
      const refs: TestFileRef[] = [];
      for (const f of files) refs.push(await uploadCareFile(userId, f));
      if (data.kind === 'test_value') data.file = refs[0];
      else data.files = refs;
      const log = await addTestResult(userId, data, date);
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
          <AppText variant="subtitle">Add a result</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ChipSelect
            label="What are you adding?"
            options={RECORD_TYPES.map((r) => r.label)}
            value={[RECORD_TYPES.find((r) => r.value === recordType)!.label]}
            onChange={(nextSel) => {
              const found = RECORD_TYPES.find((r) => r.label === nextSel[0]);
              if (found) {
                setRecordType(found.value);
                setErrors({});
                if (found.value === 'value') setFiles((prev) => prev.slice(0, 1));
              }
            }}
          />

          <Card style={{ gap: t.spacing.lg }}>
            {isValue ? (
              <>
                <Field
                  label="Test name"
                  placeholder="e.g. Hemoglobin"
                  value={name}
                  onChangeText={setName}
                  error={errors.name}
                />
                <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Value"
                      placeholder="e.g. 11.2"
                      value={value}
                      onChangeText={setValue}
                      keyboardType="decimal-pad"
                      error={errors.value}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Unit (optional)" placeholder="e.g. g/dL" value={unit} onChangeText={setUnit} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Ref low (optional)"
                      placeholder="e.g. 11"
                      value={refLow}
                      onChangeText={setRefLow}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Ref high (optional)"
                      placeholder="e.g. 15"
                      value={refHigh}
                      onChangeText={setRefHigh}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </>
            ) : (
              <Field
                label="Title"
                placeholder="e.g. 20-week anomaly scan"
                value={title}
                onChangeText={setTitle}
                error={errors.title}
              />
            )}

            <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

            <Field
              label="Note (optional)"
              placeholder="Anything you’d like to remember"
              value={note}
              onChangeText={setNote}
              multiline
            />
          </Card>

          <Card style={{ gap: t.spacing.md }}>
            <AppText variant="label">{isValue ? 'ATTACHMENT (OPTIONAL)' : 'ATTACHMENTS'}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Take photo" variant="secondary" icon="camera-outline" onPress={takePhoto} style={{ flexGrow: 1 }} />
              <Button label="Choose photo" variant="secondary" icon="images-outline" onPress={choosePhoto} style={{ flexGrow: 1 }} />
              <Button label="Attach PDF" variant="secondary" icon="document-outline" onPress={attachPdf} style={{ flexGrow: 1 }} />
            </View>
            {files.length >= maxFiles ? (
              <AppText variant="caption">
                {isValue ? 'A lab value keeps one attachment — adding another replaces it.' : 'Up to 8 files.'}
              </AppText>
            ) : null}
            {errors.files ? (
              <AppText variant="caption" color={t.colors.danger}>
                {errors.files}
              </AppText>
            ) : null}

            {files.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {files.map((f) => (
                  <View key={f.uri} style={{ position: 'relative' }}>
                    {f.kind === 'image' ? (
                      <Image
                        source={{ uri: f.uri }}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: t.radius.md,
                          borderWidth: 1,
                          borderColor: t.colors.border,
                        }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: t.spacing.xs,
                          backgroundColor: t.colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: t.colors.border,
                          borderRadius: t.radius.md,
                          paddingHorizontal: t.spacing.md,
                          paddingVertical: t.spacing.sm,
                          maxWidth: 200,
                          minHeight: 72,
                        }}>
                        <Ionicons name="document-attach-outline" size={16} color={t.colors.accent} />
                        <AppText variant="caption" color={t.colors.text} numberOfLines={2} style={{ flexShrink: 1 }}>
                          {f.name}
                        </AppText>
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${f.name}`}
                      hitSlop={8}
                      onPress={() => removeFile(f.uri)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        backgroundColor: t.colors.surface,
                        borderRadius: t.radius.pill,
                        borderWidth: 1,
                        borderColor: t.colors.border,
                      }}>
                      <Ionicons name="close-circle" size={22} color={t.colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button
            label={saving ? 'Saving…' : 'Save result'}
            icon="checkmark"
            onPress={save}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
