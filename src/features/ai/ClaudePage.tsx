/**
 * ClaudePage — Full-page Claude AI assistant.
 * Upload meeting transcripts (e.g. from Otter.ai), send instructions,
 * and have Claude automatically create tasks in the task list.
 */

import { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Paperclip, Loader2, Database, AlertCircle,
  Trash2, Upload, FileText, Sparkles, X,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
  isError?: boolean
  isLoading?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What tasks are due this week?',
  'Show all open blockers',
  'List all active clients with their risk scores',
  'What meetings are scheduled this month?',
]

const TRANSCRIPT_PROMPTS = [
  'Create tasks from the action items in this transcript',
  'Summarize this meeting and create follow-up tasks',
  'Extract deadlines and assign tasks to the team',
  'Turn the meeting notes into a task list with due dates',
]

const TOOL_LABELS: Record<string, string> = {
  query_tasks:       'queried tasks',
  query_clients:     'queried clients',
  query_meetings:    'queried meetings',
  query_blockers:    'queried blockers',
  add_task:          'created task',
  update_meeting:    'updated meeting',
  add_blocker:       'created blocker',
  bulk_create_tasks: 'bulk-created tasks',
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  return (
    <div className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
      {msg.role === 'assistant' && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 shrink-0 mt-1">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        msg.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : msg.isError
            ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm'
            : 'bg-muted/40 border border-border/40 rounded-tl-sm',
      )}>
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
            <div className="whitespace-pre-wrap">{msg.content}</div>
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
  )
}

// ─── Uploaded File Banner ─────────────────────────────────────────────────────

function FileBanner({
  fileName,
  onRemove,
  onSend,
}: {
  fileName: string
  onRemove: () => void
  onSend: (prompt: string) => void
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1 truncate">{fileName}</span>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">File loaded. Choose a prompt to send with it:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TRANSCRIPT_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => onSend(p)}
            className="text-xs text-left px-3 py-2 rounded-lg border border-border/50 bg-card
                       hover:bg-primary/5 hover:border-primary/30 transition-colors text-foreground/80"
          >
            <Sparkles className="h-3 w-3 inline mr-1.5 text-primary" />
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── localStorage helpers (mirrors AIChat) ───────────────────────────────────

const HISTORY_LIMIT = 50

function storageKey(userId: string) { return `ai-chat-history:${userId}` }

function loadHistory(userId: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    return (JSON.parse(raw) as Message[]).filter(m => !m.isLoading && !m.isError)
  } catch { return [] }
}

function saveHistory(userId: string, msgs: Message[]) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify(msgs.filter(m => !m.isLoading && !m.isError).slice(-HISTORY_LIMIT)),
    )
  } catch { /* quota exceeded */ }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClaudePage() {
  const { profile, role }        = useAuth()
  const [messages, setMessages]  = useState<Message[]>([])
  const [input, setInput]        = useState('')
  const [loading, setLoading]    = useState(false)
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history for the current user on mount / user change
  useEffect(() => {
    if (profile?.id) setMessages(loadHistory(profile.id))
    else setMessages([])
  }, [profile?.id])

  // Persist history whenever messages update
  useEffect(() => {
    if (profile?.id && messages.length > 0) saveHistory(profile.id, messages)
  }, [messages, profile?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const sendMessage = async (content: string, fileContent?: string) => {
    if (!content.trim() || loading) return

    const fullContent = fileContent
      ? `${content}\n\n[Attached file content]\n---\n${fileContent}\n---`
      : content

    const userMsg: Message = { role: 'user', content: content }
    const loadingMsg: Message = { role: 'assistant', content: '', isLoading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setPendingFile(null)
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const history = [...messages, { role: 'user' as const, content: fullContent }].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: history,
            user_name: profile?.full_name ?? 'Team Member',
            user_role: role ?? 'team member',
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Request failed (${res.status})`)
      }

      const data = await res.json()
      setMessages(prev => [
        ...prev.slice(0, -1),
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setPendingFile({ name: file.name, content })
    e.target.value = ''
  }

  const handleFileSend = (prompt: string) => {
    if (!pendingFile) return
    sendMessage(
      `[File: ${pendingFile.name}]\n${prompt}`,
      pendingFile.content,
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (pendingFile) {
        sendMessage(input || TRANSCRIPT_PROMPTS[0], pendingFile.content)
      } else {
        sendMessage(input)
      }
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] max-h-[900px]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Claude AI</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions, upload transcripts, generate tasks
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([])
              if (profile?.id) localStorage.removeItem(storageKey(profile.id))
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground
                       px-3 py-1.5 rounded-lg border border-border/60 hover:bg-accent transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">What can I help with?</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-md">
                Ask about tasks, clients, or meetings. Upload an Otter.ai transcript and I'll
                extract action items and create tasks automatically.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="text-sm text-left px-4 py-3 rounded-xl border border-border/50 bg-muted/20
                             hover:bg-muted/50 transition-colors text-foreground/80 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Upload className="h-3.5 w-3.5" />
              Upload a .txt or .md file below to send a transcript
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* File banner (shows when file is loaded but not yet sent) */}
      {pendingFile && (
        <div className="mb-3 shrink-0">
          <FileBanner
            fileName={pendingFile.name}
            onRemove={() => setPendingFile(null)}
            onSend={handleFileSend}
          />
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 rounded-xl border border-border bg-card p-3 flex gap-2 items-end">
        {/* File upload */}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.text,.vtt,.srt"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          onClick={() => fileRef.current?.click()}
          title="Upload transcript (.txt, .md, .vtt)"
          className={cn(
            'shrink-0 p-2 rounded-lg transition-colors',
            pendingFile
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingFile
              ? 'Add instructions (or press Enter to use a suggested prompt above)…'
              : 'Ask Claude anything… (Enter to send, Shift+Enter for new line)'
          }
          rows={1}
          disabled={loading}
          className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground
                     min-h-[36px] py-1.5 leading-relaxed disabled:opacity-50"
        />

        {/* Send */}
        <button
          onClick={() => {
            if (pendingFile && !input.trim()) {
              handleFileSend(TRANSCRIPT_PROMPTS[0])
            } else {
              sendMessage(input, pendingFile?.content)
            }
          }}
          disabled={(!input.trim() && !pendingFile) || loading}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground
                     hover:bg-primary/90 disabled:opacity-40 transition-all"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-2 shrink-0">
        Claude can read your database and create tasks. Supported uploads: .txt .md .vtt (Otter.ai exports)
      </p>
    </div>
  )
}
