-- Migration 42: Allow text/html uploads in the task-attachments storage bucket.
-- Run this after creating the bucket in Supabase Dashboard.
-- If allowed_mime_types is NULL the bucket already allows all types — this is a no-op in that case.

UPDATE storage.buckets
SET allowed_mime_types = array_append(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  'text/html'
)
WHERE name = 'task-attachments'
  AND (allowed_mime_types IS NULL OR NOT ('text/html' = ANY(allowed_mime_types)));
