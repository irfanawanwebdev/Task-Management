/**
 * HelpPopover — contextual help icon + popover for complex pages/tabs.
 * Click the ? icon to toggle; clicking outside closes it.
 */

import { useState, useRef, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface HelpPopoverProps {
  title: string
  content: React.ReactNode
  /** Which side to open toward. Defaults to 'bottom'. */
  side?: 'bottom' | 'top'
  /** Horizontal alignment of the popover relative to the button. Defaults to 'left'. */
  align?: 'left' | 'right' | 'center'
  className?: string
}

export function HelpPopover({
  title,
  content,
  side = 'bottom',
  align = 'left',
  className = '',
}: HelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const verticalClass = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  const alignClass =
    align === 'right'  ? 'right-0' :
    align === 'center' ? 'left-1/2 -translate-x-1/2' :
                         'left-0'

  return (
    <div ref={ref} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5"
        aria-label="Help"
        title={title}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={`absolute z-[100] w-80 rounded-lg shadow-2xl p-3 ${verticalClass} ${alignClass}`}
          style={{ background: '#1c1c22', border: '1px solid rgba(255,255,255,0.12)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-2">
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#e4e4e7', lineHeight: 1.3 }}>{title}</span>
            <button
              onClick={() => setOpen(false)}
              style={{ color: '#71717a', flexShrink: 0, marginLeft: 6, marginTop: 1 }}
              className="hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: 1.6 }} className="space-y-1.5">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}
