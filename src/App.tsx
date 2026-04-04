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
const MyTasksPage          = lazy(() => import('@/features/mytasks/MyTasksPage'))
const ClaudePage           = lazy(() => import('@/features/ai/ClaudePage'))
const OpportunitiesPage    = lazy(() => import('@/features/opportunities/OpportunitiesPage'))
const PrivacyPolicyPage    = lazy(() => import('@/features/public/PrivacyPolicyPage'))
const TermsPage            = lazy(() => import('@/features/public/TermsPage'))
const SupportPage          = lazy(() => import('@/features/public/SupportPage'))
const DocsPage             = lazy(() => import('@/features/public/DocsPage'))

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
    // Public (no login required)
    { path: '/login',          element: <LoginPage /> },
    { path: '/privacy-policy', element: <Suspense fallback={<PageLoader />}><PrivacyPolicyPage /></Suspense> },
    { path: '/terms',          element: <Suspense fallback={<PageLoader />}><TermsPage /></Suspense> },
    { path: '/support',        element: <Suspense fallback={<PageLoader />}><SupportPage /></Suspense> },
    { path: '/docs',           element: <Suspense fallback={<PageLoader />}><DocsPage /></Suspense> },

    // Protected — inside AppLayout
    {
      element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
      children: [
        {
          path: '/',
          element: <Suspense fallback={<PageLoader />}><PMDashboard /></Suspense>,
        },
        {
          path: '/owner',
          element: <Suspense fallback={<PageLoader />}><OwnerDashboard /></Suspense>,
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
          element: <Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>,
        },
        {
          path: '/clients/:clientId',
          element: <Suspense fallback={<PageLoader />}><ClientDetailPage /></Suspense>,
        },
        {
          path: '/raci',
          element: <Suspense fallback={<PageLoader />}><RACIPage /></Suspense>,
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
          element: <Suspense fallback={<PageLoader />}><WorkloadPage /></Suspense>,
        },
        {
          path: '/instructions',
          element: <Suspense fallback={<PageLoader />}><InstructionsPage /></Suspense>,
        },
        {
          path: '/instructions/sops',
          element: <Suspense fallback={<PageLoader />}><SOPPage /></Suspense>,
        },
        {
          path: '/instructions/social',
          element: <Suspense fallback={<PageLoader />}><SocialPage /></Suspense>,
        },
        {
          path: '/instructions/reports',
          element: <Suspense fallback={<PageLoader />}><ReportsChecklistPage /></Suspense>,
        },
        {
          path: '/instructions/clients',
          element: <Suspense fallback={<PageLoader />}><ClientsDirectoryPage /></Suspense>,
        },
        {
          path: '/instructions/clients/:clientId',
          element: <Suspense fallback={<PageLoader />}><ClientSOPPage /></Suspense>,
        },
        {
          path: '/admin',
          element: <Suspense fallback={<PageLoader />}><AdminPage /></Suspense>,
        },
        {
          path: '/settings',
          element: <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>,
        },
        {
          path: '/my-tasks',
          element: <Suspense fallback={<PageLoader />}><MyTasksPage /></Suspense>,
        },
        {
          path: '/claude',
          element: <Suspense fallback={<PageLoader />}><ClaudePage /></Suspense>,
        },
        {
          path: '/opportunities',
          element: <Suspense fallback={<PageLoader />}><OpportunitiesPage /></Suspense>,
        },
      ],
    },

    // 404
    { path: '*', element: <NotFound /> },
  ],
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    future: { v7_relativeSplatPath: true, v7_startTransition: true } as any,
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
