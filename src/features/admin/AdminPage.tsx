/**
 * Admin / User Management — JZ Operations Hub
 * Allows Owner and PM to manage team members: create users, assign/remove roles,
 * activate/deactivate accounts.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X, Loader2, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppDepartment, AppRole, Profile } from '@/lib/types'
import { ALL_ROLES } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TeamMember extends Profile {
  roles: AppRole[]
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEPT_OPTIONS: { value: AppDepartment; label: string }[] = [
  { value: 'operations',         label: 'Operations' },
  { value: 'web_dev',            label: 'Web Dev' },
  { value: 'seo',                label: 'SEO' },
  { value: 'ads',                label: 'Ads/PPC' },
  { value: 'social',             label: 'Social Media' },
  { value: 'account_management', label: 'Account Management' },
  { value: 'executive',          label: 'Executive' },
]

const ROLE_LABELS: Record<AppRole, string> = {
  owner:           'Owner',
  project_manager: 'Project Manager',
  web_developer:   'Web Developer',
  seo:             'SEO',
  ads_manager:     'Ads Manager',
  social_media:    'Social Media',
  account_manager: 'Account Manager',
  viewer:          'Viewer',
}

// ─── Data Hooks ─────────────────────────────────────────────────────────────

function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at'),
        supabase.from('user_roles').select('*'),
      ])
      if (profilesRes.error) throw profilesRes.error
      if (rolesRes.error) throw rolesRes.error

      type RoleRow = { user_id: string; role: string }
      const rolesData = (rolesRes.data ?? []) as RoleRow[]
      return (profilesRes.data ?? []).map(p => ({
        ...(p as Profile),
        roles: rolesData
          .filter(r => r.user_id === (p as Profile).user_id)
          .map(r => r.role as AppRole),
      }))
    },
  })
}

// ─── Add User Dialog ─────────────────────────────────────────────────────────

interface AddUserDialogProps {
  onClose: () => void
  onSuccess: () => void
}

function AddUserDialog({ onClose, onSuccess }: AddUserDialogProps) {
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [dept, setDept]           = useState<AppDepartment>('operations')
  const [roles, setRoles]         = useState<AppRole[]>(['viewer'])
  const [error, setError]         = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const toggleRole = (r: AppRole) => {
    setRoles(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (roles.length === 0) { setError('Select at least one role'); return }
    setError(null)
    setIsLoading(true)

    const { error: fnErr } = await supabase.functions.invoke('create-user', {
      body: { full_name: name, email, password, department: dept, roles },
    })

    if (fnErr) {
      setError(fnErr.message)
      setIsLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Team Member</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Full Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Jane Smith" required
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="jane@jzsmartmedia.com" required
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Temporary Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters" minLength={8} required
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Department</label>
            <select
              value={dept} onChange={e => setDept(e.target.value as AppDepartment)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DEPT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Roles */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Roles</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(r => (
                <button
                  key={r} type="button"
                  onClick={() => toggleRole(r)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    roles.includes(r)
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2 px-4 bg-muted text-foreground rounded-md text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={isLoading}
              className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Member Card ─────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: TeamMember }) {
  const queryClient = useQueryClient()

  const toggleActive = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive } as never)
        .eq('user_id', member.user_id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  })

  const removeRole = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', member.user_id)
        .eq('role', role)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  })

  const [addingRole, setAddingRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer')

  const addRole = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: member.user_id, role } as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      setAddingRole(false)
    },
  })

  const availableRoles = ALL_ROLES.filter(r => !member.roles.includes(r))
  const initials = member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={cn(
      'bg-card border border-border rounded-lg p-4 space-y-3',
      !member.is_active && 'opacity-60'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary text-sm font-semibold">{initials}</span>
          </div>
          <div>
            <p className="font-medium text-sm">{member.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {member.department?.replace('_', ' ') ?? 'No department'}
              {!member.is_active && <span className="ml-2 text-destructive font-medium">Deactivated</span>}
            </p>
          </div>
        </div>

        {/* Active toggle */}
        <button
          onClick={() => toggleActive.mutate(!member.is_active)}
          disabled={toggleActive.isPending}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'transition-colors focus:outline-none',
            member.is_active ? 'bg-primary' : 'bg-muted'
          )}
          title={member.is_active ? 'Deactivate user' : 'Activate user'}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
              member.is_active ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Roles */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {member.roles.map(r => (
          <span
            key={r}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
          >
            {ROLE_LABELS[r]}
            {member.roles.length > 1 && (
              <button
                onClick={() => removeRole.mutate(r)}
                disabled={removeRole.isPending}
                className="hover:text-destructive transition-colors"
                title="Remove role"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}

        {/* Add role */}
        {availableRoles.length > 0 && !addingRole && (
          <button
            onClick={() => setAddingRole(true)}
            className="px-2 py-0.5 rounded-full text-xs text-muted-foreground border border-dashed border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            + Role
          </button>
        )}

        {addingRole && (
          <div className="flex items-center gap-1.5">
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as AppRole)}
              className="text-xs bg-background border border-input rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {availableRoles.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              onClick={() => addRole.mutate(selectedRole)}
              disabled={addRole.isPending}
              className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {addRole.isPending ? '...' : 'Add'}
            </button>
            <button
              onClick={() => setAddingRole(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [showAddUser, setShowAddUser] = useState(false)
  const queryClient = useQueryClient()
  const { data: members, isLoading, error } = useTeamMembers()

  const activeCount   = members?.filter(m => m.is_active).length ?? 0
  const inactiveCount = members?.filter(m => !m.is_active).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members, roles, and access.
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Stats row */}
      {members && (
        <div className="flex gap-4">
          <div className="metric-card flex items-center gap-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="metric-label">Total Members</p>
              <p className="metric-value text-lg">{members.length}</p>
            </div>
          </div>
          <div className="metric-card flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" />
            <div>
              <p className="metric-label">Active</p>
              <p className="metric-value text-lg text-[hsl(var(--success))]">{activeCount}</p>
            </div>
          </div>
          {inactiveCount > 0 && (
            <div className="metric-card flex items-center gap-3">
              <div>
                <p className="metric-label">Inactive</p>
                <p className="metric-value text-lg text-muted-foreground">{inactiveCount}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team grid */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          Failed to load team members: {(error as Error).message}
        </div>
      )}

      {members && members.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
          <Users className="h-8 w-8 opacity-40" />
          <p className="text-sm">No team members yet. Add your first user.</p>
        </div>
      )}

      {members && members.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map(m => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}

      {/* Add User Dialog */}
      {showAddUser && (
        <AddUserDialog
          onClose={() => setShowAddUser(false)}
          onSuccess={() => {
            setShowAddUser(false)
            queryClient.invalidateQueries({ queryKey: ['team-members'] })
          }}
        />
      )}
    </div>
  )
}
