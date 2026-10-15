import { z } from 'zod';
import { Id, Timestamp } from './common';

export const ALLOWED_UPLOAD_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/csv',
] as const;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const CreateUploadBody = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_UPLOAD_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const Upload = z.object({
  id: Id,
  filename: z.string(),
  contentType: z.string(),
  size: z.number().int().nonnegative(),
  /** Files are quarantined and scanned before any worker can read them. */
  status: z.enum(['pending', 'quarantined', 'ready', 'rejected']),
  createdAt: Timestamp,
});
export type Upload = z.infer<typeof Upload>;

/** A pre-signed, short-lived object storage target. The browser PUTs the bytes directly. */
export const UploadTicket = z.object({
  upload: Upload,
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: Timestamp,
});
export type UploadTicket = z.infer<typeof UploadTicket>;
