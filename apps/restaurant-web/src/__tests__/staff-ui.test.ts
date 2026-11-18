import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StaffMember,
  isFinalOwner,
  canManageMember,
  canAssignRole,
  getRoleBadgeStyles,
  validateStaffInput,
  formatInvitationLink
} from '../lib/staff';

describe('Task 18 — Staff Membership Administration UI & Logic', () => {
  const mockMembers: StaffMember[] = [
    {
      membershipId: 'mem-1',
      role: 'owner',
      createdAt: '2026-11-01T00:00:00.000Z',
      user: { id: 'usr-1', name: 'Alice Owner', email: 'alice@restaurant.com' }
    },
    {
      membershipId: 'mem-2',
      role: 'admin',
      createdAt: '2026-11-02T00:00:00.000Z',
      user: { id: 'usr-2', name: 'Aaron Admin', email: 'aaron@restaurant.com' }
    },
    {
      membershipId: 'mem-3',
      role: 'kitchen',
      createdAt: '2026-11-03T00:00:00.000Z',
      user: { id: 'usr-3', name: 'Ken Kitchen', email: 'ken@restaurant.com' }
    },
    {
      membershipId: 'mem-4',
      role: 'staff',
      createdAt: '2026-11-04T00:00:00.000Z',
      user: { id: 'usr-4', name: 'Sam Staff', email: 'sam@restaurant.com' }
    }
  ];

  const mockMultipleOwners: StaffMember[] = [
    ...mockMembers,
    {
      membershipId: 'mem-5',
      role: 'owner',
      createdAt: '2026-11-05T00:00:00.000Z',
      user: { id: 'usr-5', name: 'Bob Co-Owner', email: 'bob@restaurant.com' }
    }
  ];

  // 1. Final Owner Protection
  it('isFinalOwner returns true when member is the sole owner and false when multiple owners exist', () => {
    // Sole owner in mockMembers
    assert.equal(isFinalOwner('mem-1', mockMembers), true);

    // Non-owner in mockMembers
    assert.equal(isFinalOwner('mem-2', mockMembers), false);
    assert.equal(isFinalOwner('mem-3', mockMembers), false);

    // Multiple owners in mockMultipleOwners
    assert.equal(isFinalOwner('mem-1', mockMultipleOwners), false);
    assert.equal(isFinalOwner('mem-5', mockMultipleOwners), false);
  });

  // 2. Member Management Privileges
  it('canManageMember enforces role hierarchy', () => {
    // Owner can manage all other roles
    assert.equal(canManageMember('owner', 'admin'), true);
    assert.equal(canManageMember('owner', 'kitchen'), true);
    assert.equal(canManageMember('owner', 'staff'), true);

    // Admin can manage floor staff and kitchen
    assert.equal(canManageMember('admin', 'staff'), true);
    assert.equal(canManageMember('admin', 'kitchen'), true);

    // Admin CANNOT manage Owner or other Admins
    assert.equal(canManageMember('admin', 'owner'), false);
    assert.equal(canManageMember('admin', 'admin'), false);

    // Staff and kitchen cannot manage any members
    assert.equal(canManageMember('staff', 'staff'), false);
    assert.equal(canManageMember('kitchen', 'kitchen'), false);
  });

  // 3. Assignable Role Privileges & Escalation Prevention
  it('canAssignRole prevents role escalation to owner and protects admin role appointment', () => {
    // Nobody can assign 'owner'
    assert.equal(canAssignRole('owner', 'owner'), false);
    assert.equal(canAssignRole('admin', 'owner'), false);

    // Owner can assign admin, kitchen, staff
    assert.equal(canAssignRole('owner', 'admin'), true);
    assert.equal(canAssignRole('owner', 'kitchen'), true);
    assert.equal(canAssignRole('owner', 'staff'), true);

    // Admin can ONLY assign kitchen or staff, never admin
    assert.equal(canAssignRole('admin', 'admin'), false);
    assert.equal(canAssignRole('admin', 'kitchen'), true);
    assert.equal(canAssignRole('admin', 'staff'), true);

    // Staff / kitchen cannot assign any roles
    assert.equal(canAssignRole('staff', 'staff'), false);
    assert.equal(canAssignRole('kitchen', 'staff'), false);
  });

  // 4. Role Display Styles
  it('getRoleBadgeStyles returns valid metadata and styles for defined V1 roles', () => {
    const ownerStyles = getRoleBadgeStyles('owner');
    assert.equal(ownerStyles.label, 'Owner');
    assert.ok(ownerStyles.badgeClass.includes('purple'));

    const adminStyles = getRoleBadgeStyles('admin');
    assert.equal(adminStyles.label, 'Manager / Admin');
    assert.ok(adminStyles.badgeClass.includes('blue'));

    const kitchenStyles = getRoleBadgeStyles('kitchen');
    assert.equal(kitchenStyles.label, 'Kitchen Staff');
    assert.ok(kitchenStyles.badgeClass.includes('orange'));

    const staffStyles = getRoleBadgeStyles('staff');
    assert.equal(staffStyles.label, 'Floor Staff / Service');
    assert.ok(staffStyles.badgeClass.includes('emerald'));
  });

  // 5. Staff Input Validation
  it('validateStaffInput validates email and role constraints', () => {
    // Valid input
    assert.equal(validateStaffInput('chef@restaurant.com', 'kitchen').valid, true);
    assert.equal(validateStaffInput('manager@restaurant.com', 'admin').valid, true);

    // Missing or invalid email
    const emptyEmail = validateStaffInput('', 'staff');
    assert.equal(emptyEmail.valid, false);

    const invalidEmail = validateStaffInput('not-an-email', 'staff');
    assert.equal(invalidEmail.valid, false);

    // Prohibited assignment of owner role
    const ownerAttempt = validateStaffInput('new@restaurant.com', 'owner');
    assert.equal(ownerAttempt.valid, false);
    if (!ownerAttempt.valid) {
      assert.ok(ownerAttempt.error.includes('owner'));
    }

    // Invalid arbitrary role
    const arbitraryRole = validateStaffInput('new@restaurant.com', 'super_admin');
    assert.equal(arbitraryRole.valid, false);
  });

  // 6. Invitation Link Formatting
  it('formatInvitationLink constructs clean invitation activation URL', () => {
    const link = formatInvitationLink('secret-token-1234567890', 'https://menugo.app');
    assert.equal(link, 'https://menugo.app/admin/invitations/secret-token-1234567890');

    // Handles trailing slash in origin
    const linkTrailing = formatInvitationLink('secret-token-1234567890', 'https://menugo.app/');
    assert.equal(linkTrailing, 'https://menugo.app/admin/invitations/secret-token-1234567890');
  });
});

