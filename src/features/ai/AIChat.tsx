/**
 * AIChat — Floating Claude assistant panel.
 * Accessible from any page via the bottom-right Bot button.
 * Reads and writes to the Operations Hub database via the ai-assistant Edge Function.
 */

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Paperclip, Loader2, Database, AlertCircle, ChevronDown, Maximize2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imagePreview?: string   // data URL — shown in chat bubble, not stored in history
  toolsUsed?: string[]
  isError?: boolean
  isLoading?: boolean
}

interface PastedImage {
  data: string       // raw base64 (no prefix)
  mediaType: string  // e.g. image/png
  preview: string    // data URL for <img> display
}

const SUGGESTIONS = [
  "What tasks are due this week?",
  "Show all open blockers",
  "What meetings do we have today?",
  "List all active clients",
]

const TOOL_LABELS: Record<string, string> = {
  query_tasks: 'tasks',
  query_clients: 'clients',
  query_meetings: 'meetings',
  query_blockers: 'blockers',
  add_task: 'created task',
  update_meeting: 'updated meeting',
  add_blocker: 'created blocker',
  bulk_create_tasks: 'bulk tasks',
}

const HISTORY_LIMIT = 50

function storageKey(userId: string) {
  return `ai-chat-history:${userId}`
}

function loadHistory(userId: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    return (JSON.parse(raw) as Message[]).filter(m => !m.isLoading && !m.isError)
  } catch {
    return []
  }
}

function saveHistory(userId: string, msgs: Message[]) {
  try {
    const toSave = msgs
      .filter(m => !m.isLoading && !m.isError)
      .slice(-HISTORY_LIMIT)
    localStorage.setItem(storageKey(userId), JSON.stringify(toSave))
  } catch { /* quota exceeded — ignore */ }
}

