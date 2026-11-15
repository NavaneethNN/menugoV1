'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import {
  CalendarDays,
  Clock,
  Film,
  Tv,
  Plus,
  Copy,
  CheckCircle2,
  AlertTriangle,
  X,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Send,
  Ban,
  UtensilsCrossed,
  Sparkles,
  Info
} from 'lucide-react';

interface CinemaScreen {
  id: string;
  screenName: string;
  screenType: string;
  totalSeats: number;
}

interface CinemaMovie {
  id: string;
  title: string;
  language: string;
  durationMinutes: number;
  posterUrl?: string | null;
}

interface CinemaShow {
  id: string;
  theatreId: string;
  screenId: string;
  movieId: string;
  showDate: string;
  startTime: string;
  expectedEndTime: string;
  orderingStartTime: string;
  orderingEndTime: string;
  turnaroundBufferMinutes: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  cancellationReason?: string | null;
  screenName: string;
  screenType: string;
  movieTitle: string;
  moviePosterUrl?: string | null;
  movieLanguage: string;
  movieDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export default function CinemaShowsPage() {
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');
  const [shows, setShows] = useState<CinemaShow[]>([]);
  const [screens, setScreens] = useState<CinemaScreen[]>([]);
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Selected date (defaults to today 'YYYY-MM-DD')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]!;
  });

  // Filters
  const [screenFilter, setScreenFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [selectedShow, setSelectedShow] = useState<CinemaShow | null>(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    screenId: '',
    movieId: '',
    showDate: '',
    startTime: '',
    expectedEndTime: '',
    orderingStartTime: '',
    orderingEndTime: '',
    turnaroundBufferMinutes: 15,
    status: 'draft' as 'draft' | 'published' | 'cancelled' | 'completed'
  });

  // Cancellation State
  const [cancellationReason, setCancellationReason] = useState('');

  // Copy Schedule State
  const [copyData, setCopyData] = useState({
    sourceDate: '',
    targetDate: '',
    screenId: 'all'
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theatreId) {
      fetchShows(theatreId, selectedDate);
    }
  }, [selectedDate, theatreId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const myMemberships = await apiRequest('/api/restaurants/my');
      const cinemaMembership = myMemberships.find(
        (m: any) => m.restaurant?.tenantType === 'cinema'
      );

      if (!cinemaMembership?.restaurant?.id) {
        setError('No cinema theatre account found. Please register a theatre first.');
        setLoading(false);
        return;
      }

      const activeTheatreId = cinemaMembership.restaurant.id;
      setTheatreId(activeTheatreId);
      setTheatreName(cinemaMembership.restaurant.name);

      // Fetch Screens
      const screensRes = await apiRequest('/api/cinema/screens', {
        theatreId: activeTheatreId
      });
      const activeScreens = (screensRes.screens || []).filter(
        (s: any) => s.status !== 'archived'
      );
      setScreens(activeScreens);

      // Fetch Movies
      const moviesRes = await apiRequest('/api/cinema/movies', {
        theatreId: activeTheatreId
      });
      const activeMovies = (moviesRes.movies || []).filter(
        (m: any) => m.status !== 'archived'
      );
      setMovies(activeMovies);

      // Fetch Shows for current date
      await fetchShows(activeTheatreId, selectedDate);
    } catch (err: any) {
      console.error('Failed to initialize shows page:', err);
      setError(err?.message || 'Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  };

  const fetchShows = async (tId: string, date: string) => {
    try {
      const res = await apiRequest(`/api/cinema/shows?showDate=${date}&includeCancelled=true`, {
        theatreId: tId
      });
      setShows(res.shows || []);
    } catch (err: any) {
      console.error('Failed to fetch shows:', err);
      setError(err?.message || 'Failed to load shows for selected date');
    }
  };

  const handlePrevDay = () => {
    const cur = new Date(`${selectedDate}T00:00:00`);
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(cur.toISOString().split('T')[0]!);
  };

  const handleNextDay = () => {
    const cur = new Date(`${selectedDate}T00:00:00`);
    cur.setDate(cur.getDate() + 1);
    setSelectedDate(cur.toISOString().split('T')[0]!);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0]!;
    setSelectedDate(today);
  };

  // Helper to calculate end time and ordering times when movie or start time changes
  const handleStartTimeChange = (startStr: string, currentMovieId = formData.movieId) => {
    const targetMovie = movies.find((m) => m.id === currentMovieId);
    if (!startStr) {
      setFormData((prev) => ({ ...prev, startTime: startStr }));
      return;
    }

    const start = new Date(startStr);
    const durationMins = targetMovie?.durationMinutes || 120;
    const end = new Date(start.getTime() + durationMins * 60 * 1000);

    // Food ordering defaults: opens 30m before show, closes 30m before show end
    const ordStart = new Date(start.getTime() - 30 * 60 * 1000);
    const ordEnd = new Date(end.getTime() - 30 * 60 * 1000);

    const toLocalISO = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData((prev) => ({
      ...prev,
      startTime: startStr,
      expectedEndTime: toLocalISO(end),
      orderingStartTime: toLocalISO(ordStart),
      orderingEndTime: toLocalISO(ordEnd)
    }));
  };

  const handleMovieChange = (mId: string) => {
    setFormData((prev) => ({ ...prev, movieId: mId }));
    if (formData.startTime) {
      handleStartTimeChange(formData.startTime, mId);
    }
  };

  const openCreateModal = () => {
    const defaultScreenId = screens[0]?.id || '';
    const defaultMovieId = movies[0]?.id || '';

    // Default start time: today at 10:00 AM
    const start = new Date(`${selectedDate}T10:00:00`);
    const durationMins = movies[0]?.durationMinutes || 120;
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    const ordStart = new Date(start.getTime() - 30 * 60 * 1000);
    const ordEnd = new Date(end.getTime() - 30 * 60 * 1000);

    const toLocalISO = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      screenId: defaultScreenId,
      movieId: defaultMovieId,
      showDate: selectedDate,
      startTime: toLocalISO(start),
      expectedEndTime: toLocalISO(end),
      orderingStartTime: toLocalISO(ordStart),
      orderingEndTime: toLocalISO(ordEnd),
      turnaroundBufferMinutes: 15,
      status: 'draft'
    });
    setCreateModalOpen(true);
  };

  const openEditModal = (show: CinemaShow) => {
    setSelectedShow(show);
    const toLocalISO = (isoStr: string) => {
      const d = new Date(isoStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      screenId: show.screenId,
      movieId: show.movieId,
      showDate: show.showDate,
      startTime: toLocalISO(show.startTime),
      expectedEndTime: toLocalISO(show.expectedEndTime),
      orderingStartTime: toLocalISO(show.orderingStartTime),
      orderingEndTime: toLocalISO(show.orderingEndTime),
      turnaroundBufferMinutes: show.turnaroundBufferMinutes,
      status: show.status === 'cancelled' ? 'draft' : show.status
    });
    setEditModalOpen(true);
  };

  const openDetailsModal = (show: CinemaShow) => {
    setSelectedShow(show);
    setDetailsModalOpen(true);
  };

  const openCancelModal = (show: CinemaShow) => {
    setSelectedShow(show);
    setCancellationReason('');
    setCancelModalOpen(true);
  };

  const openCopyModal = () => {
    // Default target date: tomorrow
    const cur = new Date(`${selectedDate}T00:00:00`);
    cur.setDate(cur.getDate() + 1);
    setCopyData({
      sourceDate: selectedDate,
      targetDate: cur.toISOString().split('T')[0]!,
      screenId: 'all'
    });
    setCopyModalOpen(true);
  };

  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    try {
      setSubmitting(true);
      setError(null);

      await apiRequest('/api/cinema/shows', {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          screenId: formData.screenId,
          movieId: formData.movieId,
          showDate: formData.showDate,
          startTime: new Date(formData.startTime).toISOString(),
          expectedEndTime: new Date(formData.expectedEndTime).toISOString(),
          orderingStartTime: new Date(formData.orderingStartTime).toISOString(),
          orderingEndTime: new Date(formData.orderingEndTime).toISOString(),
          turnaroundBufferMinutes: Number(formData.turnaroundBufferMinutes),
          status: formData.status
        })
      });

      setSuccess('Show scheduled successfully!');
      setCreateModalOpen(false);
      await fetchShows(theatreId, selectedDate);
    } catch (err: any) {
      console.error('Failed to create show:', err);
      setError(err?.message || 'Failed to schedule show');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !selectedShow) return;

    try {
      setSubmitting(true);
      setError(null);
      setWarning(null);

      const res = await apiRequest(`/api/cinema/shows/${selectedShow.id}`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({
          screenId: formData.screenId,
          movieId: formData.movieId,
          showDate: formData.showDate,
          startTime: new Date(formData.startTime).toISOString(),
          expectedEndTime: new Date(formData.expectedEndTime).toISOString(),
          orderingStartTime: new Date(formData.orderingStartTime).toISOString(),
          orderingEndTime: new Date(formData.orderingEndTime).toISOString(),
          turnaroundBufferMinutes: Number(formData.turnaroundBufferMinutes),
          status: formData.status
        })
      });

      if (res.warning) {
        setWarning(res.warning);
      }
      setSuccess('Show updated successfully!');
      setEditModalOpen(false);
      await fetchShows(theatreId, selectedDate);
    } catch (err: any) {
      console.error('Failed to update show:', err);
      setError(err?.message || 'Failed to update show');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishShow = async (show: CinemaShow) => {
    if (!theatreId) return;

    try {
      setError(null);
      await apiRequest(`/api/cinema/shows/${show.id}/publish`, {
        method: 'POST',
        theatreId
      });

      setSuccess(`Show "${show.movieTitle}" published! Now open for customer ordering.`);
      await fetchShows(theatreId, selectedDate);
    } catch (err: any) {
      setError(err?.message || 'Failed to publish show');
    }
  };

  const handleCancelShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !selectedShow || !cancellationReason.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      await apiRequest(`/api/cinema/shows/${selectedShow.id}/cancel`, {
        method: 'POST',
        theatreId,
        body: JSON.stringify({ cancellationReason: cancellationReason.trim() })
      });

      setSuccess(`Show "${selectedShow.movieTitle}" cancelled successfully.`);
      setCancelModalOpen(false);
      await fetchShows(theatreId, selectedDate);
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel show');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await apiRequest('/api/cinema/shows/copy-schedule', {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          sourceDate: copyData.sourceDate,
          targetDate: copyData.targetDate,
          screenId: copyData.screenId === 'all' ? undefined : copyData.screenId
        })
      });

      setSuccess(res.message || 'Schedule copied successfully as drafts!');
      setCopyModalOpen(false);
      setSelectedDate(copyData.targetDate);
    } catch (err: any) {
      setError(err?.message || 'Failed to copy schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShow = async (show: CinemaShow) => {
    if (!theatreId) return;
    const confirmDelete = window.confirm(`Permanently delete show "${show.movieTitle}"?`);
    if (!confirmDelete) return;

    try {
      setError(null);
      await apiRequest(`/api/cinema/shows/${show.id}?permanent=true`, {
        method: 'DELETE',
        theatreId
      });

      setSuccess('Show permanently deleted');
      await fetchShows(theatreId, selectedDate);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete show');
    }
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const checkMidnightCross = (startIso: string, endIso: string) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return s.getDate() !== e.getDate();
  };

  const filteredShows = shows.filter((s) => {
    if (screenFilter !== 'all' && s.screenId !== screenFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const publishedCount = shows.filter((s) => s.status === 'published').length;
  const draftCount = shows.filter((s) => s.status === 'draft').length;
  const cancelledCount = shows.filter((s) => s.status === 'cancelled').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-slate-400 font-medium">Loading Daily Show Scheduling...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Daily Show Scheduling</h1>
              <p className="text-xs text-slate-400 font-medium">
                {theatreName} • Schedule Daily Screen Lineups & In-Seat Concession Windows
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => theatreId && fetchShows(theatreId, selectedDate)}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={openCopyModal}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2.5 px-4 rounded-xl transition text-xs"
          >
            <Copy className="w-4 h-4 text-indigo-400" />
            <span>Copy Schedule</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl transition shadow-lg shadow-indigo-600/25 text-xs sm:text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Show</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-sm animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {warning && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-300 text-sm animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{warning}</div>
          <button onClick={() => setWarning(null)} className="text-amber-400 hover:text-amber-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date Navigation & Stats Strip */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Date Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handlePrevDay}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative flex-1 md:w-56">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 text-center"
            />
          </div>

          <button
            onClick={handleNextDay}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleToday}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
          >
            Today
          </button>
        </div>

        {/* Operating Date Overview & Stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Total Shows:</span>
            <span className="font-black text-white">{shows.length}</span>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Published:</span>
            <span className="font-black text-emerald-400">{publishedCount}</span>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Drafts:</span>
            <span className="font-black text-amber-400">{draftCount}</span>
          </div>

          {cancelledCount > 0 && (
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Cancelled:</span>
              <span className="font-black text-rose-400">{cancelledCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Screen & Status Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
        {/* Screen selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Screen:</span>
          <select
            value={screenFilter}
            onChange={(e) => setScreenFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
          >
            <option value="all">All Screens ({screens.length})</option>
            {screens.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.screenName} ({sc.screenType.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Status filters */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex-1 sm:flex-initial ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex-1 sm:flex-initial ${
              statusFilter === 'published' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Published ({publishedCount})
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex-1 sm:flex-initial ${
              statusFilter === 'draft' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Drafts ({draftCount})
          </button>
          {cancelledCount > 0 && (
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex-1 sm:flex-initial ${
                statusFilter === 'cancelled' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cancelled
            </button>
          )}
        </div>
      </div>

      {/* Shows List */}
      {filteredShows.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <CalendarDays className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">No Shows Scheduled</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            There are no shows scheduled for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Show</span>
            </button>
            <button
              onClick={openCopyModal}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-5 rounded-xl transition text-xs"
            >
              <Copy className="w-4 h-4 text-indigo-400" />
              <span>Copy From Another Date</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShows.map((show) => {
            const isMidnight = checkMidnightCross(show.startTime, show.expectedEndTime);
            const isPublished = show.status === 'published';
            const isCancelled = show.status === 'cancelled';
            const isDraft = show.status === 'draft';

            return (
              <div
                key={show.id}
                className={`bg-slate-900/70 border rounded-3xl p-5 md:p-6 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
                  isPublished
                    ? 'border-emerald-500/30 bg-emerald-950/5'
                    : isCancelled
                    ? 'border-rose-900/40 bg-rose-950/5 opacity-70'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Left: Movie & Screen Info */}
                <div className="flex items-start gap-4 flex-1">
                  {/* Poster */}
                  <div className="w-16 h-24 bg-slate-950 rounded-xl overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                    {show.moviePosterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={show.moviePosterUrl} alt={show.movieTitle} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-6 h-6 text-slate-700" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isPublished
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : isCancelled
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {show.status}
                      </span>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {show.screenName}
                      </span>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                        {show.screenType.toUpperCase()}
                      </span>

                      {isMidnight && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Crosses Midnight (+1 Day)
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white tracking-tight truncate">{show.movieTitle}</h3>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{show.movieLanguage}</span>
                      <span>•</span>
                      <span>{show.movieDurationMinutes} mins</span>
                      <span>•</span>
                      <span className="text-slate-500 font-mono text-[11px]">{show.turnaroundBufferMinutes}m cleaning buffer</span>
                    </div>

                    {show.cancellationReason && (
                      <p className="text-xs text-rose-400 pt-1">
                        Reason: {show.cancellationReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Center: Showtime & Concession Timing */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border-y lg:border-y-0 lg:border-x border-slate-800/80 py-4 lg:py-0 lg:px-6">
                  {/* Showtime */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>Movie Showtime</span>
                    </p>
                    <p className="text-base font-black text-white">
                      {formatTime(show.startTime)} – {formatTime(show.expectedEndTime)}
                      {isMidnight && <span className="text-[10px] text-purple-400 ml-1 font-bold">+1d</span>}
                    </p>
                  </div>

                  {/* Ordering Window */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <UtensilsCrossed className="w-3 h-3 text-amber-400" />
                      <span>Food Ordering Window</span>
                    </p>
                    <p className="text-xs font-semibold text-slate-300">
                      {formatTime(show.orderingStartTime)} – {formatTime(show.orderingEndTime)}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openDetailsModal(show)}
                    className="p-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {isDraft && (
                    <button
                      onClick={() => handlePublishShow(show)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish</span>
                    </button>
                  )}

                  {!isCancelled && (
                    <button
                      onClick={() => openEditModal(show)}
                      className="p-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition"
                      title="Edit Show"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {!isCancelled && (
                    <button
                      onClick={() => openCancelModal(show)}
                      className="p-2.5 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition"
                      title="Cancel Show"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}

                  {isDraft && (
                    <button
                      onClick={() => handleDeleteShow(show)}
                      className="p-2.5 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition"
                      title="Permanently Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SCHEDULE SHOW MODAL */}
      {/* ==================================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Schedule Movie Show</h3>
                  <p className="text-xs text-slate-400">Configure showtime, screen and ordering window</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShow} className="space-y-4">
              {/* Screen & Movie selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Screen *
                  </label>
                  <select
                    required
                    value={formData.screenId}
                    onChange={(e) => setFormData({ ...formData, screenId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {screens.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.screenName} ({sc.screenType.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Movie *
                  </label>
                  <select
                    required
                    value={formData.movieId}
                    onChange={(e) => handleMovieChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {movies.map((mv) => (
                      <option key={mv.id} value={mv.id}>
                        {mv.title} ({mv.durationMinutes}m • {mv.language})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Operating Date & Show Start */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Operating Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.showDate}
                    onChange={(e) => setFormData({ ...formData, showDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Show Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Automatic Timing Calculation Card */}
              {formData.startTime && formData.expectedEndTime && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-indigo-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Auto-Calculated Schedule</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {formData.turnaroundBufferMinutes}m cleaning buffer
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Movie Showtime</span>
                      <span className="font-bold text-white text-xs">
                        {formatTime(formData.startTime)} – {formatTime(formData.expectedEndTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Food Concession Window</span>
                      <span className="font-bold text-amber-400 text-xs">
                        {formatTime(formData.orderingStartTime)} – {formatTime(formData.orderingEndTime)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Timing Customization Accordion */}
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/40 p-3.5 transition-all text-xs">
                <summary className="font-bold text-slate-400 hover:text-indigo-400 cursor-pointer list-none flex items-center justify-between">
                  <span>+ Customize Cut-off & End Times (Optional)</span>
                  <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      Expected End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expectedEndTime}
                      onChange={(e) => setFormData({ ...formData, expectedEndTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      Cleaning Buffer (Mins)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={formData.turnaroundBufferMinutes}
                      onChange={(e) =>
                        setFormData({ ...formData, turnaroundBufferMinutes: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      Ordering Opens
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.orderingStartTime}
                      onChange={(e) => setFormData({ ...formData, orderingStartTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      Ordering Closes (Cut-off)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.orderingEndTime}
                      onChange={(e) => setFormData({ ...formData, orderingEndTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </details>

              {/* Status */}
              <div>
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.status === 'published'}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.checked ? 'published' : 'draft' })
                    }
                    className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Publish immediately
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Customers can immediately view and place in-seat food orders
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-indigo-600/30"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Show</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EDIT SHOW MODAL */}
      {/* ==================================================================== */}
      {editModalOpen && selectedShow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Edit Show</h3>
                  <p className="text-xs text-slate-400">{selectedShow.movieTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedShow.status === 'published' && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Notice: This show is already <strong>published</strong>. Modifying times may affect arriving customers.
                </span>
              </div>
            )}

            <form onSubmit={handleUpdateShow} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Screen
                  </label>
                  <select
                    value={formData.screenId}
                    onChange={(e) => setFormData({ ...formData, screenId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {screens.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.screenName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Movie
                  </label>
                  <select
                    value={formData.movieId}
                    onChange={(e) => handleMovieChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {movies.map((mv) => (
                      <option key={mv.id} value={mv.id}>
                        {mv.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Operating Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.showDate}
                    onChange={(e) => setFormData({ ...formData, showDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Timing Overview */}
              {formData.startTime && formData.expectedEndTime && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-indigo-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Calculated Timing</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {formData.turnaroundBufferMinutes}m buffer
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Showtime</span>
                      <span className="font-bold text-white text-xs">
                        {formatTime(formData.startTime)} – {formatTime(formData.expectedEndTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ordering Window</span>
                      <span className="font-bold text-amber-400 text-xs">
                        {formatTime(formData.orderingStartTime)} – {formatTime(formData.orderingEndTime)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Customization Accordion */}
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/40 p-3.5 transition-all text-xs">
                <summary className="font-bold text-slate-400 hover:text-indigo-400 cursor-pointer list-none flex items-center justify-between">
                  <span>+ Customize Cut-off & End Times (Optional)</span>
                  <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 mt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Expected End Time</label>
                    <input
                      type="datetime-local"
                      value={formData.expectedEndTime}
                      onChange={(e) => setFormData({ ...formData, expectedEndTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Cleaning Buffer (Mins)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={formData.turnaroundBufferMinutes}
                      onChange={(e) =>
                        setFormData({ ...formData, turnaroundBufferMinutes: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Ordering Opens</label>
                    <input
                      type="datetime-local"
                      value={formData.orderingStartTime}
                      onChange={(e) => setFormData({ ...formData, orderingStartTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Ordering Closes</label>
                    <input
                      type="datetime-local"
                      value={formData.orderingEndTime}
                      onChange={(e) => setFormData({ ...formData, orderingEndTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </details>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-indigo-600/30"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Update Show</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CANCEL SHOW MODAL */}
      {/* ==================================================================== */}
      {cancelModalOpen && selectedShow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Ban className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-center text-white">Cancel Movie Show</h3>
            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
              Are you sure you want to cancel <span className="text-white font-bold">{selectedShow.movieTitle}</span> on{' '}
              {selectedShow.screenName}? Customers will no longer be able to place concession orders.
            </p>

            <form onSubmit={handleCancelShow} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Projector technical fault, auditorium maintenance, distributor recall..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || !cancellationReason.trim()}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-rose-600/30"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* COPY SCHEDULE MODAL */}
      {/* ==================================================================== */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Copy Previous Schedule</h3>
              </div>
              <button
                onClick={() => setCopyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Replicate an entire day&apos;s show lineup to another operating date. Copied shows are created as{' '}
              <strong className="text-amber-400">drafts</strong> so you can review them before publishing.
            </p>

            <form onSubmit={handleCopySchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Source Date (Copy from) *
                </label>
                <input
                  type="date"
                  required
                  value={copyData.sourceDate}
                  onChange={(e) => setCopyData({ ...copyData, sourceDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Target Date (Paste to) *
                </label>
                <input
                  type="date"
                  required
                  value={copyData.targetDate}
                  onChange={(e) => setCopyData({ ...copyData, targetDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Screen Filter
                </label>
                <select
                  value={copyData.screenId}
                  onChange={(e) => setCopyData({ ...copyData, screenId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Screens</option>
                  {screens.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.screenName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || copyData.sourceDate === copyData.targetDate}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-indigo-600/30"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Copy Lineup</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SHOW DETAILS MODAL */}
      {/* ==================================================================== */}
      {detailsModalOpen && selectedShow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-black text-white">Show Details</h3>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="w-20 aspect-[2/3] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                {selectedShow.moviePosterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedShow.moviePosterUrl} alt={selectedShow.movieTitle} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-8 h-8 text-slate-700" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    selectedShow.status === 'published'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : selectedShow.status === 'cancelled'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {selectedShow.status}
                </span>

                <h2 className="text-xl font-black text-white">{selectedShow.movieTitle}</h2>
                <p className="text-xs text-indigo-400 font-bold">{selectedShow.screenName} • {selectedShow.screenType.toUpperCase()}</p>
                <p className="text-[11px] text-slate-400">Date: {selectedShow.showDate}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Movie Showtime:</span>
                <span className="font-bold text-white">
                  {formatTime(selectedShow.startTime)} – {formatTime(selectedShow.expectedEndTime)}
                </span>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Ordering Window:</span>
                <span className="font-bold text-amber-400">
                  {formatTime(selectedShow.orderingStartTime)} – {formatTime(selectedShow.orderingEndTime)}
                </span>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Cleaning Buffer:</span>
                <span className="font-bold text-slate-300">{selectedShow.turnaroundBufferMinutes} minutes</span>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Show ID:</span>
                <span className="text-indigo-400 select-all font-bold">{selectedShow.id}</span>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
