'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { CINEMA_LANGUAGES } from '@menugo/shared';
import {
  Film,
  Plus,
  Search,
  Filter,
  Clock,
  Globe,
  Edit2,
  Trash2,
  Archive,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
  Upload,
  ArrowLeft
} from 'lucide-react';

interface CinemaMovie {
  id: string;
  theatreId: string;
  title: string;
  posterUrl?: string | null;
  posterKey?: string | null;
  language: string;
  durationMinutes: number;
  description?: string | null;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export default function CinemaMoviesPage() {
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');
  const [movies, setMovies] = useState<CinemaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<CinemaMovie | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    language: 'Hindi',
    customLanguage: '',
    durationMinutes: 120,
    description: '',
    posterUrl: '',
    status: 'active' as 'active' | 'inactive'
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    loadTheatreAndMovies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTheatreAndMovies = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find user's cinema theatre
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

      await fetchMovies(activeTheatreId);
    } catch (err: any) {
      console.error('Failed to load cinema data:', err);
      setError(err?.message || 'Failed to initialize movie catalogue');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovies = async (tId: string) => {
    try {
      const res = await apiRequest(`/api/cinema/movies?includeArchived=true`, {
        theatreId: tId
      });
      setMovies(res.movies || []);
    } catch (err: any) {
      console.error('Failed to fetch movies:', err);
      setError(err?.message || 'Failed to fetch movies');
    }
  };

  const formatDuration = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours === 0) return `${remainingMins}m`;
    if (remainingMins === 0) return `${hours}h`;
    return `${hours}h ${remainingMins}m`;
  };

  // Upload handler with resilient fallback
  const handleFileUpload = async (file: File): Promise<string> => {
    if (!theatreId) throw new Error('Theatre not initialized');

    // Attempt direct backend upload to R2
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('purpose', 'movies');

      const uploadRes = await fetch('/api/uploads/direct', {
        method: 'POST',
        headers: {
          'x-restaurant-id': theatreId
        },
        body: uploadFormData
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        if (data.publicUrl) return data.publicUrl;
      }
    } catch (uploadErr) {
      console.warn('Backend R2 direct upload unavailable, falling back to local data URL:', uploadErr);
    }

    // Fallback: Read as Data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handlePosterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WEBP, AVIF)');
      return;
    }

    try {
      setUploadingPoster(true);
      setError(null);
      const url = await handleFileUpload(file);
      setFormData((prev) => ({ ...prev, posterUrl: url }));
      setSuccess('Poster image ready for submission');
    } catch (err: any) {
      setError(err?.message || 'Failed to process poster file');
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleQuickPosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMovie || !theatreId) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WEBP, AVIF)');
      return;
    }

    try {
      setUploadingPoster(true);
      setError(null);
      const url = await handleFileUpload(file);

      await apiRequest(`/api/cinema/movies/${selectedMovie.id}/poster`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({ posterUrl: url })
      });

      setSuccess(`Poster updated for "${selectedMovie.title}"`);
      setPosterModalOpen(false);
      await fetchMovies(theatreId);
    } catch (err: any) {
      setError(err?.message || 'Failed to update movie poster');
    } finally {
      setUploadingPoster(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      title: '',
      language: 'Hindi',
      customLanguage: '',
      durationMinutes: 120,
      description: '',
      posterUrl: '',
      status: 'active'
    });
    setAddModalOpen(true);
  };

  const openEditModal = (movie: CinemaMovie) => {
    setSelectedMovie(movie);
    const isStandardLang = CINEMA_LANGUAGES.includes(movie.language as any);
    setFormData({
      title: movie.title,
      language: isStandardLang ? movie.language : 'Other',
      customLanguage: isStandardLang ? '' : movie.language,
      durationMinutes: movie.durationMinutes,
      description: movie.description || '',
      posterUrl: movie.posterUrl || '',
      status: movie.status === 'inactive' ? 'inactive' : 'active'
    });
    setEditModalOpen(true);
  };

  const openDetailsModal = (movie: CinemaMovie) => {
    setSelectedMovie(movie);
    setDetailsModalOpen(true);
  };

  const openPosterModal = (movie: CinemaMovie) => {
    setSelectedMovie(movie);
    setFormData((prev) => ({ ...prev, posterUrl: movie.posterUrl || '' }));
    setPosterModalOpen(true);
  };

  const openDeleteModal = (movie: CinemaMovie) => {
    setSelectedMovie(movie);
    setDeleteModalOpen(true);
  };

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    const resolvedLanguage =
      formData.language === 'Other' && formData.customLanguage.trim()
        ? formData.customLanguage.trim()
        : formData.language;

    if (!formData.title.trim()) {
      setError('Movie title is required');
      return;
    }

    if (!resolvedLanguage.trim()) {
      setError('Language is required');
      return;
    }

    if (!formData.durationMinutes || formData.durationMinutes <= 0) {
      setError('Duration must be greater than 0 minutes');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiRequest('/api/cinema/movies', {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          title: formData.title.trim(),
          language: resolvedLanguage,
          durationMinutes: Number(formData.durationMinutes),
          description: formData.description.trim() || undefined,
          posterUrl: formData.posterUrl.trim() || undefined,
          status: formData.status
        })
      });

      setSuccess(`Movie "${formData.title}" added to catalogue successfully!`);
      setAddModalOpen(false);
      await fetchMovies(theatreId);
    } catch (err: any) {
      console.error('Failed to create movie:', err);
      setError(err?.message || 'Failed to create movie');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !selectedMovie) return;

    const resolvedLanguage =
      formData.language === 'Other' && formData.customLanguage.trim()
        ? formData.customLanguage.trim()
        : formData.language;

    try {
      setSubmitting(true);
      setError(null);

      await apiRequest(`/api/cinema/movies/${selectedMovie.id}`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({
          title: formData.title.trim(),
          language: resolvedLanguage,
          durationMinutes: Number(formData.durationMinutes),
          description: formData.description.trim() || null,
          posterUrl: formData.posterUrl.trim() || null,
          status: formData.status
        })
      });

      setSuccess(`Movie "${formData.title}" updated successfully!`);
      setEditModalOpen(false);
      await fetchMovies(theatreId);
    } catch (err: any) {
      console.error('Failed to update movie:', err);
      setError(err?.message || 'Failed to update movie');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (movie: CinemaMovie) => {
    if (!theatreId) return;
    const newStatus = movie.status === 'active' ? 'inactive' : 'active';

    try {
      setError(null);
      await apiRequest(`/api/cinema/movies/${movie.id}`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({ status: newStatus })
      });

      setSuccess(`Movie "${movie.title}" is now ${newStatus}`);
      await fetchMovies(theatreId);
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleDeleteOrArchive = async (permanent: boolean) => {
    if (!theatreId || !selectedMovie) return;

    try {
      setSubmitting(true);
      setError(null);

      await apiRequest(`/api/cinema/movies/${selectedMovie.id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
        theatreId
      });

      setSuccess(
        permanent
          ? `Movie "${selectedMovie.title}" permanently removed`
          : `Movie "${selectedMovie.title}" safely archived`
      );
      setDeleteModalOpen(false);
      await fetchMovies(theatreId);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete movie');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered list
  const filteredMovies = movies.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (languageFilter !== 'all' && m.language.toLowerCase() !== languageFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.language.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Unique languages in theatre catalogue for filter pills
  const availableLanguages = Array.from(new Set(movies.map((m) => m.language)));

  const activeCount = movies.filter((m) => m.status === 'active').length;
  const inactiveCount = movies.filter((m) => m.status === 'inactive').length;
  const archivedCount = movies.filter((m) => m.status === 'archived').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading Movie Catalogue...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
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
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Movie Catalogue</h1>
              <p className="text-xs text-slate-400 font-medium">
                {theatreName} • Master Movie Repository for Daily Show Scheduling
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => theatreId && fetchMovies(theatreId)}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 sm:px-5 rounded-xl transition shadow-lg shadow-indigo-600/25 text-xs sm:text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Movie</span>
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

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-emerald-300 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Titles</span>
            <Film className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{movies.length}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Active Films</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Inactive Films</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{inactiveCount}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Languages</span>
            <Globe className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black text-sky-400">{availableLanguages.length}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movie title or description..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({movies.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'active' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'inactive' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
            {archivedCount > 0 && (
              <button
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  statusFilter === 'archived' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Archived ({archivedCount})
              </button>
            )}
          </div>

          {/* Language selector */}
          {availableLanguages.length > 1 && (
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Languages</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Movies Grid */}
      {filteredMovies.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Film className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">No Movies Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {movies.length === 0
              ? 'Your theatre catalogue is empty. Add your first film with its language, duration, and poster to enable daily show scheduling.'
              : 'No movies match your current search and filter criteria. Try clearing the filters.'}
          </p>
          {movies.length === 0 && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Movie</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMovies.map((movie) => {
            const isActive = movie.status === 'active';
            const isArchived = movie.status === 'archived';

            return (
              <div
                key={movie.id}
                className={`group bg-slate-900/70 border rounded-3xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 ${
                  isActive
                    ? 'border-slate-800 hover:border-slate-700'
                    : isArchived
                    ? 'border-slate-800/50 opacity-60'
                    : 'border-amber-500/30 hover:border-amber-500/50'
                }`}
              >
                {/* Poster Area */}
                <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden flex items-center justify-center">
                  {movie.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-700 space-y-2 p-4 text-center">
                      <Film className="w-12 h-12 text-slate-800" />
                      <span className="text-[11px] font-semibold text-slate-500">No poster uploaded</span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-md ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 backdrop-blur-md'
                          : isArchived
                          ? 'bg-slate-700/50 text-slate-300 border-slate-600/50 backdrop-blur-md'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30 backdrop-blur-md'
                      }`}
                    >
                      {movie.status}
                    </span>
                  </div>

                  {/* Duration Tag */}
                  <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-950/80 text-slate-200 border border-slate-800/80 backdrop-blur-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      {formatDuration(movie.durationMinutes)}
                    </span>
                  </div>

                  {/* Language Pill */}
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600/80 text-white backdrop-blur-md border border-indigo-400/30 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {movie.language}
                    </span>
                  </div>

                  {/* Change Poster Button */}
                  <button
                    onClick={() => openPosterModal(movie)}
                    className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Change Poster"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content Area */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-black text-lg text-white tracking-tight line-clamp-1 group-hover:text-indigo-400 transition-colors">
                      {movie.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {movie.description || 'No description provided for this movie catalogue entry.'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openDetailsModal(movie)}
                      className="flex-1 py-2 px-3 bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Details</span>
                    </button>

                    <button
                      onClick={() => openEditModal(movie)}
                      className="p-2 bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition"
                      title="Edit Movie"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleStatus(movie)}
                      className={`p-2 rounded-xl transition ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title={isActive ? 'Deactivate Film' : 'Activate Film'}
                    >
                      {isActive ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => openDeleteModal(movie)}
                      className="p-2 bg-slate-800/70 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition"
                      title="Archive or Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADD MOVIE MODAL */}
      {/* ==================================================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Add New Movie</h3>
                  <p className="text-xs text-slate-400">Create a master movie entry for show scheduling</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMovie} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Movie Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Inception, KGF: Chapter 2, Interstellar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Language & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CINEMA_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>

                  {formData.language === 'Other' && (
                    <input
                      type="text"
                      placeholder="Specify language..."
                      value={formData.customLanguage}
                      onChange={(e) => setFormData({ ...formData, customLanguage: e.target.value })}
                      className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Duration (Minutes) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={600}
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400">
                      {formatDuration(formData.durationMinutes)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Poster Upload & URL */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Movie Poster Image
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.posterUrl}
                    onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                    placeholder="Paste image URL or choose file..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePosterFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPoster}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition border border-slate-700"
                  >
                    {uploadingPoster ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{uploadingPoster ? 'Uploading...' : 'Browse'}</span>
                  </button>
                </div>

                {formData.posterUrl && (
                  <div className="mt-3 relative w-32 aspect-[2/3] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.posterUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, posterUrl: '' })}
                      className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 rounded-md text-slate-300 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description / Synopsis (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short movie summary, director, cast, or genre notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
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
                  <span>Save Movie</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EDIT MOVIE MODAL */}
      {/* ==================================================================== */}
      {editModalOpen && selectedMovie && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Edit Movie</h3>
                  <p className="text-xs text-slate-400">{selectedMovie.title}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateMovie} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Movie Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CINEMA_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>

                  {formData.language === 'Other' && (
                    <input
                      type="text"
                      placeholder="Specify language..."
                      value={formData.customLanguage}
                      onChange={(e) => setFormData({ ...formData, customLanguage: e.target.value })}
                      className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Duration (Minutes) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={600}
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400">
                      {formatDuration(formData.durationMinutes)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Poster Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.posterUrl}
                    onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                    placeholder="Paste image URL..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePosterFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPoster}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition border border-slate-700"
                  >
                    {uploadingPoster ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{uploadingPoster ? 'Uploading...' : 'Browse'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Status
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={formData.status === 'active'}
                      onChange={() => setFormData({ ...formData, status: 'active' })}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span className="text-emerald-400">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={formData.status === 'inactive'}
                      onChange={() => setFormData({ ...formData, status: 'inactive' })}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span className="text-amber-400">Inactive</span>
                  </label>
                </div>
              </div>

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
                  <span>Update Movie</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* POSTER UPDATE MODAL */}
      {/* ==================================================================== */}
      {posterModalOpen && selectedMovie && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">Update Movie Poster</h3>
              </div>
              <button
                onClick={() => setPosterModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Select or upload a high-resolution portrait poster for <span className="text-white font-bold">{selectedMovie.title}</span>.
            </p>

            <div className="space-y-4">
              {/* Drag & drop or pick */}
              <div
                onClick={() => posterFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition text-center group"
              >
                <input
                  type="file"
                  ref={posterFileInputRef}
                  onChange={handleQuickPosterUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">Click to upload new image</p>
                <p className="text-[10px] text-slate-500 mt-1">JPEG, PNG, WEBP or AVIF (Max 5MB)</p>
              </div>

              {uploadingPoster && (
                <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading poster...</span>
                </div>
              )}

              {/* Or paste link */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Or direct image link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.posterUrl}
                    onChange={(e) => setFormData({ ...formData, posterUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={async () => {
                      if (!theatreId || !formData.posterUrl.trim()) return;
                      try {
                        setSubmitting(true);
                        await apiRequest(`/api/cinema/movies/${selectedMovie.id}/poster`, {
                          method: 'PATCH',
                          theatreId,
                          body: JSON.stringify({ posterUrl: formData.posterUrl.trim() })
                        });
                        setSuccess('Poster URL updated successfully');
                        setPosterModalOpen(false);
                        await fetchMovies(theatreId);
                      } catch (err: any) {
                        setError(err?.message || 'Failed to update poster');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
                  >
                    Save URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW DETAILS MODAL */}
      {/* ==================================================================== */}
      {detailsModalOpen && selectedMovie && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-base font-black text-white">Movie Catalogue Details</h3>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="w-28 aspect-[2/3] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                {selectedMovie.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-8 h-8 text-slate-700" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    selectedMovie.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {selectedMovie.status}
                </span>

                <h2 className="text-xl font-black text-white">{selectedMovie.title}</h2>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    {selectedMovie.language}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {formatDuration(selectedMovie.durationMinutes)} ({selectedMovie.durationMinutes} mins)
                  </span>
                </div>

                <div className="pt-2 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-400">Movie ID: </span>
                  <span className="text-indigo-400 select-all font-bold">{selectedMovie.id}</span>
                </div>
              </div>
            </div>

            {selectedMovie.description && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Synopsis</p>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedMovie.description}</p>
              </div>
            )}

            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Added to theatre: {new Date(selectedMovie.createdAt).toLocaleDateString()}</span>
              <span>Updated: {new Date(selectedMovie.updatedAt).toLocaleDateString()}</span>
            </div>

            <div className="pt-5 border-t border-slate-800 flex items-center justify-end gap-3 mt-5">
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

      {/* ==================================================================== */}
      {/* DELETE / ARCHIVE MODAL */}
      {/* ==================================================================== */}
      {deleteModalOpen && selectedMovie && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-center text-white">Manage Movie Removal</h3>
            <p className="text-xs text-slate-400 text-center mt-2 leading-relaxed">
              Choose how you want to remove <span className="text-white font-bold">{selectedMovie.title}</span>.
              Archiving hides the film from new show scheduling while protecting all past order history.
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleDeleteOrArchive(false)}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition"
              >
                <Archive className="w-4 h-4" />
                <span>Safely Archive Movie (Recommended)</span>
              </button>

              <button
                onClick={() => handleDeleteOrArchive(true)}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition border border-slate-700 hover:border-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete Record</span>
              </button>

              <button
                onClick={() => setDeleteModalOpen(false)}
                className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
