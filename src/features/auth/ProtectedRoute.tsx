import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { AppRole } from '@/lib/types'
import { canAccessRoute } from '@/lib/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: AppRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role, profile } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile && !profile.is_active) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">Account Deactivated</h1>
          <p className="text-muted-foreground text-sm">
            Your account has been deactivated. Contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  if (role && !canAccessRoute(role, location.pathname)) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
