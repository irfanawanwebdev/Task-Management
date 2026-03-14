import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 min-h-full">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
