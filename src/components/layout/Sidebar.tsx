import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CheckSquare, Grid3X3, Calendar,
  AlertTriangle, BarChart2, BookOpen, UserCog, Settings,
  TrendingUp, LogOut, ChevronRight, ListTodo, Bot, Target, HelpCircle,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { getNavForProfile } from '@/lib/permissions'
import { NotificationBell } from '@/components/NotificationBell'
import { RoleDocsModal } from '@/components/RoleDocsModal'
import { UserGuideModal } from '@/components/UserGuideModal'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, CheckSquare, Grid: Grid3X3, Calendar,
  AlertTriangle, BarChart2, BookOpen, UserCog, Settings, TrendingUp, ListTodo, Bot, Target,
}

export default function Sidebar() {
  const { role, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [docsOpen, setDocsOpen]  = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const navItems = getNavForProfile(profile ?? null, role)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex flex-col h-full w-60 bg-card border-r border-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-primary font-bold text-sm">JZ</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Operations Hub</p>
          <p className="text-xs text-muted-foreground truncate">JZ Smart Media</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(item => {
          const Icon = ICON_MAP[item.icon] ?? ChevronRight
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-semibold">
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </span>
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
            title="User Guide — how to use the system"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDocsOpen(true)}
            title="Roles & Permissions Docs"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <RoleDocsModal open={docsOpen} onClose={() => setDocsOpen(false)} />
      <UserGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </aside>
  )
}
