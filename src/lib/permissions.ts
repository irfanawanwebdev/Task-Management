/**
 * RBAC + Per-User Page Access Permissions — JZ Operations Hub
 * Single source of truth for role → route → capability mapping.
 * Supports both legacy role-based access AND per-user manual page_access (§4–5, §7).
 */

import type { AppRole, Profile } from './types'

// ─── Page Key Constants ────────────────────────────────────────────────────

/** All configurable page keys (matches profiles.page_access values) */
export const PAGE_KEYS = {
  OWNER_DASHBOARD: 'owner_dashboard',
  PM_DASHBOARD:    'pm_dashboard',
  CLIENTS:         'clients',
  TASKS:           'tasks',
  RACI:            'raci',
  MEETINGS:        'meetings',
  BLOCKERS:        'blockers',
  WORKLOAD:        'workload',
  INSTRUCTIONS:    'instructions',
  ADMIN:           'admin',
  SETTINGS:        'settings',
} as const

/** Maps route paths → page key (for access checks) */
const ROUTE_TO_PAGE_KEY: Record<string, string> = {
  '/owner':        PAGE_KEYS.OWNER_DASHBOARD,
  '/':             PAGE_KEYS.PM_DASHBOARD,
  '/clients':      PAGE_KEYS.CLIENTS,
  '/tasks':        PAGE_KEYS.TASKS,
  '/raci':         PAGE_KEYS.RACI,
  '/meetings':     PAGE_KEYS.MEETINGS,
  '/blockers':     PAGE_KEYS.BLOCKERS,
  '/workload':     PAGE_KEYS.WORKLOAD,
  '/instructions': PAGE_KEYS.INSTRUCTIONS,
  '/admin':        PAGE_KEYS.ADMIN,
  '/settings':     PAGE_KEYS.SETTINGS,
}

// ─── All Nav Items (full catalogue) ───────────────────────────────────────

export interface NavItem {
  label: string
  path: string
  icon: string
  pageKey: string
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Executive Dashboard', path: '/owner',        icon: 'TrendingUp',     pageKey: PAGE_KEYS.OWNER_DASHBOARD },
  { label: 'PM Dashboard',        path: '/',             icon: 'LayoutDashboard',pageKey: PAGE_KEYS.PM_DASHBOARD },
  { label: 'Clients',             path: '/clients',      icon: 'Users',          pageKey: PAGE_KEYS.CLIENTS },
  { label: 'Tasks',               path: '/tasks',        icon: 'CheckSquare',    pageKey: PAGE_KEYS.TASKS },
  { label: 'RACI Matrix',         path: '/raci',         icon: 'Grid',           pageKey: PAGE_KEYS.RACI },
  { label: 'Meetings & Reports',  path: '/meetings',     icon: 'Calendar',       pageKey: PAGE_KEYS.MEETINGS },
  { label: 'Blockers',            path: '/blockers',     icon: 'AlertTriangle',  pageKey: PAGE_KEYS.BLOCKERS },
  { label: 'Team Workload',       path: '/workload',     icon: 'BarChart2',      pageKey: PAGE_KEYS.WORKLOAD },
  { label: 'Internal Workspace',  path: '/instructions', icon: 'BookOpen',       pageKey: PAGE_KEYS.INSTRUCTIONS },
  { label: 'User Management',     path: '/admin',        icon: 'UserCog',        pageKey: PAGE_KEYS.ADMIN },
  { label: 'Settings',            path: '/settings',     icon: 'Settings',       pageKey: PAGE_KEYS.SETTINGS },
]

// ─── Per-User Page Access ──────────────────────────────────────────────────

/**
 * Returns true if the user can access the given route path.
 * If profile.page_access is non-empty, uses that list.
 * Falls back to role-based access if page_access is empty.
 * /specialist is always accessible to all authenticated users.
 */
