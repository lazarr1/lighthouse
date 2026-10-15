import { useState } from 'react';
import { describeError } from '@/api/client';
import type { Action } from '@/api/contract';
import { formatDateTime } from '@/lib/format';
import { Button, formStyles, useToast } from '@/ui';
import styles from './ActionsPage.module.css';
import { useSetSchedule } from './hooks';
import { presetFor, SCHEDULE_PRESETS, type PresetId } from './schedulePresets';

const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Enabling a schedule is its own explicit, separately audited step. */
export function ScheduleEditor({ action }: { action: Action }) {
  const toast = useToast();
  const setSchedule = useSetSchedule();
  const current = action.schedule;
  const [preset, setPreset] = useState<PresetId>(presetFor(current?.cron, current?.enabled ?? false));
  const [custom, setCustom] = useState(current?.cron ?? '0 9 * * 1');
  const cron =
    preset === 'custom' ? custom.trim() : (SCHEDULE_PRESETS.find((p) => p.id === preset)?.cron ?? null);
  const enabled = preset !== 'off';
  const dirty = enabled !== (current?.enabled ?? false) || (enabled && cron !== current?.cron);

  const save = () =>
    setSchedule.mutate(
      {
        actionId: action.id,
        cron: cron || current?.cron || '0 9 * * 1',
        timezone: current?.timezone ?? localTimezone(),
        enabled,
      },
      {
        onSuccess: () => toast.success(enabled ? 'Schedule saved.' : 'Schedule turned off.'),
        onError: (error) => toast.error(describeError(error)),
      },
    );

  return (
    <div className={styles.schedule}>
      <label className="visually-hidden" htmlFor={`schedule-${action.id}`}>
        Schedule
      </label>
      <select
        id={`schedule-${action.id}`}
        className={formStyles.select}
        value={preset}
        onChange={(event) => setPreset(event.target.value as PresetId)}
      >
        {SCHEDULE_PRESETS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {preset === 'custom' ? (
        <input
          className={formStyles.input}
          aria-label="Cron expression"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="m h dom mon dow"
        />
      ) : null}
      <p className={styles.note}>
        {current?.enabled
          ? `${current.description} (${current.timezone})${current.nextRunAt ? ` · next ${formatDateTime(current.nextRunAt)}` : action.status === 'paused' ? ' · paused' : ''}`
          : 'Runs only when started manually.'}
      </p>
      {dirty ? (
        <Button size="sm" variant="primary" loading={setSchedule.isPending} onClick={save}>
          {enabled ? 'Approve schedule' : 'Turn off schedule'}
        </Button>
      ) : null}
    </div>
  );
}
