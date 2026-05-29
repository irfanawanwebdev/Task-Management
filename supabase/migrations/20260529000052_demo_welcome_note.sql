-- Migration 52: Insert a global welcome note for the team
-- Uses the first active owner profile as the note author.

DO $$
DECLARE
  _owner_id UUID;
BEGIN
  SELECT p.user_id INTO _owner_id
  FROM public.profiles p
  WHERE p.is_active = true
  ORDER BY p.created_at
  LIMIT 1;

  IF _owner_id IS NULL THEN
    RAISE NOTICE 'No active profiles found, skipping welcome note.';
    RETURN;
  END IF;

  INSERT INTO public.notes (created_by, title, content, tags, visibility, pinned)
  VALUES (
    _owner_id,
    '👋 Welcome to Team Notes',
    '<h2>Notes is now live!</h2>
<p>This is your team''s shared workspace for jotting down ideas, documenting decisions, and keeping everyone aligned.</p>
<h3>What you can do</h3>
<ul>
  <li><strong>Personal notes:</strong> private to you; no one else can see them.</li>
  <li><strong>Global notes:</strong> visible to the entire team (toggle the Private/Global badge in the toolbar).</li>
  <li><strong>Shared notes:</strong> share with specific team members using the share icon.</li>
  <li><strong>Rich text:</strong> bold, italics, headings, bullet lists, numbered lists, and more via the editor toolbar.</li>
  <li><strong>Tags:</strong> type a tag and press Enter to categorise notes; filter by tag from the left panel.</li>
  <li><strong>Pin:</strong> pin important notes to keep them at the top of your list.</li>
  <li><strong>Auto-save:</strong> your changes are saved automatically after 1.5 seconds.</li>
  <li><strong>Duplicate:</strong> copy any note as a new personal draft using the copy icon.</li>
  <li><strong>Request edit access:</strong> if a note is global or shared with you but you need to edit it, click <em>Request Edit</em> and the owner will be notified.</li>
</ul>
<h3>Tips</h3>
<ul>
  <li>Use the <strong>All / Mine / Global / Shared</strong> tabs on the left to filter your view.</li>
  <li>Search across titles, content, and tags using the search bar.</li>
  <li>Owners receive a bell notification when someone requests edit access; approve or deny right inside Notes.</li>
</ul>
<p>Feel free to delete or edit this note once the team is up to speed. Happy writing! ✍️</p>',
    ARRAY['welcome', 'notes', 'team'],
    'global',
    true
  )
  ON CONFLICT DO NOTHING;
END;
$$;
