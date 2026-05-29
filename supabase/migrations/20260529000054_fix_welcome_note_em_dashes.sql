-- Migration 54: Replace em dashes in the welcome note content with colons/semicolons.

UPDATE public.notes
SET content = replace(replace(replace(replace(replace(replace(replace(replace(replace(
  content,
  '<strong>Personal notes</strong> — ', '<strong>Personal notes:</strong> '),
  '<strong>Global notes</strong> — ', '<strong>Global notes:</strong> '),
  '<strong>Shared notes</strong> — ', '<strong>Shared notes:</strong> '),
  '<strong>Rich text</strong> — ', '<strong>Rich text:</strong> '),
  '<strong>Tags</strong> — ', '<strong>Tags:</strong> '),
  '<strong>Pin</strong> — ', '<strong>Pin:</strong> '),
  '<strong>Auto-save</strong> — ', '<strong>Auto-save:</strong> '),
  '<strong>Duplicate</strong> — ', '<strong>Duplicate:</strong> '),
  '<strong>Request edit access</strong> — ', '<strong>Request edit access:</strong> '),
  updated_at = now()
WHERE title = '👋 Welcome to Team Notes';