export function hasPageAccess(
  profile: Profile | null,
  role: AppRole | null,
  path: string,
): boolean {
  // Specialist dashboard is always accessible
  if (path === '/specialist' || path.startsWith('/specialist/')) return true

  const pageAccess = profile?.page_access ?? []
  if (profile && pageAccess.length > 0) {
    const pageKey = getPageKeyForPath(path)
    if (!pageKey) return true // unknown path — allow through
    return pageAccess.includes(pageKey)
  }

  // Fallback: role-based
  if (role) return canAccessRoute(role, path)
  return false
}

/** Returns the page key for a given path (handles sub-routes like /clients/abc) */
function getPageKeyForPath(path: string): string | null {
  for (const [route, key] of Object.entries(ROUTE_TO_PAGE_KEY)) {
    if (path === route || (route !== '/' && path.startsWith(route + '/'))) {
      return key
    }
  }
  return null
}

/**
 * Returns nav items for the sidebar based on the user's profile page_access.
 * If page_access is empty, falls back to role-based nav.
 */
export function getNavForProfile(profile: Profile | null, role: AppRole | null): NavItem[] {
  const pageAccess = profile?.page_access ?? []
  if (profile && pageAccess.length > 0) {
    return ALL_NAV_ITEMS.filter(item => pageAccess.includes(item.pageKey))
  }
  // Fallback to role-based
  return getNavForRole(role ?? 'viewer')
}

// ─── Legacy Role-Based Access ──────────────────────────────────────────────

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

// ─── Legacy Nav (role-based fallback) ─────────────────────────────────────

export function getNavForRole(role: AppRole): NavItem[] {
  const pmOwnerNav: NavItem[] = [
    { label: 'PM Dashboard',        path: '/',             icon: 'LayoutDashboard', pageKey: PAGE_KEYS.PM_DASHBOARD },
    { label: 'Clients',             path: '/clients',      icon: 'Users',           pageKey: PAGE_KEYS.CLIENTS },
    { label: 'Tasks',               path: '/tasks',        icon: 'CheckSquare',     pageKey: PAGE_KEYS.TASKS },
    { label: 'RACI Matrix',         path: '/raci',         icon: 'Grid',            pageKey: PAGE_KEYS.RACI },
    { label: 'Meetings & Reports',  path: '/meetings',     icon: 'Calendar',        pageKey: PAGE_KEYS.MEETINGS },
    { label: 'Blockers',            path: '/blockers',     icon: 'AlertTriangle',   pageKey: PAGE_KEYS.BLOCKERS },
    { label: 'Team Workload',       path: '/workload',     icon: 'BarChart2',       pageKey: PAGE_KEYS.WORKLOAD },
    { label: 'Internal Workspace',  path: '/instructions', icon: 'BookOpen',        pageKey: PAGE_KEYS.INSTRUCTIONS },
    { label: 'User Management',     path: '/admin',        icon: 'UserCog',         pageKey: PAGE_KEYS.ADMIN },
    { label: 'Settings',            path: '/settings',     icon: 'Settings',        pageKey: PAGE_KEYS.SETTINGS },
  ]

  const specialistNav: NavItem[] = [
    { label: 'My Dashboard', path: '/specialist', icon: 'LayoutDashboard', pageKey: '' },
    { label: 'My Tasks',     path: '/tasks',      icon: 'CheckSquare',     pageKey: PAGE_KEYS.TASKS },
    { label: 'Meetings',     path: '/meetings',   icon: 'Calendar',        pageKey: PAGE_KEYS.MEETINGS },
    { label: 'Blockers',     path: '/blockers',   icon: 'AlertTriangle',   pageKey: PAGE_KEYS.BLOCKERS },
  ]

  if (role === 'owner') {
    return [
      { label: 'Executive Dashboard', path: '/owner', icon: 'TrendingUp', pageKey: PAGE_KEYS.OWNER_DASHBOARD },
      ...pmOwnerNav,
    ]
  }
  if (role === 'project_manager') return pmOwnerNav
  return specialistNav
}
