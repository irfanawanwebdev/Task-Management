import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from './AuthContext'
import { getDefaultRoute } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const MAX_ATTEMPTS  = 5   // lock after this many consecutive failures
const LOCKOUT_SECS  = 60  // seconds to lock the form

export default function LoginPage() {
  const { signIn, role, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]               = useState<'login' | 'forgot'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Login form
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent]   = useState(false)

  // Brute-force protection (client-side soft lockout)
  const [attempts, setAttempts]       = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [countdown, setCountdown]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown ticker while locked
  useEffect(() => {
    if (!lockedUntil) return
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setAttempts(0)
        setCountdown(0)
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        setCountdown(remaining)
      }
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [lockedUntil])

  // Navigate once auth state resolves after sign-in
  useEffect(() => {
    if (isAuthenticated && role) {
      navigate(getDefaultRoute(role), { replace: true })
    }
  }, [isAuthenticated, role, navigate])

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    setError(null)
    setIsLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      const next = attempts + 1
      setAttempts(next)
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_SECS * 1000
        setLockedUntil(until)
        setCountdown(LOCKOUT_SECS)
        setError(`Too many failed attempts. Please wait ${LOCKOUT_SECS} seconds.`)
      } else {
        // Generic message — does not reveal whether email or password is wrong
        setError(`Invalid email or password. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining.`)
      }
      setIsLoading(false)
      return
    }
    // Reset on success
    setAttempts(0)
    // Navigation handled by the useEffect above once role loads
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setIsLoading(false)
    if (error) { setError(error.message); return }
    setForgotSent(true)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">JZ</span>
            </div>
            <span className="font-semibold text-lg">Smart Media</span>
          </div>
          <h1 className="text-2xl font-bold">Operations Hub</h1>
          <p className="text-muted-foreground text-sm">
            {mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === 'forgot' ? (
            forgotSent ? (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  A password reset link was sent to{' '}
                  <span className="font-medium text-foreground">{forgotEmail}</span>.
                  Follow the link in the email to set a new password.
                </p>
                <button
                  onClick={() => { setMode('login'); setForgotSent(false); setForgotEmail('') }}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your account email and we'll send you a password reset link.
                </p>
                <div className="space-y-2">
                  <label htmlFor="forgot-email" className="text-sm font-medium">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="you@jzsmartmedia.com"
                    required
                    className={cn(
                      'w-full px-3 py-2 bg-background border border-input rounded-md text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-ring',
                      'placeholder:text-muted-foreground'
                    )}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full py-2 px-4 bg-primary text-primary-foreground rounded-md',
                    'text-sm font-medium transition-opacity hover:opacity-90',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send Reset Link
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@jzsmartmedia.com"
                  required
                  autoComplete="email"
                  disabled={isLocked}
                  className={cn(
                    'w-full px-3 py-2 bg-background border border-input rounded-md text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
                    'placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setForgotEmail(email); setError(null) }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isLocked}
                    className={cn(
                      'w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-ring',
                      'placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Lockout countdown bar */}
              {isLocked && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive text-center">
                  Account temporarily locked. Try again in {countdown}s.
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || isLocked}
                className={cn(
                  'w-full py-2 px-4 bg-primary text-primary-foreground rounded-md',
                  'text-sm font-medium transition-opacity hover:opacity-90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </button>
            </form>
          )}

        </div>

        <p className="text-center text-xs text-muted-foreground">
          JZ Smart Media — Internal Operations Platform
        </p>
      </div>
    </div>
  )
}
