'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { RestaurantMemberRole, StaffAssignableRole, STAFF_ASSIGNABLE_ROLES } from '@menugo/shared';
import {
  StaffMember,
  StaffInvitation,
  isFinalOwner,
  canManageMember,
  canAssignRole,
  getRoleBadgeStyles,
  validateStaffInput,
  formatInvitationLink
} from '@/lib/staff';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Mail,
  Clock,
  Send,
  X,
  ChefHat,
  UtensilsCrossed,
  Shield,
  CheckCircle2,
  Lock,
  KeyRound,
  RotateCcw,
  Sparkles,
  ExternalLink,
  CreditCard,
  Info
} from 'lucide-react';

export default function AdminStaffPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;
  const initialLoadedRef = useRef(false);

  // Restaurant Context
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);

  // Members & Invitations State
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffAssignableRole>('staff');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Transfer Ownership Modal
  const [transferTarget, setTransferTarget] = useState<StaffMember | null>(null);

  // Role Change Modal
  const [roleChangeTarget, setRoleChangeTarget] = useState<StaffMember | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<StaffAssignableRole>('staff');

  // Staff PIN Modals State
  const [showAddPinModal, setShowAddPinModal] = useState(false);
  const [pinStaffName, setPinStaffName] = useState('');
  const [pinStaffRole, setPinStaffRole] = useState<StaffAssignableRole>('kitchen');
  const [pinStaffPin, setPinStaffPin] = useState('');
  const [pinStaffCanCashier, setPinStaffCanCashier] = useState(false);

  // Edit PIN Modal State
  const [pinEditTarget, setPinEditTarget] = useState<StaffMember | null>(null);
  const [newEditPin, setNewEditPin] = useState('');

  const generateRandomPin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Load User's Restaurant Memberships
  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadRestaurants();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionLoading, router]);

  const loadRestaurants = async (isSilent = false) => {
    try {
      if (!isSilent && restaurants.length === 0) {
        setLoading(true);
      }
      const data = await apiRequest('/api/restaurants/my');
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedMembership((prev: any) => {
          if (!prev) return data[0];
          const match = data.find((r: any) => r.restaurant.id === prev.restaurant?.id);
          return match || data[0];
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load restaurant profile');
    } finally {
      setLoading(false);
    }
  };

  const selectedRestaurant = selectedMembership?.restaurant;
  const currentRole = (selectedMembership?.role || 'staff') as RestaurantMemberRole;
  const isOwner = currentRole === 'owner';
  const isAdminOrOwner = currentRole === 'owner' || currentRole === 'admin';

  // 2. Fetch Members & Invitations
  const loadStaffData = useCallback(async () => {
    if (!selectedRestaurant?.id || !isAdminOrOwner) return;

    try {
      setError(null);
      const [membersData, invitesData] = await Promise.all([
        apiRequest<StaffMember[]>(`/api/restaurants/${selectedRestaurant.id}/members`, {
          restaurantId: selectedRestaurant.id
        }),
        apiRequest<StaffInvitation[]>(`/api/restaurants/${selectedRestaurant.id}/members/invitations`, {
          restaurantId: selectedRestaurant.id
        })
      ]);

      setMembers(membersData);
      setInvitations(invitesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurant?.id, isAdminOrOwner]);

  useEffect(() => {
    if (selectedRestaurant?.id && isAdminOrOwner) {
      loadStaffData();
    }
  }, [selectedRestaurant?.id, isAdminOrOwner, loadStaffData]);

  // 3. Add or Invite Staff Member
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant?.id) return;

    const validation = validateStaffInput(inviteEmail, inviteRole);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string; type: string; member?: any; invitation?: any }>(
        `/api/restaurants/${selectedRestaurant.id}/members`,
        {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole })
        }
      );

      showToast(res.message);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('staff');
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to add staff member');
    } finally {
      setActionLoading(false);
    }
  };

  // 3a. Add Staff with 4-Digit PIN
  const handleAddStaffWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant?.id) return;

    const trimmedName = pinStaffName.trim();
    if (!trimmedName) {
      setError('Staff member name is required');
      return;
    }
    if (!/^\d{4}$/.test(pinStaffPin)) {
      setError('PIN must be exactly 4 numeric digits (e.g. 1234)');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string; member: any }>(
        `/api/restaurants/${selectedRestaurant.id}/staff-pin`,
        {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({
            name: trimmedName,
            role: pinStaffRole,
            pin: pinStaffPin,
            canCashier: pinStaffCanCashier
          })
        }
      );

      showToast(res.message || 'Staff member created successfully');
      setShowAddPinModal(false);
      setPinStaffName('');
      setPinStaffRole('kitchen');
      setPinStaffPin('');
      setPinStaffCanCashier(false);
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to create staff member');
    } finally {
      setActionLoading(false);
    }
  };

  // 3b. Toggle Staff Cashier Permission
  const handleToggleCashierPermission = async (member: StaffMember) => {
    if (!selectedRestaurant?.id) return;
    const newStatus = !member.canCashier;
    const name = member.staffName || member.user.name || 'this staff member';

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string; member: any }>(
        `/api/restaurants/${selectedRestaurant.id}/members/${member.membershipId}/cashier-permission`,
        {
          method: 'PATCH',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({ canCashier: newStatus })
        }
      );

      showToast(res.message || `Cashier permission updated for ${name}`);
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to update cashier permission');
    } finally {
      setActionLoading(false);
    }
  };

  // 3b. Update Staff 4-Digit PIN
  const handleUpdateStaffPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurant?.id || !pinEditTarget) return;

    if (!/^\d{4}$/.test(newEditPin)) {
      setError('PIN must be exactly 4 numeric digits');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string }>(
        `/api/restaurants/${selectedRestaurant.id}/members/${pinEditTarget.membershipId}/pin`,
        {
          method: 'PATCH',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({ pin: newEditPin })
        }
      );

      showToast(res.message || 'Staff PIN updated successfully');
      setPinEditTarget(null);
      setNewEditPin('');
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to update PIN');
    } finally {
      setActionLoading(false);
    }
  };

  // 3c. Reset Staff 4-Digit Password
  const handleResetStaffPassword = async (member: StaffMember) => {
    if (!selectedRestaurant?.id) return;

    const name = member.staffName || member.user.name || 'this staff member';
    if (!confirm(`Are you sure you want to reset password for ${name}? On their next PIN login, they will be prompted to set a new 4-digit password.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string }>(
        `/api/restaurants/${selectedRestaurant.id}/members/${member.membershipId}/reset-password`,
        {
          method: 'POST',
          restaurantId: selectedRestaurant.id
        }
      );

      showToast(res.message || 'Password reset. Staff will set a new password on next login.');
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Update Member Role
  const handleUpdateRole = async () => {
    if (!selectedRestaurant?.id || !roleChangeTarget) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string }>(
        `/api/restaurants/${selectedRestaurant.id}/members/${roleChangeTarget.membershipId}`,
        {
          method: 'PATCH',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({ role: newSelectedRole })
        }
      );

      showToast(res.message);
      setRoleChangeTarget(null);
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Revoke Member
  const handleRevokeMember = async (member: StaffMember) => {
    if (!selectedRestaurant?.id) return;

    if (isFinalOwner(member.membershipId, members)) {
      setError('Cannot remove the final owner of the restaurant. Transfer ownership first.');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.user.name || member.user.email} from ${selectedRestaurant.name}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string }>(
        `/api/restaurants/${selectedRestaurant.id}/members/${member.membershipId}`,
        {
          method: 'DELETE',
          restaurantId: selectedRestaurant.id
        }
      );

      showToast(res.message);
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Revoke Invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    if (!selectedRestaurant?.id) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string }>(
        `/api/restaurants/${selectedRestaurant.id}/members/invitations/${invitationId}`,
        {
          method: 'DELETE',
          restaurantId: selectedRestaurant.id
        }
      );

      showToast(res.message);
      loadStaffData();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Transfer Ownership
  const handleTransferOwnership = async () => {
    if (!selectedRestaurant?.id || !transferTarget) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await apiRequest<{ message: string }>(
        `/api/restaurants/${selectedRestaurant.id}/members/transfer-ownership`,
        {
          method: 'POST',
          restaurantId: selectedRestaurant.id,
          body: JSON.stringify({ targetMemberId: transferTarget.membershipId })
        }
      );

      showToast(res.message);
      setTransferTarget(null);
      loadRestaurants();
    } catch (err: any) {
      setError(err.message || 'Failed to transfer ownership');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy invitation link
  const handleCopyLink = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = formatInvitationLink(token, origin);
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    showToast('Invitation link copied to clipboard!');
  };

  if ((sessionLoading || loading) && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!isAdminOrOwner) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Access Restricted</h2>
          <p className="text-slate-600 text-sm">
            Staff and membership management is reserved exclusively for restaurant owners and managers.
          </p>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                <span>Staff &amp; Memberships</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold text-xs uppercase tracking-wider">
                {currentRole}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {selectedRestaurant?.name || 'Restaurant Staff Administration'}
            </p>
          </div>

          {/* Restaurant switcher */}
          {restaurants.length > 1 && (
            <select
              value={selectedRestaurant?.id}
              onChange={(e) => {
                const found = restaurants.find((r) => r.restaurant.id === e.target.value);
                if (found) setSelectedMembership(found);
              }}
              className="ml-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
            >
              {restaurants.map((m) => (
                <option key={m.restaurant.id} value={m.restaurant.id}>
                  {m.restaurant.name} ({m.role})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadStaffData()}
            disabled={actionLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin text-orange-600' : ''}`} />
          </button>

          <Link
            href={`/staff/login?restaurant=${selectedRestaurant?.slug || ''}`}
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
            title="Open Touch PIN Staff Terminal"
          >
            <KeyRound className="w-3.5 h-3.5 text-orange-600" />
            <span>Staff Terminal</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>

          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
            title="Invite via email link"
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>Invite Email</span>
          </button>

          <button
            onClick={() => {
              setPinStaffPin(generateRandomPin());
              setShowAddPinModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-sm"
          >
            <KeyRound className="w-4 h-4" />
            <span>+ Add Staff (PIN)</span>
          </button>
        </div>
      </header>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Staff Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Active Members
            </span>
            <span className="text-3xl font-black text-slate-900">{members.length}</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              PIN Direct Staff
            </span>
            <span className="text-3xl font-black text-orange-600">
              {members.filter((m) => m.pin).length}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Kitchen Team
            </span>
            <span className="text-3xl font-black text-amber-600">
              {members.filter((m) => m.role === 'kitchen').length}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Floor Service Team
            </span>
            <span className="text-3xl font-black text-emerald-600">
              {members.filter((m) => m.role === 'staff').length}
            </span>
          </div>
        </div>

        {/* Section 1: Active Members Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              <h2 className="text-base font-extrabold text-slate-900">Active Staff Directory</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">{members.length} members</span>
          </div>

          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const roleInfo = getRoleBadgeStyles(member.role);
              const isFinal = isFinalOwner(member.membershipId, members);
              const isSelf = member.user.id === session?.user?.id;
              const canModify = canManageMember(currentRole, member.role);

              return (
                <div
                  key={member.membershipId}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200 shadow-2xs">
                      {(member.staffName || member.user.name || member.user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          {member.staffName || member.user.name || 'Unnamed Member'}
                        </span>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                            You
                          </span>
                        )}
                        {member.pin && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-xs font-mono font-black shadow-2xs">
                            <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                            <span>PIN: {member.pin}</span>
                          </span>
                        )}
                        {member.pin && (
                          member.isPasswordSet ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                              <Check className="w-3 h-3" />
                              <span>Password Set</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                              <Clock className="w-3 h-3" />
                              <span>Pending First Login</span>
                            </span>
                          )
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium block mt-0.5">
                        {member.user.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Role Badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleInfo.badgeClass}`}
                        title={roleInfo.description}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${roleInfo.dotClass}`} />
                        <span>{roleInfo.label}</span>
                      </span>

                      {(member.role === 'owner' || member.role === 'admin' || member.canCashier) && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold"
                          title="Cashier Permission: Can view all tables, active bills, and close table sessions"
                        >
                          <CreditCard className="w-3 h-3 text-emerald-600" />
                          <span>Cashier</span>
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Cashier Permission Toggle for Kitchen & Waitstaff */}
                      {canModify && !isFinal && (member.role === 'staff' || member.role === 'kitchen') && (
                        <button
                          onClick={() => handleToggleCashierPermission(member)}
                          disabled={actionLoading}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition shadow-2xs ${
                            member.canCashier
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                          title={
                            member.canCashier
                              ? 'Click to revoke Cashier permission'
                              : 'Click to grant Cashier permission (view tables, live bills, and release tables)'
                          }
                        >
                          <CreditCard className={`w-3.5 h-3.5 ${member.canCashier ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span>{member.canCashier ? 'Cashier: Active' : '+ Cashier'}</span>
                        </button>
                      )}
                      {/* PIN Controls for Staff */}
                      {member.pin && canModify && (
                        <>
                          <button
                            onClick={() => {
                              setPinEditTarget(member);
                              setNewEditPin(member.pin || '');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs"
                            title="Update 4-digit PIN"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                            <span>Edit PIN</span>
                          </button>

                          <button
                            onClick={() => handleResetStaffPassword(member)}
                            disabled={actionLoading}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition shadow-2xs"
                            title="Reset 4-digit password (forces new password prompt on next login)"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset Password</span>
                          </button>
                        </>
                      )}

                      {/* Change Role Button */}
                      {canModify && !isFinal && (
                        <button
                          onClick={() => {
                            setRoleChangeTarget(member);
                            setNewSelectedRole(
                              (member.role === 'owner' ? 'admin' : member.role) as StaffAssignableRole
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition shadow-2xs"
                        >
                          Change Role
                        </button>
                      )}

                      {/* Transfer Ownership (Owner only) */}
                      {isOwner && member.role !== 'owner' && (
                        <button
                          onClick={() => setTransferTarget(member)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition shadow-2xs"
                          title="Transfer restaurant ownership to this member"
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>Make Owner</span>
                        </button>
                      )}

                      {/* Revoke / Delete Button */}
                      {canModify && !isFinal ? (
                        <button
                          onClick={() => handleRevokeMember(member)}
                          disabled={actionLoading}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                          title="Remove staff member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : isFinal ? (
                        <span
                          className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 py-1 bg-slate-100 rounded-lg"
                          title="The final owner cannot be removed"
                        >
                          Primary Owner
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600" />
                <h2 className="text-base font-extrabold text-slate-900">Pending Staff Invitations</h2>
              </div>
              <span className="text-xs font-bold text-purple-700">{invitations.length} pending</span>
            </div>

            <div className="divide-y divide-slate-100">
              {invitations.map((invite) => {
                const roleInfo = getRoleBadgeStyles(invite.role);
                const isCopied = copiedToken === invite.token;

                return (
                  <div
                    key={invite.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm border border-purple-200">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-slate-900 block">
                          {invite.email}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>Expires: {new Date(invite.expiresAt).toLocaleDateString()}</span>
                          {invite.invitedBy && (
                            <>
                              <span>•</span>
                              <span>Invited by {invite.invitedBy.name || invite.invitedBy.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleInfo.badgeClass}`}>
                        {roleInfo.label}
                      </span>

                      <button
                        onClick={() => handleCopyLink(invite.token)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs ${
                          isCopied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Copy activation link"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      <button
                        onClick={() => handleRevokeInvitation(invite.id)}
                        disabled={actionLoading}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Cancel Invitation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal 1: Invite / Add Staff Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-black text-slate-900">Invite Staff Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="chef@restaurant.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  If the user already has an account, they are added immediately. Otherwise, an invitation link is generated.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Assigned V1 Role
                </label>
                <div className="space-y-2">
                  {isOwner && (
                    <label
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                        inviteRole === 'admin'
                          ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={inviteRole === 'admin'}
                        onChange={() => setInviteRole('admin')}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <span className="font-extrabold text-sm text-slate-900">Manager (Admin)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Can manage products, categories, tables, orders and invite floor staff.
                        </p>
                      </div>
                    </label>
                  )}

                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      inviteRole === 'kitchen'
                        ? 'bg-orange-50/70 border-orange-400 ring-1 ring-orange-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="kitchen"
                      checked={inviteRole === 'kitchen'}
                      onChange={() => setInviteRole('kitchen')}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <ChefHat className="w-4 h-4 text-orange-600" />
                        <span className="font-extrabold text-sm text-slate-900">Kitchen Staff</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Access to Kitchen KDS display: accept orders and advance dishes to ready.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      inviteRole === 'staff'
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="staff"
                      checked={inviteRole === 'staff'}
                      onChange={() => setInviteRole('staff')}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                        <span className="font-extrabold text-sm text-slate-900">Floor Staff / Waiter</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Access to Floor Service Pass: view ready dishes and mark orders served.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Change Role Modal */}
      {roleChangeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              Change Role for {roleChangeTarget.user.name || roleChangeTarget.user.email}
            </h3>

            <div className="space-y-2">
              {isOwner && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="newRole"
                    value="admin"
                    checked={newSelectedRole === 'admin'}
                    onChange={() => setNewSelectedRole('admin')}
                  />
                  <span className="text-sm font-bold text-slate-800">Manager (Admin)</span>
                </label>
              )}

              <label className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="newRole"
                  value="kitchen"
                  checked={newSelectedRole === 'kitchen'}
                  onChange={() => setNewSelectedRole('kitchen')}
                />
                <span className="text-sm font-bold text-slate-800">Kitchen Staff</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="newRole"
                  value="staff"
                  checked={newSelectedRole === 'staff'}
                  onChange={() => setNewSelectedRole('staff')}
                />
                <span className="text-sm font-bold text-slate-800">Floor Staff / Waiter</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRoleChangeTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Transfer Ownership Modal */}
      {transferTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
              <Crown className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">Transfer Ownership</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to transfer full ownership of{' '}
                <strong>{selectedRestaurant?.name}</strong> to{' '}
                <strong>{transferTarget.user.name || transferTarget.user.email}</strong>.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Important:</span>
              </div>
              <p>
                Once transferred, you will become an Administrator (Manager). Only the new owner will have the authority to transfer ownership or delete the restaurant.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setTransferTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOwnership}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-sm"
              >
                Confirm Ownership Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Add Staff with 4-Digit PIN */}
      {showAddPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add Staff (4-Digit PIN)</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Quick direct access for Kitchen &amp; Floor terminals</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPinModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaffWithPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Staff Member Name
                </label>
                <input
                  type="text"
                  required
                  value={pinStaffName}
                  onChange={(e) => setPinStaffName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar (Cook)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Assigned V1 Role
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      pinStaffRole === 'kitchen'
                        ? 'bg-orange-50/70 border-orange-400 ring-1 ring-orange-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pinRole"
                      value="kitchen"
                      checked={pinStaffRole === 'kitchen'}
                      onChange={() => setPinStaffRole('kitchen')}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <ChefHat className="w-4 h-4 text-orange-600" />
                        <span className="font-extrabold text-sm text-slate-900">Kitchen Staff</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Access to Kitchen KDS: accept orders, prepare, and advance to ready.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      pinStaffRole === 'staff'
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pinRole"
                      value="staff"
                      checked={pinStaffRole === 'staff'}
                      onChange={() => setPinStaffRole('staff')}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                        <span className="font-extrabold text-sm text-slate-900">Floor Staff / Waiter</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Access to Service Pass: view ready dishes and mark orders served.
                      </p>
                    </div>
                  </label>

                  {isOwner && (
                    <label
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                        pinStaffRole === 'admin'
                          ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pinRole"
                        value="admin"
                        checked={pinStaffRole === 'admin'}
                        onChange={() => setPinStaffRole('admin')}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <span className="font-extrabold text-sm text-slate-900">Manager (Admin)</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Full admin dashboard, catalog, tables, and staff management.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    4-Digit Access PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setPinStaffPin(generateRandomPin())}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Random</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  value={pinStaffPin}
                  onChange={(e) => setPinStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  className="w-full text-center font-mono text-2xl font-black tracking-widest px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 cursor-pointer hover:bg-emerald-50 transition">
                  <input
                    type="checkbox"
                    checked={pinStaffCanCashier}
                    onChange={(e) => setPinStaffCanCashier(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-700" />
                      <span className="font-extrabold text-sm text-emerald-950">
                        Grant Cashier Permission
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      Permits viewing all tables, checking live running bills, and closing/releasing table sessions when customers leave.
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <span className="font-extrabold flex items-center gap-1.5 text-amber-950">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>How First Login Works:</span>
                </span>
                <p className="text-amber-800 leading-relaxed">
                  Give this 4-digit PIN to the staff member. When they log in for the first time at <strong>/staff/login</strong>, they will be prompted to set their own secret 4-digit password. Every subsequent time, they enter both to log in directly.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPinModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || pinStaffPin.length !== 4 || !pinStaffName.trim()}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>Create Staff Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Edit Staff 4-Digit PIN */}
      {pinEditTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-black text-slate-900">Change 4-Digit PIN</h3>
              </div>
              <button
                onClick={() => setPinEditTarget(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Update access PIN for <strong>{pinEditTarget.staffName || pinEditTarget.user.name || pinEditTarget.user.email}</strong>.
            </p>

            <form onSubmit={handleUpdateStaffPin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    New 4-Digit PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewEditPin(generateRandomPin())}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Random</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  value={newEditPin}
                  onChange={(e) => setNewEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  className="w-full text-center font-mono text-2xl font-black tracking-widest px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinEditTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || newEditPin.length !== 4}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
