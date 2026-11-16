'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  Users,
  UserPlus,
  Shield,
  ChefHat,
  Truck,
  UserCheck,
  UserX,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  Loader2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Power,
  X,
  ArrowLeft
} from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  email: string;
}

interface StaffMember {
  id: string;
  restaurantId: string;
  userId: string;
  staffName?: string | null;
  phone?: string | null;
  role: 'owner' | 'admin' | 'kitchen' | 'delivery' | 'staff';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  user: StaffUser;
}

interface StaffSummary {
  total: number;
  active: number;
  inactive: number;
  roles: {
    owners: number;
    admins: number;
    kitchen: number;
    delivery: number;
    generalStaff: number;
  };
}

export default function CinemaAdminStaffPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [theatreId, setTheatreId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'kitchen' as 'admin' | 'kitchen' | 'delivery' | 'staff',
    password: ''
  });

  const [editFormData, setEditFormData] = useState({
    staffName: '',
    phone: '',
    role: 'kitchen' as 'owner' | 'admin' | 'kitchen' | 'delivery' | 'staff'
  });

  // Resolve cinema theatre ID on mount
  useEffect(() => {
    apiRequest('/api/restaurants/my?tenantType=cinema')
      .then((myTenants) => {
        const activeTheatre = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');
        if (activeTheatre) setTheatreId(activeTheatre.restaurant.id);
      })
      .catch((e) => console.warn('Could not resolve cinema tenant:', e));
  }, []);

  const loadStaffData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const url = `/api/cinema/staff${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiRequest(url, { theatreId: theatreId || undefined });

      if (res.success) {
        setMembers(res.members || []);
        setSummary(res.summary || null);
      }
    } catch (err: any) {
      console.error('Failed to load cinema staff:', err);
      setError(err.message || 'Failed to load staff roster');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, statusFilter, searchQuery, theatreId]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);

      await apiRequest('/api/cinema/staff', {
        method: 'POST',
        theatreId: theatreId || undefined,
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
          role: formData.role,
          password: formData.password || undefined
        })
      });

      setSuccessMsg('Staff member added successfully');
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'kitchen',
        password: ''
      });
      loadStaffData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to add staff member');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingMember(member);
    setEditFormData({
      staffName: member.staffName || member.user?.name || '',
      phone: member.phone || '',
      role: member.role
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      setActionLoading(true);
      setError(null);

      await apiRequest(`/api/cinema/staff/${editingMember.id}`, {
        method: 'PATCH',
        theatreId: theatreId || undefined,
        body: JSON.stringify({
          staffName: editFormData.staffName.trim(),
          phone: editFormData.phone.trim() || undefined,
          role: editFormData.role
        })
      });

      setSuccessMsg('Staff member updated successfully');
      setIsEditModalOpen(false);
      setEditingMember(null);
      loadStaffData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update staff member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    const isActivating = member.status === 'inactive';
    const actionText = isActivating ? 'activate' : 'deactivate';

    if (!confirm(`Are you sure you want to ${actionText} ${member.staffName || member.user?.name}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const endpoint = `/api/cinema/staff/${member.id}/${isActivating ? 'activate' : 'deactivate'}`;
      await apiRequest(endpoint, { method: 'POST', theatreId: theatreId || undefined });

      setSuccessMsg(`Staff member ${isActivating ? 'activated' : 'deactivated'} successfully`);
      loadStaffData(true);
    } catch (err: any) {
      setError(err.message || `Failed to ${actionText} staff member`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStaff = async (member: StaffMember) => {
    if (!confirm(`Are you sure you want to remove ${member.staffName || member.user?.name} from this cinema theatre? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      await apiRequest(`/api/cinema/staff/${member.id}`, { method: 'DELETE', theatreId: theatreId || undefined });

      setSuccessMsg('Staff member removed successfully');
      loadStaffData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to remove staff member');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <ShieldCheck className="w-3 h-3" /> Owner
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'kitchen':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ChefHat className="w-3 h-3" /> Kitchen Staff
          </span>
        );
      case 'delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Truck className="w-3 h-3" /> Seat Runner
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <Users className="w-3 h-3" /> Staff
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/cinema/admin/dashboard"
              className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              Staff Management & Permissions
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
              Task 19
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage theatre administrators, kitchen food prep staff, and in-auditorium seat delivery runners.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadStaffData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Total Staff</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summary.total}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Active</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{summary.active}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Inactive</span>
              <UserX className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-400">{summary.inactive}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Kitchen</span>
              <ChefHat className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summary.roles.kitchen}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Seat Runners</span>
              <Truck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summary.roles.delivery}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Admins</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summary.roles.admins + summary.roles.owners}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 lg:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-3 lg:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owners</option>
              <option value="admin">Administrators</option>
              <option value="kitchen">Kitchen Staff</option>
              <option value="delivery">Seat Delivery Runners</option>
              <option value="staff">General Floor Staff</option>
            </select>
          </div>

          <div className="sm:col-span-3 lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Members List */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading staff members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">No staff members found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter parameters.'
                : 'Get started by inviting your first kitchen, delivery or admin team member.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Add Staff Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {members.map((member) => {
                  const displayName = member.staffName || member.user?.name || 'Unnamed Staff';
                  const email = member.user?.email || 'No email';
                  const isActive = member.status === 'active';

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-slate-800/40 transition-colors ${!isActive ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 text-xs">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {displayName}
                              {member.role === 'owner' && (
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {member.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {member.phone}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {getRoleBadge(member.role)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(member.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(member)}
                            title="Edit Staff Member"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(member)}
                            title={isActive ? 'Deactivate Account' : 'Activate Account'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {member.role !== 'owner' && (
                            <button
                              onClick={() => handleDeleteStaff(member)}
                              title="Remove from Theatre"
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Definitions Quick Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
            <Shield className="w-4 h-4" />
            <span>Cinema Administrator</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Full control over screens, seating layouts, movie catalogue, daily show schedules, F&B menu, payment credentials, and operational staff management.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <ChefHat className="w-4 h-4" />
            <span>Kitchen Staff</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Direct access to the Cinema Kitchen KDS queue to accept incoming paid orders, monitor preparation timers, and mark food ready for pickup.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
            <Truck className="w-4 h-4" />
            <span>In-Seat Delivery Runner</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Access to live ready orders with prominent auditorium screen number, row letter, and seat number to dispatch and confirm delivery directly at seat.
          </p>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Add Cinema Staff
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. runner@cinema.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="kitchen">Kitchen Staff (Food Preparation)</option>
                  <option value="delivery">Seat Delivery Runner (Auditorium Dispatch)</option>
                  <option value="admin">Cinema Administrator (Full Management)</option>
                  <option value="staff">Floor Staff (General)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Password (If creating new account)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to use default or if user already exists"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {isEditModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Edit Staff Member
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.staffName}
                  onChange={(e) => setEditFormData({ ...editFormData, staffName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={editingMember.user?.email || ''}
                  className="w-full px-3.5 py-2 bg-slate-950/50 border border-slate-800/80 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editFormData.role}
                  disabled={editingMember.role === 'owner'}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  {editingMember.role === 'owner' && <option value="owner">Theatre Owner</option>}
                  <option value="kitchen">Kitchen Staff</option>
                  <option value="delivery">Seat Delivery Runner</option>
                  <option value="admin">Cinema Administrator</option>
                  <option value="staff">Floor Staff</option>
                </select>
                {editingMember.role === 'owner' && (
                  <p className="text-[11px] text-amber-400 mt-1">Owner role cannot be changed directly.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Update Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
