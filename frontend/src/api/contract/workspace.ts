import { z } from 'zod';
import { Id } from './common';

export const Role = z.enum(['owner', 'editor', 'viewer']);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  id: Id,
  name: z.string(),
  email: z.email(),
});
export type User = z.infer<typeof User>;

export const DatasetSummary = z.object({
  id: Id,
  name: z.string(),
  recordCount: z.number().int().nonnegative(),
});
export type DatasetSummary = z.infer<typeof DatasetSummary>;

export const Workspace = z.object({
  id: Id,
  name: z.string(),
  role: Role,
  datasets: z.array(DatasetSummary),
  defaultDashboardId: Id.nullable(),
});
export type Workspace = z.infer<typeof Workspace>;

export const Session = z.object({
  user: User,
  workspaces: z.array(Workspace.pick({ id: true, name: true, role: true })),
});
export type Session = z.infer<typeof Session>;
