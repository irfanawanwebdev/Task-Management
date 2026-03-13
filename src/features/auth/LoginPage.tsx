import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from './AuthContext'
import { getDefaultRoute } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const { signIn, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<'login' | 'setup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Setup form
  const [setupName, setSetupName] = useState('')
  const [setupEmail, setSetupEmail] = useState('')
  const [setupPassword, setSetupPassword] = useState('')

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setIsLoading(false)
      return
    }

    const dest = role ? getDefaultRoute(role) : from
    navigate(dest, { replace: true })
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Step 1: Create the user
      const { data, error: signupErr } = await supabase.auth.signUp({
        email: setupEmail,
        password: setupPassword,
        options: { emailRedirectTo: undefined },
      })
      if (signupErr || !data.user) throw new Error(signupErr?.message ?? 'Signup failed')

      // Step 2: Call setup_first_admin RPC (only works when no roles exist)
      const rpcResult = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(
        'setup_first_admin',
        { _user_id: data.user.id, _name: setupName }
      )
      if (rpcResult.error) throw new Error(rpcResult.error.message)

      // Step 3: Sign in
      const { error: loginErr } = await signIn(setupEmail, setupPassword)
      if (loginErr) throw new Error(loginErr)

      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
      setIsLoading(false)
    }
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
            {mode === 'login' ? 'Sign in to your account' : 'Create the first admin account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === 'login' ? (
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
                  className={cn(
                    "w-full px-3 py-2 bg-background border border-input rounded-md text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
                    "placeholder:text-muted-foreground"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={cn(
                      "w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-ring",
                      "placeholder:text-muted-foreground"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full py-2 px-4 bg-primary text-primary-foreground rounded-md",
                  "text-sm font-medium transition-opacity hover:opacity-90",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                <input
                  id="name"
                  type="text"
                  value={setupName}
                  onChange={e => setSetupName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className={cn(
                    "w-full px-3 py-2 bg-background border border-input rounded-md text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    "placeholder:text-muted-foreground"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-email" className="text-sm font-medium">Email</label>
                <input
                  id="setup-email"
                  type="email"
                  value={setupEmail}
                  onChange={e => setSetupEmail(e.target.value)}
                  placeholder="you@jzsmartmedia.com"
                  required
                  className={cn(
                    "w-full px-3 py-2 bg-background border border-input rounded-md text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    "placeholder:text-muted-foreground"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <input
                    id="setup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={setupPassword}
                    onChange={e => setSetupPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    className={cn(
                      "w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-ring",
                      "placeholder:text-muted-foreground"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full py-2 px-4 bg-primary text-primary-foreground rounded-md",
                  "text-sm font-medium transition-opacity hover:opacity-90",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Admin Account
              </button>
            </form>
          )}

          <div className="text-center">
            {mode === 'login' ? (
              <button
                onClick={() => { setMode('setup'); setError(null) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                First time? Set up admin account
              </button>
            ) : (
              <button
                onClick={() => { setMode('login'); setError(null) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          JZ Smart Media — Internal Operations Platform
        </p>
      </div>
    </div>
  )
}
