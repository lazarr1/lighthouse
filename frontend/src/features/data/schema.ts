import type { Choice } from '@/api/contract';

const CHOICE_COLORS: Choice['color'][] = ['blue', 'green', 'amber', 'purple', 'grey', 'red'];

export function choicesFromText(text: string): Choice[] {
  return text
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `chc_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label,
      color: CHOICE_COLORS[index % CHOICE_COLORS.length] ?? 'grey',
    }));
}
