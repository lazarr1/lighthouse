export const SCHEDULE_PRESETS = [
  { id: 'off', label: 'Off (manual only)', cron: null },
  { id: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { id: 'daily', label: 'Every day at 09:00', cron: '0 9 * * *' },
  { id: 'weekdays', label: 'Every weekday at 09:00', cron: '0 9 * * 1-5' },
  { id: 'weekly', label: 'Every Monday at 09:00', cron: '0 9 * * 1' },
  { id: 'custom', label: 'Custom (cron)', cron: '' },
] as const;

export type PresetId = (typeof SCHEDULE_PRESETS)[number]['id'];

export function presetFor(cron: string | null | undefined, enabled: boolean): PresetId {
  if (!cron || !enabled) return 'off';
  return SCHEDULE_PRESETS.find((preset) => preset.cron === cron)?.id ?? 'custom';
}
