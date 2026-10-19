import { Bell } from 'lucide-react';
import { DatePickerField } from '../../../components/DatePickerField';
import { TimePickerField } from '../../../components/TimePickerField';
import { inputClass, labelClass } from './ui';
import type { ReminderFieldsValue } from '../types/ouv-reminder.types';

function splitEventAt(value: string): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' };
  }
  const [date, time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

function joinEventAt(date: string, time: string): string {
  if (!date && !time) {
    return '';
  }
  if (!date) {
    return `T${time}`;
  }
  if (!time) {
    return date;
  }
  return `${date}T${time}`;
}

type FieldErrors = Partial<
  Record<'event_at' | 'remind_days_before' | 'note', string>
>;

type Props = {
  value: ReminderFieldsValue;
  onChange: (next: ReminderFieldsValue) => void;
  errors?: FieldErrors;
  remindsImmediately: boolean;
};

export function ReminderFields({
  value,
  onChange,
  errors,
  remindsImmediately,
}: Props) {
  const { date, time } = splitEventAt(value.event_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) =>
              onChange({
                ...value,
                enabled: event.target.checked,
                remind_days_before: value.remind_days_before,
              })
            }
          />
          Recordarme
        </label>
        <Bell
          size={13}
          strokeWidth={1.75}
          className="pointer-events-none text-ink"
          aria-hidden
        />
      </div>

      {value.enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="reminder-event-date">
              Fecha
            </label>
            <DatePickerField
              id="reminder-event-date"
              value={date}
              onChange={(nextDate) =>
                onChange({
                  ...value,
                  event_at: joinEventAt(nextDate, time),
                })
              }
            />
            {errors?.event_at ? (
              <p className="mt-1 text-xs text-danger">{errors.event_at}</p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="reminder-event-time">
              Hora
            </label>
            <TimePickerField
              id="reminder-event-time"
              value={time}
              onChange={(nextTime) =>
                onChange({
                  ...value,
                  event_at: joinEventAt(date, nextTime),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="reminder-days-before">
              Avisar días antes
            </label>
            <input
              id="reminder-days-before"
              type="number"
              min={0}
              max={365}
              className={inputClass}
              value={value.remind_days_before}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (!Number.isInteger(parsed)) {
                  return;
                }
                onChange({ ...value, remind_days_before: parsed });
              }}
            />
            {errors?.remind_days_before ? (
              <p className="mt-1 text-xs text-danger">
                {errors.remind_days_before}
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="reminder-note">
              Nota
            </label>
            <input
              id="reminder-note"
              type="text"
              maxLength={500}
              className={inputClass}
              value={value.note}
              onChange={(event) =>
                onChange({ ...value, note: event.target.value })
              }
            />
            {errors?.note ? (
              <p className="mt-1 text-xs text-danger">{errors.note}</p>
            ) : null}
          </div>
          {remindsImmediately ? (
            <p className="sm:col-span-2 text-xs text-muted">
              El aviso se enviará de inmediato
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
