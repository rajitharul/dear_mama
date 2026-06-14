import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { useTheme } from '@/theme';

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = 'Select a date',
  mode = 'date',
}: {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  mode?: 'date' | 'datetime';
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ?? new Date());
  // Android can't show a combined date+time picker, so for `datetime` we chain
  // a date step into a time step.
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');

  const displayFormat = mode === 'datetime' ? 'EEE, d MMM yyyy · h:mm a' : 'EEE, d MMM yyyy';

  function openPicker() {
    setTemp(value ?? new Date());
    setAndroidStep('date');
    setOpen(true);
  }

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type !== 'set' || !selected) {
      setOpen(false);
      return;
    }
    if (mode === 'datetime' && androidStep === 'date') {
      setTemp(selected); // keep the chosen date, then ask for the time
      setAndroidStep('time');
      return;
    }
    setOpen(false);
    onChange(selected);
  }

  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        onPress={openPicker}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.colors.surface,
          borderWidth: 1.5,
          borderColor: t.colors.border,
          borderRadius: t.radius.md,
          paddingHorizontal: t.spacing.lg,
          minHeight: 50,
        }}>
        <AppText color={value ? t.colors.text : t.colors.textTertiary}>
          {value ? format(value, displayFormat) : placeholder}
        </AppText>
        <Ionicons name="calendar-outline" size={18} color={t.colors.accent} />
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={temp}
          mode={mode === 'datetime' ? androidStep : 'date'}
          display="default"
          minimumDate={androidStep === 'date' ? minimumDate : undefined}
          maximumDate={androidStep === 'date' ? maximumDate : undefined}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
            <Pressable
              style={{
                backgroundColor: t.colors.surface,
                borderTopLeftRadius: t.radius.xl,
                borderTopRightRadius: t.radius.xl,
                padding: t.spacing.xl,
                gap: t.spacing.md,
              }}>
              <DateTimePicker
                value={temp}
                mode={mode}
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_e, selected) => selected && setTemp(selected)}
              />
              <Button
                label="Done"
                onPress={() => {
                  onChange(temp);
                  setOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
