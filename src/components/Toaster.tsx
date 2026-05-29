import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { toast, type ToastItem } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
} as const

const STYLES = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error:   'border-destructive/40 bg-destructive/10 text-destructive',
  info:    'border-primary/40 bg-primary/10 text-primary',
} as const

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => toast.subscribe(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 min-w-[280px] max-w-sm',
              'px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
              'animate-in slide-in-from-right-4 fade-in duration-200',
              STYLES[t.type],
            )}
          >
            <Icon className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
