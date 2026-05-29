import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Pin, Globe, Lock, Share2, Copy, Trash2,
  X, Tag, Loader2, FileText, Check, Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { RichTextEditor, RichTextDisplay } from '@/components/RichTextEditor'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  created_by: string
  title: string
  content: string
  tags: string[]
  visibility: 'personal' | 'global'
  pinned: boolean
  created_at: string
  updated_at: string
  note_shares?: { shared_with: string }[]
}

interface TeamMember {
  user_id: string
  full_name: string
  department: string | null
}

type FilterTab = 'all' | 'mine' | 'global' | 'shared'
type SaveStatus = 'saved' | 'saving' | 'unsaved'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr  < 24)  return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d   < 7)   return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─── Share Dialog ─────────────────────────────────────────────────────────────

function ShareDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(note.note_shares?.map(s => s.shared_with) ?? [])
  )

  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as unknown as TeamMember[]
    },
  })

  const saveShares = useMutation({
    mutationFn: async () => {
      await supabase.from('note_shares').delete().eq('note_id', note.id)
      if (selected.size > 0) {
        const rows = [...selected].map(uid => ({
          note_id: note.id,
          shared_with: uid,
          note_owner: note.created_by,
        }))
        const { error } = await supabase.from('note_shares').insert(rows as never)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Sharing updated.')
      onClose()
    },
    onError: (e: Error) => toast.error(`Share failed: ${e.message}`),
  })

  const others = members.filter(m => m.user_id !== profile?.user_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Share with team</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-3 space-y-0.5">
          {others.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No other team members.</p>
          )}
          {others.map(m => {
            const checked  = selected.has(m.user_id)
            const initials = m.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            return (
              <label
                key={m.user_id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = new Set(selected)
                    checked ? next.delete(m.user_id) : next.add(m.user_id)
                    setSelected(next)
                  }}
                  className="rounded"
                />
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-semibold">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {m.department?.replace(/_/g, ' ') ?? ''}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 px-3 bg-muted rounded-md text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => saveShares.mutate()}
            disabled={saveShares.isPending}
            className="flex-1 py-1.5 px-3 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saveShares.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Note List Item ───────────────────────────────────────────────────────────

function NoteListItem({
  note,
  isSelected,
  currentUserId,
  onClick,
}: {
  note: Note
  isSelected: boolean
  currentUserId: string
  onClick: () => void
}) {
  const preview      = stripHtml(note.content).slice(0, 70) || 'Empty note'
  const isOwn        = note.created_by === currentUserId
  const isSharedWith = !isOwn && note.visibility !== 'global'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg transition-colors border',
        isSelected
          ? 'bg-primary/10 border-primary/30'
          : 'border-transparent hover:bg-muted'
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-1.5 mb-0.5">
        <span className="text-sm font-medium truncate leading-tight">
          {note.title || 'Untitled note'}
        </span>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {note.pinned && <Pin className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />}
          {note.visibility === 'global' && <Globe className="h-2.5 w-2.5 text-blue-400" />}
          {isSharedWith && <Share2 className="h-2.5 w-2.5 text-violet-400" />}
        </div>
      </div>

      {/* Preview */}
      <p className="text-xs text-muted-foreground truncate leading-relaxed">{preview}</p>

      {/* Tags + time */}
      <div className="flex items-center justify-between mt-1.5 gap-1">
        <div className="flex gap-1 overflow-hidden">
          {note.tags.slice(0, 2).map(tag => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0 rounded-full bg-primary/10 text-primary truncate max-w-[72px]"
            >
              {tag}
            </span>
          ))}
          {note.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{note.tags.length - 2}</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          {timeAgo(note.updated_at)}
        </span>
      </div>
    </button>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const queryClient  = useQueryClient()
  const { profile }  = useAuth()
  const currentUserId = profile?.user_id ?? ''

  // ── List state ──────────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // ── Selected note + editor state ────────────────────────────────────────────
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [localTitle,      setLocalTitle]      = useState('')
  const [localContent,    setLocalContent]    = useState('')
  const [localTags,       setLocalTags]       = useState<string[]>([])
  const [localVisibility, setLocalVisibility] = useState<'personal' | 'global'>('personal')
  const [localPinned,     setLocalPinned]     = useState(false)
  const [tagInput,        setTagInput]        = useState('')

  // ── Auto-save refs (avoid stale closures inside setTimeout) ─────────────────
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef        = useRef(false)
  const skipNextSaveRef = useRef(false)  // set true when loading a note to skip the first effect

  // Keep always-current draft readable from callbacks/timeouts
  const draftRef = useRef({ id: '', title: '', content: '', tags: [] as string[], visibility: 'personal' as 'personal'|'global', pinned: false })
  draftRef.current = { id: selectedId ?? '', title: localTitle, content: localContent, tags: localTags, visibility: localVisibility, pinned: localPinned }

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [saveStatus,     setSaveStatus]     = useState<SaveStatus>('saved')
  const [showShare,      setShowShare]      = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  // ── Fetch notes ──────────────────────────────────────────────────────────────
  const { data: notes = [], isLoading, error: notesError } = useQuery<Note[]>({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*, note_shares(shared_with)')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Note[]
    },
  })

  // Surface query errors as toasts (fires once per error change)
  useEffect(() => {
    if (notesError) toast.error(`Failed to load notes: ${(notesError as Error).message}`)
  }, [notesError])

  // ── Mutations ────────────────────────────────────────────────────────────────

  const saveNote = useMutation({
    mutationFn: async (d: typeof draftRef.current) => {
      const { error } = await supabase
        .from('notes')
        .update({ title: d.title, content: d.content, tags: d.tags, visibility: d.visibility, pinned: d.pinned, updated_at: new Date().toISOString() } as never)
        .eq('id', d.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setSaveStatus('saved')
    },
    onError: (e: Error) => {
      setSaveStatus('unsaved')
      toast.error(`Save failed: ${e.message}`)
    },
  })

  const createNote = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error('Not logged in — please refresh the page.')
      const { data, error } = await supabase
        .from('notes')
        .insert({ created_by: currentUserId, title: '', content: '', tags: [], visibility: 'personal', pinned: false } as never)
        .select('*, note_shares(shared_with)')
        .single()
      if (error) throw error
      return data as unknown as Note
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      loadNote(note)
    },
    onError: (e: Error) => toast.error(`Could not create note: ${e.message}`),
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setSelectedId(null)
      setConfirmDelete(false)
      dirtyRef.current = false
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  })

  const duplicateNote = useMutation({
    mutationFn: async (note: Note) => {
      if (!currentUserId) throw new Error('Not logged in — please refresh the page.')
      const { data, error } = await supabase
        .from('notes')
        .insert({
          created_by: currentUserId,
          title: note.title ? `${note.title} (copy)` : 'Copy',
          content: note.content,
          tags: note.tags,
          visibility: 'personal',
          pinned: false,
        } as never)
        .select('*, note_shares(shared_with)')
        .single()
      if (error) throw error
      return data as unknown as Note
    },
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      loadNote(note)
    },
    onError: (e: Error) => toast.error(`Duplicate failed: ${e.message}`),
  })

  // ── Auto-save ─────────────────────────────────────────────────────────────────

  const flushSave = useCallback(() => {
    if (!dirtyRef.current || !draftRef.current.id) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    dirtyRef.current = false
    setSaveStatus('saving')
    saveNote.mutate({ ...draftRef.current })
  }, [saveNote])

  // Fires whenever editor fields change
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return }
    if (!draftRef.current.id) return
    dirtyRef.current = true
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => flushSave(), 1500)
  }, [localTitle, localContent, localTags, localVisibility, localPinned]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush on unmount
  useEffect(() => () => { flushSave() }, [flushSave])

  // ── Load note into editor ─────────────────────────────────────────────────────

  const loadNote = useCallback((note: Note) => {
    flushSave()
    skipNextSaveRef.current = true
    setSelectedId(note.id)
    setLocalTitle(note.title)
    setLocalContent(note.content)
    setLocalTags(note.tags ?? [])
    setLocalVisibility(note.visibility)
    setLocalPinned(note.pinned)
    setSaveStatus('saved')
    dirtyRef.current = false
    setConfirmDelete(false)
    setShowShare(false)
    setTagInput('')
  }, [flushSave])

  // ── Computed ──────────────────────────────────────────────────────────────────

  const selectedNote = notes.find(n => n.id === selectedId) ?? null
  const isOwner      = selectedNote?.created_by === currentUserId

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags))).sort()

  const filteredNotes = notes.filter(n => {
    if (filterTab === 'mine'   && n.created_by !== currentUserId) return false
    if (filterTab === 'global' && n.visibility !== 'global') return false
    if (filterTab === 'shared' && (n.created_by === currentUserId || n.visibility === 'global')) return false
    if (tagFilter && !n.tags.includes(tagFilter)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        n.title.toLowerCase().includes(q) ||
        stripHtml(n.content).toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  // ── Tag helpers ───────────────────────────────────────────────────────────────

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/,/g, '')
    if (!t || localTags.includes(t)) { setTagInput(''); return }
    setLocalTags(prev => [...prev, t])
    setTagInput('')
  }

  // ── Pin toggle (immediate save) ───────────────────────────────────────────────

  const togglePin = () => {
    if (!selectedId) return
    const next = !localPinned
    setLocalPinned(next)
    skipNextSaveRef.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    dirtyRef.current = false
    saveNote.mutate({ ...draftRef.current, id: selectedId, pinned: next })
  }

  const toggleVisibility = () => {
    setLocalVisibility(v => v === 'personal' ? 'global' : 'personal')
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-6">

      {/* ── Left panel: note list ─────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border bg-card/50">

        {/* Header */}
        <div className="px-4 pt-4 pb-2 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h1 className="font-semibold text-sm">Notes</h1>
              {notes.length > 0 && (
                <span className="text-[10px] text-muted-foreground">({notes.length})</span>
              )}
            </div>
            <button
              onClick={() => createNote.mutate()}
              disabled={createNote.isPending}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {createNote.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Plus className="h-3 w-3" />}
              New
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
            {(['all', 'mine', 'global', 'shared'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  'flex-1 py-1 rounded-md text-[10px] font-medium transition-colors capitalize',
                  filterTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1 shrink-0">
            {allTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                  tagFilter === tag
                    ? 'bg-primary/20 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                )}
              >
                #{tag}
              </button>
            ))}
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="text-[10px] px-1.5 py-0.5 rounded-full text-destructive hover:text-destructive/80"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Note list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {isLoading && (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && filteredNotes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground px-4 text-center">
              <FileText className="h-6 w-6 opacity-30" />
              <p className="text-xs">
                {search || tagFilter ? 'No notes match your filter.' : 'No notes yet. Create your first one.'}
              </p>
            </div>
          )}

          {filteredNotes.map(note => (
            <NoteListItem
              key={note.id}
              note={note}
              isSelected={note.id === selectedId}
              currentUserId={currentUserId}
              onClick={() => loadNote(note)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel: editor ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">

        {!selectedId ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground select-none">
            <FileText className="h-14 w-14 opacity-10" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Select a note to start editing</p>
              <p className="text-xs opacity-60">or create a new one</p>
            </div>
            <button
              onClick={() => createNote.mutate()}
              disabled={createNote.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Plus className="h-4 w-4" /> New Note
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-border shrink-0 gap-4">

              {/* Left: visibility badge */}
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <button
                    onClick={toggleVisibility}
                    title={localVisibility === 'global' ? 'Team-wide — click to make private' : 'Private — click to share with everyone'}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                      localVisibility === 'global'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/15'
                        : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {localVisibility === 'global'
                      ? <><Globe className="h-3 w-3" /> Global</>
                      : <><Lock className="h-3 w-3" /> Private</>}
                  </button>
                ) : (
                  <span className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border',
                    selectedNote?.visibility === 'global'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                  )}>
                    {selectedNote?.visibility === 'global'
                      ? <><Globe className="h-3 w-3" /> Global</>
                      : <><Share2 className="h-3 w-3" /> Shared with you</>}
                  </span>
                )}

                {/* Share count hint */}
                {isOwner && (selectedNote?.note_shares?.length ?? 0) > 0 && (
                  <span className="text-xs text-violet-400">
                    Shared with {selectedNote!.note_shares!.length}
                  </span>
                )}
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1">
                {/* Save status */}
                <span className={cn(
                  'text-xs mr-1 min-w-[52px] text-right',
                  saveStatus === 'unsaved' ? 'text-amber-400' : 'text-muted-foreground/50',
                )}>
                  {saveStatus === 'saving'  && 'Saving…'}
                  {saveStatus === 'unsaved' && 'Unsaved'}
                  {saveStatus === 'saved'   && 'Saved'}
                </span>

                {/* Pin */}
                {isOwner && (
                  <button
                    onClick={togglePin}
                    title={localPinned ? 'Unpin' : 'Pin note'}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      localPinned
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Pin className={cn('h-3.5 w-3.5', localPinned && 'fill-amber-400')} />
                  </button>
                )}

                {/* Share */}
                {isOwner && (
                  <button
                    onClick={() => setShowShare(true)}
                    title="Share with team members"
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      (selectedNote?.note_shares?.length ?? 0) > 0
                        ? 'text-violet-400 bg-violet-400/10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Duplicate */}
                <button
                  onClick={() => selectedNote && duplicateNote.mutate(selectedNote)}
                  disabled={duplicateNote.isPending}
                  title="Duplicate note"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  {duplicateNote.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>

                {/* Delete */}
                {isOwner && (
                  confirmDelete ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-destructive font-medium">Delete?</span>
                      <button
                        onClick={() => deleteNote.mutate(selectedId)}
                        disabled={deleteNote.isPending}
                        className="text-xs px-1.5 py-0.5 bg-destructive text-destructive-foreground rounded hover:opacity-90 disabled:opacity-50"
                      >
                        {deleteNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs px-1.5 py-0.5 bg-muted rounded hover:bg-accent"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      title="Delete note"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Note body */}
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-3">
              {/* Title */}
              <input
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                placeholder="Note title…"
                readOnly={!isOwner}
                className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/30 read-only:cursor-default"
              />

              {/* Tags row */}
              <div className="flex flex-wrap items-center gap-1.5 min-h-[24px]">
                <Tag className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                {localTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium"
                  >
                    {tag}
                    {isOwner && (
                      <button
                        onClick={() => setLocalTags(prev => prev.filter(t => t !== tag))}
                        className="hover:text-destructive transition-colors ml-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
                {isOwner && (
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                      if (e.key === 'Backspace' && !tagInput && localTags.length > 0) {
                        setLocalTags(prev => prev.slice(0, -1))
                      }
                    }}
                    onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                    placeholder={localTags.length === 0 ? 'Add tag and press Enter…' : '+tag'}
                    className="text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/40 min-w-[80px] flex-1"
                  />
                )}
              </div>

              <div className="border-t border-border/30" />

              {/* Content */}
              {isOwner ? (
                <RichTextEditor
                  value={localContent}
                  onChange={setLocalContent}
                  placeholder="Start writing…"
                  minRows={16}
                />
              ) : (
                <RichTextDisplay
                  html={localContent}
                  emptyText="No content yet."
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Share dialog */}
      {showShare && selectedNote && (
        <ShareDialog
          note={selectedNote}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
