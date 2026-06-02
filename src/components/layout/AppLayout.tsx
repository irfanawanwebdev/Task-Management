import { Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAuth } from '@/features/auth/AuthContext'
import { NotificationBell } from '@/components/NotificationBell'
import { Toaster } from '@/components/Toaster'
import { AIChat } from '@/features/ai/AIChat'
import { LogOut, Menu } from 'lucide-react'
import { useSessionTracker } from '@/hooks/useSessionTracker'

// ─── Miami Time Clock ──────────────────────────────────────────────────────

function getMiamiDateTime(): { date: string; time: string } {
  const now = new Date()
  const date = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const time = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return { date, time }
}

function MiamiClock() {
  const [dt, setDt] = useState(getMiamiDateTime)
  useEffect(() => {
    const id = setInterval(() => setDt(getMiamiDateTime()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
      <span className="text-muted-foreground hidden sm:inline">{dt.date}</span>
      <span className="text-muted-foreground/40 hidden sm:inline">·</span>
      {dt.time}
      <span className="text-xs text-muted-foreground/60 ml-0.5 hidden sm:inline">Miami</span>
    </span>
  )
}

// ─── Top Header ───────────────────────────────────────────────────────────

function TopHeader({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-card shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onOpenMobile}
        className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop left spacer */}
      <div className="hidden md:block" />

      {/* Center: Miami clock */}
      <MiamiClock />

      {/* Right: user + bell + sign out */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:block">
          {profile?.full_name ?? ''}
        </span>
        <NotificationBell />
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs
                     text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}

// ─── App Layout ───────────────────────────────────────────────────────────

export default function AppLayout() {
  const { profile } = useAuth()
  useSessionTracker(profile?.user_id)

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapse = () => {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v))
      return !v
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={toggleCollapse}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopHeader onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 min-h-full">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <AIChat />
      <Toaster />
    </div>
  )
}
