/**
 * HelpPopover — contextual help icon + popover for complex pages/tabs.
 * Click the ? icon to toggle; clicking outside closes it.
 * Uses fixed positioning to avoid clipping by overflow:hidden ancestors.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
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

const POPOVER_WIDTH = 320

export function HelpPopover({
  title,
  content,
  side = 'bottom',
  align = 'left',
  className = '',
}: HelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const gap = 6

    let top = side === 'top' ? r.top - gap : r.bottom + gap

    let left: number
    if (align === 'right') {
      left = r.right - POPOVER_WIDTH
    } else if (align === 'center') {
      left = r.left + r.width / 2 - POPOVER_WIDTH / 2
    } else {
      left = r.left
    }

    // Clamp horizontally so popover stays inside viewport
    const vw = window.innerWidth
    if (left + POPOVER_WIDTH > vw - 8) left = vw - POPOVER_WIDTH - 8
    if (left < 8) left = 8

    setPos({ top, left })
  }, [side, align])

  useEffect(() => {
    if (!open) return
    calcPos()

    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popRef.current  && !popRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [open, calcPos])

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5"
        aria-label="Help"
        title={title}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: POPOVER_WIDTH,
            background: '#1c1c22',
            border: '1px solid rgba(255,255,255,0.12)',
            zIndex: 9999,
          }}
          className="rounded-lg shadow-2xl p-3"
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
