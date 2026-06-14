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
}: {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ?? new Date());

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    setOpen(false);
    if (event.type === 'set' && selected) onChange(selected);
  }

  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select a date'}
        onPress={() => {
          setTemp(value ?? new Date());
          setOpen(true);
        }}
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
          {value ? format(value, 'EEE, d MMM yyyy') : placeholder}
        </AppText>
        <Ionicons name="calendar-outline" size={18} color={t.colors.accent} />
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={temp}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
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
                mode="date"
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
