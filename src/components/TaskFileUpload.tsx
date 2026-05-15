/**
 * TaskFileUpload — reusable file attachment panel for tasks.
 * Uploads to Supabase Storage bucket "task-attachments/{taskId}/".
 * Saves URL list to delivery_tasks.attachments JSONB column.
 *
 * Preview behaviour by file type:
 *   image/*  → in-app lightbox (full resolution)
 *   PDF      → new tab (browser PDF viewer)
 *   HTML     → new tab
 *   other    → new tab / browser download
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { Upload, X, ExternalLink, Loader2, FileText, Image, File, FileCode, ZoomIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export interface Attachment {
  name: string
  url: string
  size: number
  type: string
  uploaded_at: string
}

interface Props {
  taskId: string
  attachments: Attachment[]
  onChange: (updated: Attachment[]) => void
  disabled?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileIcon(mime: string) {
  if (mime.startsWith('image/'))        return <Image    className="h-3.5 w-3.5" />
  if (mime === 'application/pdf')       return <FileText className="h-3.5 w-3.5" />
  if (mime === 'text/html')             return <FileCode className="h-3.5 w-3.5" />
  return <File className="h-3.5 w-3.5" />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)            return `${bytes} B`
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────

function ImageLightbox({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 bg-black/60"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-sm text-white/80 font-medium truncate max-w-[70%]">{att.name}</span>
        <div className="flex items-center gap-3">
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
            title="Open full resolution in new tab"
          >
            <ZoomIn className="h-4 w-4" />
            Full res
          </a>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <img
        src={att.url}
        alt={att.name}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded shadow-2xl"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {/* Bottom hint */}
      <p className="absolute bottom-4 text-xs text-white/30">Click outside or press Esc to close</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TaskFileUpload({ taskId, attachments, onChange, disabled }: Props) {
  const inputRef                      = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]     = useState(false)
  const [error, setError]             = useState('')
  const [dragOver, setDragOver]       = useState(false)
  const [lightbox, setLightbox]       = useState<Attachment | null>(null)

  function handleAttachmentClick(att: Attachment) {
    if (att.type.startsWith('image/')) {
      setLightbox(att)
    } else {
      // PDF, HTML, docs, zip — open in new tab (browser handles natively)
      openInNewTab(att.url)
    }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')
    setUploading(true)

    const newAttachments: Attachment[] = []
    const skipped: string[] = []

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        setError(`${file.name} exceeds 50 MB limit.`)
        continue
      }

      // Deduplicate by name — fetch latest attachments from DB first
      const { data: freshRow } = await supabase
        .from('delivery_tasks')
        .select('attachments')
        .eq('id', taskId)
        .single()
      const currentAttachments: Attachment[] = (freshRow as { attachments?: Attachment[] } | null)?.attachments ?? attachments
      if (currentAttachments.some(a => a.name === file.name)) {
        skipped.push(file.name)
        continue
      }

      const path = `${taskId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { data, error: uploadErr } = await supabase.storage
        .from('task-attachments')
        .upload(path, file, { upsert: false })

      if (uploadErr) {
        setError(`Upload failed: ${uploadErr.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(data.path)

      newAttachments.push({
        name:        file.name,
        url:         publicUrl,
        size:        file.size,
        type:        file.type,
        uploaded_at: new Date().toISOString(),
      })
    }

    if (skipped.length > 0) {
      setError(`Already exists: ${skipped.join(', ')}`)
    }

    if (newAttachments.length > 0) {
      // Re-fetch latest to avoid race between concurrent uploads
      const { data: latestRow } = await supabase
        .from('delivery_tasks')
        .select('attachments')
        .eq('id', taskId)
        .single()
      const base: Attachment[] = (latestRow as { attachments?: Attachment[] } | null)?.attachments ?? attachments
      const updated = [...base, ...newAttachments]
      const { error: dbErr } = await supabase
        .from('delivery_tasks')
        .update({ attachments: updated } as never)
        .eq('id', taskId)
      if (dbErr) {
        setError(`Saved to storage but failed to update task: ${dbErr.message}`)
      } else {
        onChange(updated)
      }
    }
    setUploading(false)
  }

  const removeAttachment = async (idx: number) => {
    const att = attachments[idx]
    const urlParts = att.url.split('/task-attachments/')
    if (urlParts.length > 1) {
      await supabase.storage.from('task-attachments').remove([decodeURIComponent(urlParts[1])])
    }
    const updated = attachments.filter((_, i) => i !== idx)
    const { error: dbErr } = await supabase
      .from('delivery_tasks')
      .update({ attachments: updated } as never)
      .eq('id', taskId)
    if (!dbErr) onChange(updated)
    else setError(`Remove failed: ${dbErr.message}`)
  }

  return (
    <>
      <div className="space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg px-4 py-5 flex flex-col items-center gap-2 cursor-pointer transition-colors',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-accent/30',
            disabled && 'opacity-50 pointer-events-none',
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-xs text-muted-foreground text-center">
            {uploading ? 'Uploading…' : 'Click or drag files here · PDF, images, docs · max 50 MB each'}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.html,.png,.jpg,.jpeg,.gif,.webp,.zip"
            className="hidden"
            onChange={e => uploadFiles(e.target.files)}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Attachment list */}
        {attachments.length > 0 && (
          <div className="space-y-1.5">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 bg-background border border-border rounded-md group"
              >
                <span className="text-muted-foreground shrink-0">{fileIcon(att.type)}</span>

                {/* Clickable filename — behaviour depends on type */}
                <button
                  type="button"
                  onClick={() => handleAttachmentClick(att)}
                  className="flex-1 min-w-0 text-xs font-medium truncate hover:text-primary text-left flex items-center gap-1 transition-colors"
                  title={att.type.startsWith('image/') ? 'Preview image' : 'Open in new tab'}
                >
                  {att.name}
                  {att.type.startsWith('image/')
                    ? <ZoomIn      className="h-3 w-3 shrink-0 opacity-60" />
                    : <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  }
                </button>

                <span className="text-xs text-muted-foreground shrink-0">{formatBytes(att.size)}</span>

                {!disabled && (
                  <button
                    onClick={() => removeAttachment(i)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image lightbox portal */}
      {lightbox && (
        <ImageLightbox att={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}
