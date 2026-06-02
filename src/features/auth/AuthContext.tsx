/**
 * AuthContext — JZ Operations Hub
 * Provides current user, session, profile, role, and auth actions.
 * Wraps the entire app; all role-gating reads from this context.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AppRole, Profile } from '@/lib/types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: AppRole | null
  roles: AppRole[]
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

type AuthContextValue = AuthState & AuthActions

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function pingLastSeen(userId: string) {
  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() } as never)
    .eq('user_id', userId)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    roles: [],
    isLoading: true,
    isAuthenticated: false,
  })

  const loadProfile = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])

    const profile = profileRes.data as Profile | null
    const roles = (rolesRes.data ?? []).map(r => (r as { role: string }).role as AppRole)

    // Primary role: owner first, then project_manager, then others
    const primaryRole = roles.includes('owner')
      ? 'owner'
      : roles.includes('project_manager')
        ? 'project_manager'
        : roles[0] ?? null

    setState(prev => ({
      ...prev,
      profile,
      role: primaryRole,
      roles,
      isLoading: false,
      isAuthenticated: true,
    }))

    // Ping last_seen_at on load, then every 2 minutes
    await pingLastSeen(userId)
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => pingLastSeen(userId), 2 * 60 * 1000)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (state.user) await loadProfile(state.user.id)
  }, [state.user, loadProfile])

  useEffect(() => {
    // Use onAuthStateChange exclusively (no separate getSession call).
    // INITIAL_SESSION fires on mount with the stored session (or null) — replaces getSession().
    // PASSWORD_RECOVERY fires when a recovery link is opened; we must NOT call loadProfile
    // in that case, otherwise isAuthenticated becomes true and the user is auto-navigated
    // away from the reset-password form before they can set a new password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // PASSWORD_RECOVERY fires on already-open tabs (broadcasted via localStorage).
      // INITIAL_SESSION fires on the tab that opened the recovery link — by then
      // createClient has already cleared the hash, so we rely on the sessionStorage
      // flag set in supabase.ts before createClient ran.
      const recoveryPending = sessionStorage.getItem('sb_recovery_pending') === '1'

      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && recoveryPending)) {
        sessionStorage.removeItem('sb_recovery_pending')
        // Store session so supabase.auth.updateUser() works, but do not authenticate.
        setState(prev => ({ ...prev, session, user: session?.user ?? null, isLoading: false }))
        return
      }

      if (session?.user) {
        setState(prev => ({ ...prev, session, user: session.user }))
        loadProfile(session.user.id)
      } else {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        setState({
          user: null, session: null, profile: null,
          role: null, roles: [], isLoading: false, isAuthenticated: false,
        })
      }
    })

    return () => {
      subscription.unsubscribe()
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
