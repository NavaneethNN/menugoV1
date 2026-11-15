'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  Tv,
  Film,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Edit,
  Power,
  PowerOff,
  Armchair,
  CalendarDays,
  Sparkles,
  ArrowLeft,
  X,
  Layers,
  Users,
  ShieldCheck,
  Archive,
  Info
} from 'lucide-react';

interface CinemaScreen {
  id: string;
  theatreId: string;
  screenName: string;
  description: string | null;
  screenType: string;
  status: 'active' | 'inactive' | 'archived';
  totalRows: number;
  totalSeats: number;
  seatingConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CinemaAdminScreensPage() {
  const [screens, setScreens] = useState<CinemaScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState<CinemaScreen | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    screenName: '',
    screenType: 'standard',
    description: '',
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    loadTheatreAndScreens();
  }, []);

  const loadTheatreAndScreens = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find active cinema tenant
      const myTenants = await apiRequest('/api/restaurants/my?tenantType=cinema');
      const activeTheatre = myTenants.find((m: any) => m.restaurant?.tenantType === 'cinema');

      if (!activeTheatre) {
        setError('No cinema theatre account found. Please register a theatre first.');
        setLoading(false);
        return;
      }

      const activeId = activeTheatre.restaurant.id;
      setTheatreId(activeId);
      setTheatreName(activeTheatre.restaurant.name);

      // Fetch screens
      const res = await apiRequest('/api/cinema/screens', {
        theatreId: activeId
      });

      setScreens(res.screens || []);
    } catch (err: any) {
      console.error('Failed to load screens:', err);
      setError(err?.message || 'Failed to fetch cinema screens');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      screenName: '',
      screenType: 'standard',
      description: '',
      status: 'active'
    });
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (screen: CinemaScreen) => {
    setEditingScreen(screen);
    setFormData({
      screenName: screen.screenName,
      screenType: screen.screenType,
      description: screen.description || '',
      status: screen.status === 'inactive' ? 'inactive' : 'active'
    });
    setModalError(null);
  };

  const handleCloseModals = () => {
    setIsCreateModalOpen(false);
    setEditingScreen(null);
    setModalError(null);
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    if (!formData.screenName.trim()) {
      setModalError('Screen name is required');
      return;
    }

    try {
      setModalLoading(true);
      setModalError(null);

      const res = await apiRequest('/api/cinema/screens', {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          screenName: formData.screenName.trim(),
          screenType: formData.screenType,
          description: formData.description.trim() || null,
          status: formData.status
        })
      });

      setSuccessMessage(`Screen "${res.screen.screenName}" created successfully!`);
      handleCloseModals();
      await loadTheatreAndScreens();
    } catch (err: any) {
      console.error('Create screen failed:', err);
      setModalError(err?.message || 'Failed to create screen');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !editingScreen) return;

    if (!formData.screenName.trim()) {
      setModalError('Screen name cannot be empty');
      return;
    }

    try {
      setModalLoading(true);
      setModalError(null);

      const res = await apiRequest(`/api/cinema/screens/${editingScreen.id}`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({
          screenName: formData.screenName.trim(),
          screenType: formData.screenType,
          description: formData.description.trim() || null,
          status: formData.status
        })
      });

      setSuccessMessage(`Screen "${res.screen.screenName}" updated successfully!`);
      handleCloseModals();
      await loadTheatreAndScreens();
    } catch (err: any) {
      console.error('Update screen failed:', err);
      setModalError(err?.message || 'Failed to update screen');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (screen: CinemaScreen) => {
    if (!theatreId) return;
    const isActivating = screen.status !== 'active';
    const endpoint = isActivating
      ? `/api/cinema/screens/${screen.id}/activate`
      : `/api/cinema/screens/${screen.id}/deactivate`;

    try {
      setError(null);
      await apiRequest(endpoint, {
        method: 'POST',
        theatreId
      });

      setSuccessMessage(
        `Screen "${screen.screenName}" has been ${isActivating ? 'activated' : 'deactivated'}.`
      );
      await loadTheatreAndScreens();
    } catch (err: any) {
      console.error('Status toggle failed:', err);
      setError(err?.message || 'Failed to change screen status');
    }
  };

  const handleArchiveScreen = async (screen: CinemaScreen) => {
    if (!theatreId) return;
    const confirmArchive = window.confirm(
      `Are you sure you want to archive "${screen.screenName}"? This screen will be deactivated and preserved for historical audit records.`
    );
    if (!confirmArchive) return;

    try {
      setError(null);
      await apiRequest(`/api/cinema/screens/${screen.id}`, {
        method: 'DELETE',
        theatreId
      });

      setSuccessMessage(`Screen "${screen.screenName}" archived successfully.`);
      await loadTheatreAndScreens();
    } catch (err: any) {
      console.error('Screen archive failed:', err);
      setError(err?.message || 'Failed to archive screen');
    }
  };

  const filteredScreens = screens.filter((s) => {
    if (statusFilter === 'active') return s.status === 'active';
    if (statusFilter === 'inactive') return s.status === 'inactive';
    return s.status !== 'archived';
  });

  const getScreenTypeBadge = (type: string) => {
    switch (type) {
      case 'imax':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">IMAX Laser</span>;
      case '4dx':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">4DX Motion</span>;
      case 'dolby_atmos':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">Dolby Atmos</span>;
      case 'vip':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">VIP Lounge</span>;
      case 'drive_in':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Drive-In</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">Standard</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading auditoriums & screen configurations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header & Actions */}
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
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Cinema Screens & Auditoriums</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Task 03
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure screens for <span className="text-white font-semibold">{theatreName}</span>. Screens serve as the foundation for seating layouts and movie show schedules.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Cinema Screen</span>
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl text-red-300 flex items-center gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-emerald-300 flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Screens ({screens.filter((s) => s.status !== 'archived').length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'active'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Active ({screens.filter((s) => s.status === 'active').length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              statusFilter === 'inactive'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Inactive ({screens.filter((s) => s.status === 'inactive').length})
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredScreens.length} auditorium{filteredScreens.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Screen Cards Grid */}
      {filteredScreens.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Tv className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">No Screens Configured Yet</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Add your cinema screens (e.g., Screen 1, Audi 2, IMAX) to start configuring seating arrangements and scheduling daily movie shows.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Screen</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScreens.map((sc) => {
            const isActive = sc.status === 'active';

            return (
              <div
                key={sc.id}
                className={`rounded-3xl border transition flex flex-col justify-between overflow-hidden shadow-xl ${
                  isActive
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-800/60 opacity-80'
                }`}
              >
                {/* Card Top */}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {getScreenTypeBadge(sc.screenType)}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white tracking-tight truncate">
                        {sc.screenName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(sc)}
                        title="Edit screen"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(sc)}
                        title={isActive ? 'Deactivate screen' : 'Activate screen'}
                        className={`p-1.5 rounded-lg transition ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleArchiveScreen(sc)}
                        title="Archive screen"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {sc.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {sc.description}
                    </p>
                  )}

                  {/* Seating and Capacity Statistics (Derived from Task 04 Seating) */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Seating Capacity</span>
                      </div>
                      <p className="text-xl font-black text-white mt-1">
                        {sc.totalSeats > 0 ? sc.totalSeats : 0}
                      </p>
                      <span className="text-[10px] text-slate-500 block">
                        {sc.seatingConfigured ? 'Layout verified' : 'Configured in Task 04'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        <Layers className="w-3.5 h-3.5 text-violet-400" />
                        <span>Total Rows</span>
                      </div>
                      <p className="text-xl font-black text-white mt-1">
                        {sc.totalRows > 0 ? sc.totalRows : 0}
                      </p>
                      <span className="text-[10px] text-slate-500 block">
                        {sc.seatingConfigured ? 'Rows active' : 'Rows A-Z (Task 04)'}
                      </span>
                    </div>
                  </div>

                  {/* Technical Metadata */}
                  <div className="text-[11px] text-slate-500 space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span>Screen ID:</span>
                      <span className="font-mono text-slate-400 truncate max-w-[140px]">{sc.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Created Date:</span>
                      <span className="text-slate-400">{new Date(sc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Card Navigation Footer */}
                <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/cinema/admin/seating?screenId=${sc.id}`}
                    className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold transition truncate"
                  >
                    <Armchair className="w-3.5 h-3.5 shrink-0" />
                    <span>Seating Layout</span>
                  </Link>

                  <Link
                    href={`/cinema/admin/shows?screenId=${sc.id}`}
                    className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white font-semibold transition truncate"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Shows</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Screen */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Cinema Screen</h3>
                  <p className="text-xs text-slate-400">Register a new auditorium under this theatre</p>
                </div>
              </div>

              <button
                onClick={handleCloseModals}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateScreen} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Screen Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Screen 1, Audi 2 (IMAX), Screen 3 (4DX)"
                  value={formData.screenName}
                  onChange={(e) => setFormData({ ...formData, screenName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Screen Projection Type
                </label>
                <select
                  value={formData.screenType}
                  onChange={(e) => setFormData({ ...formData, screenType: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="standard">Standard Digital 2D/3D</option>
                  <option value="imax">IMAX Laser</option>
                  <option value="4dx">4DX Motion & Effects</option>
                  <option value="dolby_atmos">Dolby Atmos Audio</option>
                  <option value="vip">VIP Recliner Lounge</option>
                  <option value="drive_in">Drive-In Open Air</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Notes / Audio Spec <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Christie 4K RGB Laser, Dolby Atmos 7.1"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModals}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalLoading ? 'Creating...' : 'Create Screen'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Screen */}
      {editingScreen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Screen Information</h3>
                  <p className="text-xs text-slate-400">Update auditorium specifications</p>
                </div>
              </div>

              <button
                onClick={handleCloseModals}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateScreen} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Screen Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.screenName}
                  onChange={(e) => setFormData({ ...formData, screenName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Screen Projection Type
                  </label>
                  <select
                    value={formData.screenType}
                    onChange={(e) => setFormData({ ...formData, screenType: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="standard">Standard Digital 2D/3D</option>
                    <option value="imax">IMAX Laser</option>
                    <option value="4dx">4DX Motion & Effects</option>
                    <option value="dolby_atmos">Dolby Atmos Audio</option>
                    <option value="vip">VIP Recliner Lounge</option>
                    <option value="drive_in">Drive-In Open Air</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Operational Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Notes / Audio Spec <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 4K Laser, Dolby Atmos"
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModals}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {modalLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
