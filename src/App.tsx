import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/features/auth/LoginPage'
import { getDefaultRoute } from '@/lib/permissions'

// ── Lazy page imports ──────────────────────────────────────────────────────────
const PMDashboard        = lazy(() => import('@/features/dashboard/PMDashboard'))
const OwnerDashboard     = lazy(() => import('@/features/dashboard/OwnerDashboard'))
const SpecialistDashboard= lazy(() => import('@/features/specialist/SpecialistDashboard'))
const TasksPage          = lazy(() => import('@/features/tasks/TasksPage'))
const ClientsPage        = lazy(() => import('@/features/clients/ClientsPage'))
const ClientDetailPage   = lazy(() => import('@/features/clients/ClientDetailPage'))
const RACIPage           = lazy(() => import('@/features/raci/RACIPage'))
const AdminPage          = lazy(() => import('@/features/admin/AdminPage'))

// Phase 3–4 placeholders (to be built)
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <h1 className="text-xl font-semibold text-muted-foreground">{title}</h1>
    <p className="text-sm text-muted-foreground/60">Coming in the next phase</p>
  </div>
)

// ── Suspense fallback ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function RootRedirect() {
  const { role } = useAuth()
  if (!role) return <Navigate to="/login" replace />
  return <Navigate to={getDefaultRoute(role)} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected — inside AppLayout */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<RootRedirect />} />

              {/* PM Dashboard */}
              <Route path="/"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <Suspense fallback={<PageLoader />}>
                      <PMDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Owner Dashboard */}
              <Route path="/owner"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <Suspense fallback={<PageLoader />}>
                      <OwnerDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Specialist Dashboard */}
              <Route path="/specialist"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <SpecialistDashboard />
                  </Suspense>
                }
              />

              {/* Tasks */}
              <Route path="/tasks"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <TasksPage />
                  </Suspense>
                }
              />

              {/* Clients */}
              <Route path="/clients"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <Suspense fallback={<PageLoader />}>
                      <ClientsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/clients/:clientId"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <Suspense fallback={<PageLoader />}>
                      <ClientDetailPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* RACI Matrix */}
              <Route path="/raci"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <Suspense fallback={<PageLoader />}>
                      <RACIPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Blockers — Phase 3 */}
              <Route path="/blockers"
                element={<PlaceholderPage title="Blockers — Phase 3" />}
              />

              {/* Meetings & Reports — Phase 3 */}
              <Route path="/meetings"
                element={<PlaceholderPage title="Meetings & Reports — Phase 3" />}
              />

              {/* Team Workload — Phase 3 */}
              <Route path="/workload"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <PlaceholderPage title="Team Workload — Phase 3" />
                  </ProtectedRoute>
                }
              />

              {/* Internal Workspace — Phase 4 */}
              <Route path="/instructions"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <PlaceholderPage title="Internal Workspace — Phase 4" />
                  </ProtectedRoute>
                }
              />
              <Route path="/instructions/*"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <PlaceholderPage title="Internal Workspace — Phase 4" />
                  </ProtectedRoute>
                }
              />

              {/* User Management */}
              <Route path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <Suspense fallback={<PageLoader />}>
                      <AdminPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Settings — Phase 4 */}
              <Route path="/settings"
                element={
                  <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
                    <PlaceholderPage title="Settings & Connectors — Phase 4" />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* 404 */}
            <Route path="*" element={
              <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center space-y-2">
                  <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
                  <p className="text-muted-foreground">Page not found.</p>
                </div>
              </div>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
