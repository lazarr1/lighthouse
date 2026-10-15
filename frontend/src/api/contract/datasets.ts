import { z } from 'zod';
import { Id, Revision, Timestamp } from './common';

export const FieldType = z.enum([
  'text',
  'longText',
  'number',
  'money',
  'percent',
  'date',
  'datetime',
  'boolean',
  'singleSelect',
  'multiSelect',
  'url',
]);
export type FieldType = z.infer<typeof FieldType>;

export const ChoiceColor = z.enum(['grey', 'green', 'amber', 'red', 'blue', 'purple']);
export type ChoiceColor = z.infer<typeof ChoiceColor>;

export const Choice = z.object({
  id: Id,
  label: z.string().min(1),
  color: ChoiceColor,
});
export type Choice = z.infer<typeof Choice>;

/** Type-specific settings. Only the keys relevant to a field's type are present. */
export const FieldConfig = z.object({
  choices: z.array(Choice).optional(),
  /** ISO 4217 code for `money` fields. */
  currency: z.string().length(3).optional(),
  decimals: z.number().int().min(0).max(6).optional(),
});
export type FieldConfig = z.infer<typeof FieldConfig>;

export const Field = z.object({
  /** Stable ID. Record values and chart queries reference this, never `name`. */
  id: Id,
  name: z.string().min(1).max(120),
  type: FieldType,
  description: z.string().default(''),
  required: z.boolean(),
  /** Deprecated fields are hidden by default and purged later; data is retained. */
  status: z.enum(['active', 'deprecated']),
  config: FieldConfig,
});
export type Field = z.infer<typeof Field>;

export const DatasetHealth = z.object({
  /** 0–100 */
  score: z.number().min(0).max(100),
  recordsNeedingReview: z.number().int().nonnegative(),
});

export const Dataset = z.object({
  id: Id,
  workspaceId: Id,
  name: z.string(),
  description: z.string(),
  primaryFieldId: Id,
  fields: z.array(Field),
  recordCount: z.number().int().nonnegative(),
  schemaVersion: Revision,
  /** Increments on every committed data change; used for cache keys and provenance. */
  dataRevision: Revision,
  health: DatasetHealth,
  updatedAt: Timestamp,
});
export type Dataset = z.infer<typeof Dataset>;

// ── Schema changes ──────────────────────────────────────────────────────────

export const SchemaChange = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('addField'),
    name: z.string().min(1).max(120),
    type: FieldType,
    config: FieldConfig.optional(),
  }),
  z.object({ op: z.literal('renameField'), fieldId: Id, name: z.string().min(1).max(120) }),
  z.object({
    op: z.literal('changeFieldType'),
    fieldId: Id,
    type: FieldType,
    config: FieldConfig.optional(),
  }),
  z.object({ op: z.literal('updateFieldConfig'), fieldId: Id, config: FieldConfig }),
  z.object({ op: z.literal('deprecateField'), fieldId: Id }),
  z.object({ op: z.literal('restoreField'), fieldId: Id }),
]);
export type SchemaChange = z.infer<typeof SchemaChange>;

export const SchemaChangeRequest = z.object({
  /** Must equal the dataset's current `schemaVersion`, otherwise `revision_conflict`. */
  expectedSchemaVersion: Revision,
  changes: z.array(SchemaChange).min(1),
});
export type SchemaChangeRequest = z.infer<typeof SchemaChangeRequest>;

export const DependentArtifact = z.object({
  kind: z.enum(['widget', 'action', 'view']),
  id: Id,
  name: z.string(),
  effect: z.enum(['unaffected', 'needs_attention', 'broken']),
  reason: z.string(),
});
export type DependentArtifact = z.infer<typeof DependentArtifact>;

export const ConversionReport = z.object({
  fieldId: Id,
  convertible: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  examples: z.array(z.object({ recordId: Id, value: z.string(), reason: z.string() })).max(10),
});
export type ConversionReport = z.infer<typeof ConversionReport>;

export const SchemaImpact = z.object({
  /** True when the change needs explicit confirmation (data loss, failed conversions, broken dependents). */
  requiresConfirmation: z.boolean(),
  summary: z.string(),
  conversions: z.array(ConversionReport),
  dependents: z.array(DependentArtifact),
});
export type SchemaImpact = z.infer<typeof SchemaImpact>;

export const SchemaChangeResult = z.object({
  dataset: Dataset,
  changeSetId: Id,
});