export function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pastedImage, setPastedImage] = useState<PastedImage | null>(null)
  const { profile, role } = useAuth()
  const navigate = useNavigate()
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history when user is known; clear when user switches
  useEffect(() => {
    if (profile?.id) {
      setMessages(loadHistory(profile.id))
    } else {
      setMessages([])
      setOpen(false)
    }
  }, [profile?.id])

  // Persist history to localStorage whenever messages change
  useEffect(() => {
    if (profile?.id && messages.length > 0) {
      saveHistory(profile.id, messages)
    }
  }, [messages, profile?.id])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [input])

  // Global paste listener — catches paste even when textarea isn't focused
  useEffect(() => {
    if (!open) return
    const handler = (e: ClipboardEvent) => {
      if (!e.clipboardData) return
      const items = Array.from(e.clipboardData.items)
      const files = Array.from(e.clipboardData.files)

      // Try items first (screenshots, copy from browser), then files array
      const imgItem = items.find(it => it.type.startsWith('image/'))
      const imgFile = imgItem?.getAsFile()
        ?? files.find(f => f.type.startsWith('image/'))
        ?? null

      if (!imgFile) return
      e.preventDefault()

      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (!dataUrl?.startsWith('data:image')) return
        const [header, b64] = dataUrl.split(',')
        const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/png'
        setPastedImage({ data: b64, mediaType, preview: dataUrl })
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
      reader.readAsDataURL(imgFile)
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [open])

  const sendMessage = async (content: string) => {
    const hasText  = content.trim().length > 0
    const hasImage = pastedImage !== null
    if ((!hasText && !hasImage) || loading) return

    const textContent  = hasText ? content.trim() : 'What is in this image?'
    const currentImage = pastedImage
    setPastedImage(null)

    const userMsg: Message = {
      role: 'user',
      content: textContent,
      imagePreview: currentImage?.preview,
    }
    const loadingMsg: Message = { role: 'assistant', content: '', isLoading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setLoading(true)

    try {
      // History: previous messages as plain text (no images — too large for localStorage anyway)
      const historyMsgs = messages.map(m => ({ role: m.role, content: m.content }))

      // Current user message: content array if image attached, plain string otherwise
      const currentMsg = currentImage
        ? {
            role: 'user' as const,
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: currentImage.mediaType, data: currentImage.data },
              },
              { type: 'text', text: textContent },
            ],
          }
        : { role: 'user' as const, content: textContent }

      const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [...historyMsgs, currentMsg],
          user_name: profile?.full_name ?? 'Team Member',
          user_role: role ?? 'team member',
        },
      })

      if (fnError) throw new Error(fnError.message ?? 'Request failed')
      setMessages(prev => [
        ...prev.slice(0, -1), // remove loading placeholder
        { role: 'assistant', content: data.content, toolsUsed: data.toolsUsed ?? [] },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Image file — attach as vision input
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (!dataUrl?.startsWith('data:image')) return
        const [header, b64] = dataUrl.split(',')
        const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/png'
        setPastedImage({ data: b64, mediaType, preview: dataUrl })
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
      reader.readAsDataURL(file)
      return
    }

    // Text/data file — send as message content
    const text = await file.text()
    const today = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: 'long', day: 'numeric',
    })
    const msg = `[Uploaded: ${file.name}]\n---\n${text}\n---\nToday is ${today}. Please organize these tasks with the correct weekly due dates.`
    await sendMessage(msg)
  }

  // Textarea-level paste — global listener above handles the image capture,
  // but we still prevent the default "paste as file name text" behaviour here.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const hasImage = Array.from(e.clipboardData.items).some(
      it => it.kind === 'file' && it.type.startsWith('image/')
    )
    if (hasImage) e.preventDefault() // let global handler do the work
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-all duration-300',
          'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105',
          open && 'scale-0 opacity-0 pointer-events-none',
        )}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl',
          'transition-all duration-300 origin-bottom-right',
          // Mobile: stretch across screen with small gap on each side
          // Desktop: fixed 420px width anchored bottom-right
          'bottom-2 left-2 right-2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[420px]',
          open
            ? 'h-[calc(100dvh-4rem)] sm:h-[600px] scale-100 opacity-100'
            : 'h-0 scale-90 opacity-0 pointer-events-none',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 bg-muted/20 rounded-t-2xl shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/25 shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">AI Assistant</p>
            <p className="text-xs text-muted-foreground">Claude · reads & writes your data</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([])
                  if (profile?.id) localStorage.removeItem(storageKey(profile.id))
                }}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => { setOpen(false); navigate('/claude') }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Open full Claude page"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Close"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-4 pb-2">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold">What can I help with?</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Query tasks, clients, and meetings.<br />
                  Add items or upload a task timeline.
                </p>
              </div>
              <div className="grid gap-2 w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={loading}
                    className="text-xs text-left px-3 py-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 transition-colors text-foreground/80 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : msg.isError
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm'
                        : 'bg-muted/40 border border-border/40 rounded-tl-sm',
                  )}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-0.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      <span className="text-xs">Thinking…</span>
                    </div>
                  ) : msg.isError ? (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
                      <span>{msg.content}</span>
                    </div>
                  ) : (
                    <>
                      {msg.imagePreview && (
                        <img
                          src={msg.imagePreview}
                          alt="Attached"
                          className="max-h-40 max-w-full rounded-lg mb-1.5 object-contain"
                        />
                      )}
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none
                          [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                          [&_th]:border [&_th]:border-border/40 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/40 [&_th]:font-medium [&_th]:text-left
                          [&_td]:border [&_td]:border-border/40 [&_td]:px-2 [&_td]:py-1
                          [&_tr:nth-child(even)_td]:bg-muted/20
                          [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/30 flex-wrap">
                          <Database className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            {msg.toolsUsed.map(t => TOOL_LABELS[t] ?? t).join(' · ')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-3 shrink-0">
          {/* Pasted image preview */}
          {pastedImage && (
            <div className="relative mb-2 inline-block">
              <img
                src={pastedImage.preview}
                alt="Pasted"
                className="max-h-24 max-w-[160px] rounded-lg border border-border object-cover"
              />
              <button
                onClick={() => setPastedImage(null)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-xl bg-muted/30 border border-border/40 px-3 py-2 focus-within:border-primary/40 transition-colors">
            <button
              onClick={() => fileRef.current?.click()}
              title="Attach image or task file"
              disabled={loading}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-0.5 disabled:opacity-40"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={loading}
              placeholder={pastedImage ? 'Ask about the image… (or just press Enter)' : 'Ask anything… or paste / attach an image'}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-28 leading-relaxed disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={(!input.trim() && !pastedImage) || loading}
              className="shrink-0 rounded-lg bg-primary p-1.5 text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1.5 opacity-60">
            Enter to send · Shift+Enter for newline · Paste image from clipboard
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.json,.md,.xlsx,image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </>
  )
}
