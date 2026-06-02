import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CheckSquare, Calendar, Clock,
  AlertTriangle, BarChart2, BookOpen, UserCog, Settings,
  TrendingUp, LogOut, ChevronRight, ListTodo, Bot, Target,
  HelpCircle, Download, StickyNote, PanelLeftClose, PanelLeftOpen, X,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { getNavForProfile } from '@/lib/permissions'
import { NotificationBell } from '@/components/NotificationBell'
import { RoleDocsModal } from '@/components/RoleDocsModal'
import { UserGuideModal } from '@/components/UserGuideModal'
import { downloadSOPDoc } from '@/lib/generateSOPDoc'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, CheckSquare, Calendar, Clock,
  AlertTriangle, BarChart2, BookOpen, UserCog, Settings, TrendingUp, ListTodo, Bot, Target, StickyNote,
}

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}

// ─── Shared sidebar content ───────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onClose,
  isMobile = false,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  onClose?: () => void
  isMobile?: boolean
}) {
  const { role, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [docsOpen, setDocsOpen]   = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const navItems = getNavForProfile(profile ?? null, role)
  const isCollapsed = !isMobile && collapsed

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={cn(
        'flex items-center border-b border-border shrink-0',
        isCollapsed ? 'justify-center px-0 py-4' : 'gap-3 px-4 py-4'
      )}>
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-primary font-bold text-sm">JZ</span>
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">Operations Hub</p>
            <p className="text-xs text-muted-foreground truncate">JZ Smart Media</p>
          </div>
        )}
        {/* Mobile close button */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = ICON_MAP[item.icon] ?? ChevronRight
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                'flex items-center rounded-md text-sm transition-colors',
                isCollapsed
                  ? 'justify-center p-2.5'
                  : 'gap-2.5 px-3 py-2',
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div className={cn(
          'px-2 pb-2',
          isCollapsed ? 'flex justify-center' : ''
        )}>
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
              isCollapsed ? 'p-2.5' : 'gap-2 px-3 py-2 w-full'
            )}
          >
            {isCollapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>
            }
          </button>
        </div>
      )}

      {/* User footer */}
      <div className={cn(
        'border-t border-border shrink-0',
        isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3 space-y-2'
      )}>
        {isCollapsed ? (
          // Collapsed footer: just avatar + notification + sign out stacked
          <>
            <div
              title={profile?.full_name ?? 'User'}
              className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <span className="text-primary text-xs font-semibold">{initials}</span>
            </div>
            <NotificationBell placement="right" />
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          // Expanded footer: avatar row + action buttons
          <>
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary text-xs font-semibold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">
                  {role?.replace('_', ' ') ?? 'Viewer'}
                </p>
              </div>
              <NotificationBell placement="right" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-xs
                           text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
              <button
                onClick={() => setGuideOpen(true)}
                title="User Guide"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={downloadSOPDoc}
                title="Download SOP"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDocsOpen(true)}
                title="Roles & Permissions"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      <RoleDocsModal open={docsOpen} onClose={() => setDocsOpen(false)} />
      <UserGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}

// ─── Sidebar wrapper ──────────────────────────────────────────────────────

export default function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const location = useLocation()

  // Close mobile drawer on route change
  useEffect(() => {
    onCloseMobile()
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-full bg-card border-r border-border shrink-0',
          'transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      {/* ── Mobile backdrop ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r border-border shadow-2xl',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent
          collapsed={false}
          onToggleCollapse={onToggleCollapse}
          onClose={onCloseMobile}
          isMobile
        />
      </aside>
    </>
  )
}
