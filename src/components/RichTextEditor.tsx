/**
 * RichTextEditor — Tiptap-based WYSIWYG editor + read-only display.
 *
 * Two exports:
 *   <RichTextEditor>  — editable with toolbar (Bold, Italic, Underline,
 *                        Strikethrough, Link, UL, OL, Code, Code Block, Table)
 *   <RichTextDisplay> — read-only rendered HTML, links open in new tab
 *
 * Content is stored / passed as HTML strings.
 * Paste from Google Docs/Sheets preserves formatting and tables.
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { useCallback, useEffect } from 'react'
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Link2,
  List, ListOrdered, Code, Code2,
  Table as TableIcon, Plus, Minus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolBtn({
  active, disabled, title, onClick, children, danger,
}: {
  active?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded text-sm transition-colors disabled:opacity-40',
        danger
          ? 'text-destructive/70 hover:text-destructive hover:bg-destructive/10'
          : active
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

const Sep = () => <span className="w-px h-4 bg-border mx-0.5 shrink-0" />

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const inTable = editor.isActive('table')

  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url  = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-input bg-muted/30 rounded-t-md">
      {/* Text formatting */}
      <ToolBtn title="Bold (Ctrl+B)"        active={editor.isActive('bold')}        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Italic (Ctrl+I)"      active={editor.isActive('italic')}      onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Underline (Ctrl+U)"   active={editor.isActive('underline')}   onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Strikethrough"        active={editor.isActive('strike')}      onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolBtn>

      <Sep />

      <ToolBtn title="Link"                 active={editor.isActive('link')}        onClick={setLink}>
        <Link2 className="h-3.5 w-3.5" />
      </ToolBtn>

      <Sep />

      <ToolBtn title="Bullet list"          active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Numbered list"        active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolBtn>

      <Sep />

      <ToolBtn title="Inline code"          active={editor.isActive('code')}        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Code block"           active={editor.isActive('codeBlock')}   onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 className="h-3.5 w-3.5" />
      </ToolBtn>

      <Sep />

      {/* Table: insert button when not in table; controls when inside a table */}
      {!inTable ? (
        <ToolBtn
          title="Insert table (3×3)"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolBtn>
      ) : (
        <>
          <ToolBtn title="Add row below"    onClick={() => editor.chain().focus().addRowAfter().run()}>
            <span className="flex items-center gap-0.5 text-[10px] font-medium leading-none">
              <Plus className="h-3 w-3" />row
            </span>
          </ToolBtn>
          <ToolBtn title="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <span className="flex items-center gap-0.5 text-[10px] font-medium leading-none">
              <Plus className="h-3 w-3" />col
            </span>
          </ToolBtn>
          <ToolBtn title="Delete row"       onClick={() => editor.chain().focus().deleteRow().run()}>
            <span className="flex items-center gap-0.5 text-[10px] font-medium leading-none">
              <Minus className="h-3 w-3" />row
            </span>
          </ToolBtn>
          <ToolBtn title="Delete column"    onClick={() => editor.chain().focus().deleteColumn().run()}>
            <span className="flex items-center gap-0.5 text-[10px] font-medium leading-none">
              <Minus className="h-3 w-3" />col
            </span>
          </ToolBtn>
          <ToolBtn title="Delete table" danger onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 className="h-3.5 w-3.5" />
          </ToolBtn>
        </>
      )}
    </div>
  )
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────

interface EditorProps {
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  minRows?: number
  autoFocus?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Add text…',
  className,
  minRows = 3,
  autoFocus = false,
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    onBlur: () => onBlur?.(),
  })

  // Sync external value changes (e.g. cancel/reset)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const normalised = current === '<p></p>' ? '' : current
    if (value !== normalised) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div
      className={cn(
        'border border-input rounded-md overflow-hidden bg-background focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="rich-editor"
        style={{ minHeight: `${minRows * 1.75}rem` }}
      />
    </div>
  )
}

// ─── RichTextDisplay ──────────────────────────────────────────────────────────

interface DisplayProps {
  html: string
  className?: string
  emptyText?: string
}

export function RichTextDisplay({ html, className, emptyText = 'Nothing here yet.' }: DisplayProps) {
  if (!html || html === '<p></p>') {
    return <p className={cn('text-sm text-muted-foreground italic', className)}>{emptyText}</p>
  }

  // Open links in new tab on click
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'A') {
      e.preventDefault()
      const href = (target as HTMLAnchorElement).href
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className={cn('rich-display text-sm break-words overflow-hidden', className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  )
}
