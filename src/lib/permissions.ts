/**
 * RBAC Permissions — JZ Operations Hub
 * Single source of truth for role → route → capability mapping.
 */

import type { AppRole } from './types'

// ─── Route Access ─────────────────────────────────────────────────────────

/** Returns true if the given role can access the given route path */
export function canAccessRoute(role: AppRole, path: string): boolean {
  const pmOwner: AppRole[] = ['project_manager', 'owner']
  const allAuth: AppRole[] = [
    'owner', 'project_manager', 'web_developer', 'seo',
    'ads_manager', 'social_media', 'account_manager', 'viewer',
  ]

  const routeMap: Record<string, AppRole[]> = {
    '/':              pmOwner,
    '/owner':         ['owner'],
    '/specialist':    allAuth,
    '/tasks':         allAuth,
    '/clients':       pmOwner,
    '/raci':          pmOwner,
    '/blockers':      allAuth,
    '/meetings':      allAuth,
    '/workload':      pmOwner,
    '/instructions':  pmOwner,
    '/admin':         pmOwner,
    '/settings':      pmOwner,
  }

  // Match exact or prefix (e.g. /clients/abc)
  for (const [route, roles] of Object.entries(routeMap)) {
    if (path === route || path.startsWith(route + '/')) {
      return roles.includes(role)
    }
  }
  return false
}

/** Returns the default redirect path for a given role after login */
export function getDefaultRoute(role: AppRole): string {
  if (role === 'owner') return '/owner'
  if (role === 'project_manager') return '/'
  return '/specialist'
}

// ─── Capability Checks ────────────────────────────────────────────────────

export const isOwner = (role: AppRole) => role === 'owner'
export const isPM    = (role: AppRole) => role === 'project_manager'
export const isPMOrOwner = (role: AppRole) => isPM(role) || isOwner(role)
export const isSpecialist = (role: AppRole) =>
  ['web_developer', 'seo', 'ads_manager', 'social_media', 'account_manager'].includes(role)

export const canCreateTasks   = isPMOrOwner
export const canCreateClients = isPMOrOwner
export const canManageUsers   = isPMOrOwner
export const canGenerateReports = isPMOrOwner
export const canResolveBlockers = isPMOrOwner

// ─── Nav Items per Role ───────────────────────────────────────────────────

export interface NavItem {
  label: string
  path: string
  icon: string // lucide icon name
}

export function getNavForRole(role: AppRole): NavItem[] {
  const pmOwnerNav: NavItem[] = [
    { label: 'PM Dashboard',        path: '/',            icon: 'LayoutDashboard' },
    { label: 'Clients',             path: '/clients',     icon: 'Users' },
    { label: 'Tasks',               path: '/tasks',       icon: 'CheckSquare' },
    { label: 'RACI Matrix',         path: '/raci',        icon: 'Grid' },
    { label: 'Meetings & Reports',  path: '/meetings',    icon: 'Calendar' },
    { label: 'Blockers',            path: '/blockers',    icon: 'AlertTriangle' },
    { label: 'Team Workload',       path: '/workload',    icon: 'BarChart2' },
    { label: 'Internal Workspace',  path: '/instructions',icon: 'BookOpen' },
    { label: 'User Management',     path: '/admin',       icon: 'UserCog' },
    { label: 'Settings',            path: '/settings',    icon: 'Settings' },
  ]

  const specialistNav: NavItem[] = [
    { label: 'My Dashboard', path: '/specialist', icon: 'LayoutDashboard' },
    { label: 'My Tasks',     path: '/tasks',      icon: 'CheckSquare' },
    { label: 'Meetings',     path: '/meetings',   icon: 'Calendar' },
    { label: 'Blockers',     path: '/blockers',   icon: 'AlertTriangle' },
  ]

  if (role === 'owner') {
    return [
      { label: 'Executive Dashboard', path: '/owner', icon: 'TrendingUp' },
      ...pmOwnerNav,
    ]
  }
  if (role === 'project_manager') return pmOwnerNav
  return specialistNav
}
