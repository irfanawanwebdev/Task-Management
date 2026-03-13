/**
 * AuthContext — JZ Operations Hub
 * Provides current user, session, profile, role, and auth actions.
 * Wraps the entire app; all role-gating reads from this context.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
  }, [])

  const refreshProfile = useCallback(async () => {
    if (state.user) await loadProfile(state.user.id)
  }, [state.user, loadProfile])

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({ ...prev, session, user: session.user }))
        loadProfile(session.user.id)
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState(prev => ({ ...prev, session, user: session.user, isLoading: true }))
        loadProfile(session.user.id)
      } else {
        setState({
          user: null, session: null, profile: null,
          role: null, roles: [], isLoading: false, isAuthenticated: false,
        })
      }
    })

    return () => subscription.unsubscribe()
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
