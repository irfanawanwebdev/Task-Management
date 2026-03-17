import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthContext'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/features/auth/LoginPage'

// ── Lazy page imports ──────────────────────────────────────────────────────────
const PMDashboard          = lazy(() => import('@/features/dashboard/PMDashboard'))
const OwnerDashboard       = lazy(() => import('@/features/dashboard/OwnerDashboard'))
const SpecialistDashboard  = lazy(() => import('@/features/specialist/SpecialistDashboard'))
const TasksPage            = lazy(() => import('@/features/tasks/TasksPage'))
const ClientsPage          = lazy(() => import('@/features/clients/ClientsPage'))
const ClientDetailPage     = lazy(() => import('@/features/clients/ClientDetailPage'))
const RACIPage             = lazy(() => import('@/features/raci/RACIPage'))
const AdminPage            = lazy(() => import('@/features/admin/AdminPage'))
const BlockersPage         = lazy(() => import('@/features/blockers/BlockersPage'))
const MeetingsPage         = lazy(() => import('@/features/meetings/MeetingsPage'))
const WorkloadPage         = lazy(() => import('@/features/workload/WorkloadPage'))
const InstructionsPage     = lazy(() => import('@/features/instructions/InstructionsPage'))
const SOPPage              = lazy(() => import('@/features/instructions/SOPPage'))
const SocialPage           = lazy(() => import('@/features/instructions/SocialPage'))
const ReportsChecklistPage = lazy(() => import('@/features/instructions/ReportsChecklistPage'))
const ClientsDirectoryPage = lazy(() => import('@/features/instructions/ClientsDirectoryPage'))
const ClientSOPPage        = lazy(() => import('@/features/instructions/ClientSOPPage'))
const SettingsPage         = lazy(() => import('@/features/settings/SettingsPage'))

// ── Suspense fallback ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
)

const NotFound = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div className="text-center space-y-2">
      <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
    </div>
  </div>
)

// ── Data router (required for useBlocker / navigation guards) ─────────────────
const router = createBrowserRouter(
  [
    // Public
    { path: '/login', element: <LoginPage /> },

    // Protected — inside AppLayout
    {
      element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
      children: [
        {
          path: '/',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><PMDashboard /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/owner',
          element: (
            <ProtectedRoute allowedRoles={['owner']}>
              <Suspense fallback={<PageLoader />}><OwnerDashboard /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/specialist',
          element: <Suspense fallback={<PageLoader />}><SpecialistDashboard /></Suspense>,
        },
        {
          path: '/tasks',
          element: <Suspense fallback={<PageLoader />}><TasksPage /></Suspense>,
        },
        {
          path: '/clients',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/clients/:clientId',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><ClientDetailPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/raci',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><RACIPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/blockers',
          element: <Suspense fallback={<PageLoader />}><BlockersPage /></Suspense>,
        },
        {
          path: '/meetings',
          element: <Suspense fallback={<PageLoader />}><MeetingsPage /></Suspense>,
        },
        {
          path: '/workload',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><WorkloadPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/instructions',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><InstructionsPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/instructions/sops',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><SOPPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/instructions/social',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><SocialPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/instructions/reports',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><ReportsChecklistPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/instructions/clients',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><ClientsDirectoryPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/instructions/clients/:clientId',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><ClientSOPPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/admin',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><AdminPage /></Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '/settings',
          element: (
            <ProtectedRoute allowedRoles={['project_manager', 'owner']}>
              <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>
            </ProtectedRoute>
          ),
        },
      ],
    },

    // 404
    { path: '*', element: <NotFound /> },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
