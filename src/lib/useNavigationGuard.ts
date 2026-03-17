/**
 * useNavigationGuard — blocks React Router navigation when isDirty is true.
 * Shows a native confirm() prompt before allowing the user to leave.
 * Also blocks browser tab close / hard reload via beforeunload.
 */

import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export function useNavigationGuard(isDirty: boolean) {
  // Block in-app navigation (sidebar clicks, back button, etc.)
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved changes. Leave without saving?')) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

  // Block browser tab close / page reload
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
