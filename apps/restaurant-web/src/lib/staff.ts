import { RestaurantMemberRole, STAFF_ASSIGNABLE_ROLES, StaffAssignableRole } from '@menugo/shared';

export interface StaffUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

export interface StaffMember {
  membershipId: string;
  role: RestaurantMemberRole;
  staffName?: string | null;
  pin?: string | null;
  isPasswordSet?: boolean;
  canCashier?: boolean;
  createdAt: string;
  updatedAt?: string;
  user: StaffUser;
}

export interface StaffInvitation {
  id: string;
  email: string;
  role: StaffAssignableRole;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Checks whether a target member is the sole (final) owner of the restaurant.
 * Final owners cannot be demoted or deleted.
 */
export function isFinalOwner(memberId: string, members: StaffMember[]): boolean {
  const target = members.find((m) => m.membershipId === memberId);
  if (!target || target.role !== 'owner') return false;

  const ownerCount = members.filter((m) => m.role === 'owner').length;
  return ownerCount <= 1;
}

/**
 * Checks whether the caller's role is permitted to modify or revoke the target member.
 * - 'owner': can manage admin, kitchen, staff, and other co-owners (if multiple).
 * - 'admin': can only manage kitchen and staff; cannot touch owner or another admin.
 * - 'kitchen' / 'staff': cannot manage any members.
 */
export function canManageMember(
  callerRole: RestaurantMemberRole,
  targetRole: RestaurantMemberRole
): boolean {
  if (callerRole === 'owner') return true;
  if (callerRole === 'admin') {
    return targetRole === 'kitchen' || targetRole === 'staff';
  }
  return false;
}

/**
 * Checks whether the caller's role is authorized to assign a specific target role.
 * - Nobody can assign 'owner' (only ownership transfer).
 * - Owner can assign 'admin', 'kitchen', 'staff'.
 * - Admin can only assign 'kitchen' or 'staff'.
 */
export function canAssignRole(
  callerRole: RestaurantMemberRole,
  targetRole: RestaurantMemberRole
): boolean {
  if (targetRole === 'owner') return false;
  if (callerRole === 'owner') {
    return STAFF_ASSIGNABLE_ROLES.includes(targetRole as StaffAssignableRole);
  }
  if (callerRole === 'admin') {
    return targetRole === 'kitchen' || targetRole === 'staff';
  }
  return false;
}

/**
 * Visual badge styling and metadata for restaurant roles.
 */
export function getRoleBadgeStyles(role: RestaurantMemberRole): {
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
} {
  switch (role) {
    case 'owner':
      return {
        label: 'Owner',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        dotClass: 'bg-purple-500',
        description: 'Full restaurant ownership, billing, transfer & staff control'
      };
    case 'admin':
      return {
        label: 'Manager / Admin',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        dotClass: 'bg-blue-500',
        description: 'Menu, tables, orders, and floor staff management'
      };
    case 'kitchen':
      return {
        label: 'Kitchen Staff',
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
        dotClass: 'bg-orange-500',
        description: 'Kitchen KDS, order acceptance, preparation & ready status'
      };
    case 'staff':
      return {
        label: 'Floor Staff / Service',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500',
        description: 'Floor service pass, table delivery, and mark served'
      };
    default:
      return {
        label: role,
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
        dotClass: 'bg-slate-400',
        description: 'General staff member'
      };
  }
}

/**
 * Validates staff addition or invitation form inputs.
 */
export function validateStaffInput(
  email: string,
  role: string
): { valid: true } | { valid: false; error: string } {
  const trimmedEmail = email?.trim().toLowerCase();
  if (!trimmedEmail) {
    return { valid: false, error: 'Email address is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  if (role === 'owner') {
    return {
      valid: false,
      error: 'Cannot assign owner role directly. Use ownership transfer.'
    };
  }

  if (!STAFF_ASSIGNABLE_ROLES.includes(role as StaffAssignableRole)) {
    return {
      valid: false,
      error: 'Please select a valid role (admin, staff, or kitchen)'
    };
  }

  return { valid: true };
}

/**
 * Formats an invitation activation link for display / copy-to-clipboard.
 */
export function formatInvitationLink(token: string, origin = ''): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/admin/invitations/${token}`;
}

