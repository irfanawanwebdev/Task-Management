// Lightweight module-level toast — no context needed, works from any component.

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

type Listener = (toasts: ToastItem[]) => void

let _toasts: ToastItem[] = []
const _listeners: Listener[] = []

function _emit() {
  _listeners.forEach(fn => fn([..._toasts]))
}

function _show(message: string, type: ToastType, duration: number) {
  const id = Math.random().toString(36).slice(2, 9)
  _toasts = [..._toasts, { id, message, type }]
  _emit()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    _emit()
  }, duration)
}

export const toast = {
  success: (message: string, duration = 3500) => _show(message, 'success', duration),
  error:   (message: string, duration = 5000) => _show(message, 'error',   duration),
  info:    (message: string, duration = 3500) => _show(message, 'info',    duration),

  /** Subscribe to toast list updates. Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    _listeners.push(fn)
    fn([..._toasts])
    return () => {
      const i = _listeners.indexOf(fn)
      if (i > -1) _listeners.splice(i, 1)
    }
  },
}
