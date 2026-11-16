'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import {
  Armchair,
  Tv,
  Film,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit,
  Power,
  PowerOff,
  Trash2,
  ArrowLeft,
  X,
  Layers,
  Users,
  Sparkles,
  Info,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

interface CinemaScreen {
  id: string;
  screenName: string;
  screenType: string;
  status: string;
  totalRows: number;
  totalSeats: number;
  seatingConfigured: boolean;
}

interface CinemaSeat {
  id: string;
  theatreId: string;
  screenId: string;
  rowId: string;
  rowIdentifier: string;
  seatNumber: number;
  seatIdentifier: string;
  seatCategory: 'regular' | 'premium' | 'recliner' | 'vip';
  status: 'active' | 'inactive' | 'archived';
}

interface CinemaRow {
  id: string;
  theatreId: string;
  screenId: string;
  rowIdentifier: string;
  sortOrder: number;
  startSeatNumber: number;
  endSeatNumber: number;
  totalSeats: number;
  seatCategory: 'regular' | 'premium' | 'recliner' | 'vip';
  status: 'active' | 'inactive' | 'archived';
  seats: CinemaSeat[];
}

export default function CinemaAdminSeatingPage() {
  const searchParams = useSearchParams();
  const initialScreenId = searchParams.get('screenId');

  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [screens, setScreens] = useState<CinemaScreen[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');

  const [seatingData, setSeatingData] = useState<{
    screen: CinemaScreen | null;
    rows: CinemaRow[];
    totalRows: number;
    totalSeats: number;
    categoryBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Row Modal State
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [rowFormData, setRowFormData] = useState({
    rowIdentifier: '',
    startSeatNumber: 1,
    endSeatNumber: 20,
    seatCategory: 'regular' as 'regular' | 'premium' | 'recliner' | 'vip',
    status: 'active' as 'active' | 'inactive'
  });

  // Edit Row Modal State
  const [editingRow, setEditingRow] = useState<CinemaRow | null>(null);

  // Seat Action Popover / Modal State
  const [selectedSeat, setSelectedSeat] = useState<CinemaSeat | null>(null);
  const [seatFormData, setSeatFormData] = useState({
    seatCategory: 'regular' as 'regular' | 'premium' | 'recliner' | 'vip',
    status: 'active' as 'active' | 'inactive'
  });

  // Add Individual Seat Modal
  const [addingSeatToRow, setAddingSeatToRow] = useState<CinemaRow | null>(null);
  const [singleSeatNumber, setSingleSeatNumber] = useState<number>(1);

  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadScreens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScreens = async () => {
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

      // Fetch screens
      const res = await apiRequest('/api/cinema/screens', {
        theatreId: activeId
      });

      const screenList: CinemaScreen[] = res.screens || [];
      setScreens(screenList);

      if (screenList.length > 0) {
        const matching = initialScreenId && screenList.some((s) => s.id === initialScreenId)
          ? initialScreenId
          : screenList[0]!.id;
        setSelectedScreenId(matching);
        await loadSeatingLayout(activeId, matching);
      }
    } catch (err: any) {
      console.error('Failed to load screens:', err);
      setError(err?.message || 'Failed to fetch cinema screens');
    } finally {
      setLoading(false);
    }
  };

  const loadSeatingLayout = async (tId: string, screenId: string) => {
    try {
      setSeatingLoading(true);
      setModalError(null);

      const data = await apiRequest(`/api/cinema/screens/${screenId}/seating`, {
        theatreId: tId
      });

      setSeatingData(data);
    } catch (err: any) {
      console.error('Failed to load seating layout:', err);
      setError(err?.message || 'Failed to load screen seating layout');
    } finally {
      setSeatingLoading(false);
    }
  };

  const handleSelectScreen = (screenId: string) => {
    setSelectedScreenId(screenId);
    if (theatreId) {
      loadSeatingLayout(theatreId, screenId);
    }
  };

  // Open Add Row Modal with next suggested alphabet
  const handleOpenAddRowModal = () => {
    const existingIdentifiers = seatingData?.rows.map((r) => r.rowIdentifier) || [];
    let nextLetter = 'A';
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i);
      if (!existingIdentifiers.includes(char)) {
        nextLetter = char;
        break;
      }
    }

    setRowFormData({
      rowIdentifier: nextLetter,
      startSeatNumber: 1,
      endSeatNumber: 20,
      seatCategory: 'regular',
      status: 'active'
    });
    setModalError(null);
    setIsAddRowModalOpen(true);
  };

  const handleCreateRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !selectedScreenId) return;

    if (!rowFormData.rowIdentifier.trim()) {
      setModalError('Row identifier is required (e.g. A, B, C)');
      return;
    }

    if (rowFormData.endSeatNumber < rowFormData.startSeatNumber) {
      setModalError('Ending seat number must be greater than or equal to starting seat number');
      return;
    }

    try {
      setActionLoading(true);
      setModalError(null);

      const res = await apiRequest(`/api/cinema/screens/${selectedScreenId}/rows`, {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          rowIdentifier: rowFormData.rowIdentifier.trim().toUpperCase(),
          startSeatNumber: Number(rowFormData.startSeatNumber),
          endSeatNumber: Number(rowFormData.endSeatNumber),
          seatCategory: rowFormData.seatCategory,
          status: rowFormData.status,
          sortOrder: seatingData?.rows.length || 0
        })
      });

      setSuccessMessage(res.message || 'Row and seats created successfully!');
      setIsAddRowModalOpen(false);
      await loadSeatingLayout(theatreId, selectedScreenId);
    } catch (err: any) {
      console.error('Create row failed:', err);
      setModalError(err?.message || 'Failed to create row and generate seats');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditRowModal = (row: CinemaRow) => {
    setEditingRow(row);
    setRowFormData({
      rowIdentifier: row.rowIdentifier,
      startSeatNumber: row.startSeatNumber,
      endSeatNumber: row.endSeatNumber,
      seatCategory: row.seatCategory,
      status: row.status === 'inactive' ? 'inactive' : 'active'
    });
    setModalError(null);
  };

  const handleUpdateRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !editingRow || !selectedScreenId) return;

    try {
      setActionLoading(true);
      setModalError(null);

      await apiRequest(`/api/cinema/rows/${editingRow.id}`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({
          rowIdentifier: rowFormData.rowIdentifier.trim().toUpperCase(),
          seatCategory: rowFormData.seatCategory,
          status: rowFormData.status
        })
      });

      setSuccessMessage(`Row "${rowFormData.rowIdentifier}" updated successfully!`);
      setEditingRow(null);
      await loadSeatingLayout(theatreId, selectedScreenId);
    } catch (err: any) {
      console.error('Update row failed:', err);
      setModalError(err?.message || 'Failed to update row');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRow = async (row: CinemaRow) => {
    if (!theatreId || !selectedScreenId) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to remove Row "${row.rowIdentifier}" and its ${row.totalSeats} seats?`
    );
    if (!confirmDelete) return;

    try {
      setError(null);
      await apiRequest(`/api/cinema/rows/${row.id}`, {
        method: 'DELETE',
        theatreId
      });

      setSuccessMessage(`Row "${row.rowIdentifier}" removed successfully.`);
      await loadSeatingLayout(theatreId, selectedScreenId);
    } catch (err: any) {
      console.error('Delete row failed:', err);
      setError(err?.message || 'Failed to delete row');
    }
  };

  // Individual Seat Controls
  const handleOpenSeatModal = (seat: CinemaSeat) => {
    setSelectedSeat(seat);
    setSeatFormData({
      seatCategory: seat.seatCategory,
      status: seat.status === 'inactive' ? 'inactive' : 'active'
    });
    setModalError(null);
  };

  const handleUpdateSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !selectedSeat || !selectedScreenId) return;

    try {
      setActionLoading(true);
      setModalError(null);

      await apiRequest(`/api/cinema/seats/${selectedSeat.id}`, {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify({
          seatCategory: seatFormData.seatCategory,
          status: seatFormData.status
        })
      });

      setSuccessMessage(`Seat "${selectedSeat.seatIdentifier}" updated!`);
      setSelectedSeat(null);
      await loadSeatingLayout(theatreId, selectedScreenId);
    } catch (err: any) {
      console.error('Update seat failed:', err);
      setModalError(err?.message || 'Failed to update seat');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSeatStatus = async (seat: CinemaSeat) => {
    if (!theatreId || !selectedScreenId) return;
    const isActivating = seat.status !== 'active';
    const endpoint = isActivating
      ? `/api/cinema/seats/${seat.id}/activate`
      : `/api/cinema/seats/${seat.id}/deactivate`;

    try {
      setError(null);
      await apiRequest(endpoint, {
        method: 'POST',
        theatreId
      });

      setSuccessMessage(`Seat "${seat.seatIdentifier}" ${isActivating ? 'activated' : 'deactivated'}.`);
      await loadSeatingLayout(theatreId, selectedScreenId);
    } catch (err: any) {
      console.error('Toggle seat status failed:', err);
      setError(err?.message || 'Failed to toggle seat status');
    }
  };

  // Add Single Seat to Row
  const handleOpenAddSeatModal = (row: CinemaRow) => {
    setAddingSeatToRow(row);
    const existingNumbers = row.seats.map((s) => s.seatNumber);
    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    setSingleSeatNumber(maxNum + 1);
    setModalError(null);
  };

  const handleAddSingleSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId || !addingSeatToRow || !selectedScreenId) return;

    try {
      setActionLoading(true);
      setModalError(null);

      await apiRequest(`/api/cinema/screens/${selectedScreenId}/seats`, {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          rowId: addingSeatToRow.id,
          seatNumber: Number(singleSeatNumber),
          seatCategory: addingSeatToRow.seatCategory,
          status: 'active'
        })
      });

      setSuccessMessage(`Seat "${addingSeatToRow.rowIdentifier}${singleSeatNumber}" added!`);
      setAddingSeatToRow(null);
      await loadSeatingLayout(theatreId, selectedScreenId);
    } catch (err: any) {
      console.error('Add single seat failed:', err);
      setModalError(err?.message || 'Failed to add seat');
    } finally {
      setActionLoading(false);
    }
  };

  const getSeatColorClass = (category: string, status: string) => {
    if (status === 'inactive') {
      return 'bg-slate-800 text-slate-500 border-slate-700 opacity-60 line-through';
    }
    switch (category) {
      case 'premium':
        return 'bg-violet-600/20 text-violet-300 border-violet-500/40 hover:bg-violet-600/30';
      case 'recliner':
        return 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30';
      case 'vip':
        return 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30';
      default:
        return 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading cinema auditorium layouts...</p>
      </div>
    );
  }

  if (screens.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <Tv className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">No Cinema Screens Found</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Before configuring seating arrangements, you must first register your cinema screens (e.g., Screen 1, Audi 2).
        </p>
        <Link
          href="/cinema/admin/screens"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Cinema Screens First (Task 03)</span>
        </Link>
      </div>
    );
  }

  const selectedScreen = screens.find((s) => s.id === selectedScreenId);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header & Screen Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/cinema/admin/screens"
              className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Screens</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Seating Layout Configuration</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Task 04
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure row identifiers, flexible seat counts, and seating categories (Regular, Premium, Recliner).
          </p>
        </div>

        {/* Screen Picker Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedScreenId}
              onChange={(e) => handleSelectScreen(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 pr-10 appearance-none shadow-xl cursor-pointer"
            >
              {screens.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.screenName} ({sc.screenType.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={handleOpenAddRowModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Row</span>
          </button>
        </div>
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

      {/* Screen Overview & Seating Capacity Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Auditorium Layout
              </span>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Type: {selectedScreen?.screenType || 'Standard'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">
              {selectedScreen?.screenName}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Independent permanent seat coordinates for food deliveries and patron positioning.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Rows</span>
              <p className="text-2xl font-black text-white mt-0.5">{seatingData?.totalRows || 0}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Seats</span>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{seatingData?.totalSeats || 0}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active</span>
              <p className="text-2xl font-black text-indigo-400 mt-0.5">{seatingData?.statusBreakdown?.active || 0}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inactive</span>
              <p className="text-2xl font-black text-slate-400 mt-0.5">{seatingData?.statusBreakdown?.inactive || 0}</p>
            </div>
          </div>
        </div>

        {/* Category Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Seat Tiers:</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              <span>Regular ({seatingData?.categoryBreakdown?.regular || 0})</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
              <span>Premium ({seatingData?.categoryBreakdown?.premium || 0})</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Recliner ({seatingData?.categoryBreakdown?.recliner || 0})</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>VIP ({seatingData?.categoryBreakdown?.vip || 0})</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
              <span>Inactive</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Click any seat to update category or toggle maintenance status.
          </p>
        </div>
      </div>

      {/* Visual Auditorium Floorplan */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-10 shadow-2xl relative overflow-x-auto">
        {/* Curved Screen Banner */}
        <div className="max-w-2xl mx-auto text-center space-y-2">
          <div className="w-full h-3 rounded-full bg-gradient-to-r from-indigo-500/30 via-indigo-500 to-indigo-500/30 shadow-[0_0_25px_rgba(99,102,241,0.6)]" />
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-400">
            CINEMA AUDITORIUM SCREEN (FRONT)
          </p>
        </div>

        {/* Rows & Seats Grid */}
        {seatingLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Rendering auditorium seating grid...</p>
          </div>
        ) : seatingData?.rows.length === 0 ? (
          <div className="text-center py-12 max-w-md mx-auto space-y-4">
            <Armchair className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-black text-white">No Seating Configured for This Screen</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add rows (e.g. Row A with 25 seats, Row B with 20 seats) to generate individual seat coordinates.
            </p>
            <button
              onClick={handleOpenAddRowModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Row (e.g. Row A)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 min-w-[700px]">
            {seatingData?.rows.map((row) => {
              const isRowInactive = row.status === 'inactive';

              return (
                <div
                  key={row.id}
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-4 ${
                    isRowInactive
                      ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Row Label Indicator */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black text-white text-sm shadow-md">
                      {row.rowIdentifier}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">
                        {row.seatCategory}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {row.totalSeats} seats
                      </span>
                    </div>
                  </div>

                  {/* Center: Row Seats Scrollable Horizon */}
                  <div className="flex-1 flex flex-wrap items-center justify-center gap-1.5 px-4 overflow-x-auto py-1">
                    {row.seats.map((seat) => {
                      const colorClass = getSeatColorClass(seat.seatCategory, seat.status);

                      return (
                        <button
                          key={seat.id}
                          onClick={() => handleOpenSeatModal(seat)}
                          title={`${seat.seatIdentifier} - ${seat.seatCategory.toUpperCase()} (${seat.status})`}
                          className={`w-8 h-8 rounded-lg border text-[11px] font-bold flex items-center justify-center transition shadow-sm ${colorClass}`}
                        >
                          {seat.seatNumber}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right: Row Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenAddSeatModal(row)}
                      title="Add single seat to this row"
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 hover:text-white hover:bg-indigo-600 transition text-xs font-bold flex items-center gap-1 px-2"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Seat</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditRowModal(row)}
                      title="Edit Row"
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteRow(row)}
                      title="Delete Row"
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Row */}
      {isAddRowModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Armchair className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Row & Generate Seats</h3>
                  <p className="text-xs text-slate-400">Configure row coordinates and automatic seat count</p>
                </div>
              </div>

              <button
                onClick={() => setIsAddRowModalOpen(false)}
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

            <form onSubmit={handleCreateRow} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Row Letter <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A, B, C"
                    value={rowFormData.rowIdentifier}
                    onChange={(e) => setRowFormData({ ...rowFormData, rowIdentifier: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Total Seats in Row <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={Math.max(1, rowFormData.endSeatNumber - rowFormData.startSeatNumber + 1)}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 1;
                      setRowFormData({
                        ...rowFormData,
                        endSeatNumber: rowFormData.startSeatNumber + count - 1
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Seat Category Tier
                </label>
                <select
                  value={rowFormData.seatCategory}
                  onChange={(e) => setRowFormData({ ...rowFormData, seatCategory: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="regular">Regular</option>
                  <option value="premium">Premium</option>
                  <option value="recliner">Recliner</option>
                  <option value="vip">VIP Lounge</option>
                </select>
              </div>

              {/* Automatic Generation Summary Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <span className="text-white font-bold block">Generated Seats Preview:</span>
                <p>
                  Will create{' '}
                  <span className="text-emerald-400 font-bold">
                    {Math.max(0, rowFormData.endSeatNumber - rowFormData.startSeatNumber + 1)} seats
                  </span>
                  : {rowFormData.rowIdentifier}{rowFormData.startSeatNumber} through {rowFormData.rowIdentifier}{rowFormData.endSeatNumber}.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddRowModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Generating...' : 'Generate Row & Seats'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Row */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Row & Cascade to Seats</h3>
                  <p className="text-xs text-slate-400">Modifying Row {editingRow.rowIdentifier}</p>
                </div>
              </div>

              <button
                onClick={() => setEditingRow(null)}
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

            <form onSubmit={handleUpdateRow} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Row Identifier
                </label>
                <input
                  type="text"
                  required
                  value={rowFormData.rowIdentifier}
                  onChange={(e) => setRowFormData({ ...rowFormData, rowIdentifier: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Seat Category Tier
                  </label>
                  <select
                    value={rowFormData.seatCategory}
                    onChange={(e) => setRowFormData({ ...rowFormData, seatCategory: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="premium">Premium</option>
                    <option value="recliner">Recliner</option>
                    <option value="vip">VIP Lounge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Operational Status
                  </label>
                  <select
                    value={rowFormData.status}
                    onChange={(e) => setRowFormData({ ...rowFormData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                Updating the category or status here will automatically cascade to all {editingRow.totalSeats} seats in this row.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{actionLoading ? 'Saving...' : 'Update Row'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Individual Seat Options */}
      {selectedSeat && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-xs">
                  {selectedSeat.seatIdentifier}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Seat {selectedSeat.seatIdentifier}</h3>
                  <p className="text-[11px] text-slate-400">Row {selectedSeat.rowIdentifier}, Seat #{selectedSeat.seatNumber}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSeat(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSeat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Category Tier
                </label>
                <select
                  value={seatFormData.seatCategory}
                  onChange={(e) => setSeatFormData({ ...seatFormData, seatCategory: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="regular">Regular</option>
                  <option value="premium">Premium</option>
                  <option value="recliner">Recliner</option>
                  <option value="vip">VIP Lounge</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Seat Status
                </label>
                <select
                  value={seatFormData.status}
                  onChange={(e) => setSeatFormData({ ...seatFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Active (Available for ordering)</option>
                  <option value="inactive">Inactive (Blocked / Maintenance)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedSeat(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Single Seat to Row */}
      {addingSeatToRow && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-xs">
                  {addingSeatToRow.rowIdentifier}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add Seat to Row {addingSeatToRow.rowIdentifier}</h3>
                  <p className="text-[11px] text-slate-400">Append an additional seat coordinate</p>
                </div>
              </div>

              <button
                onClick={() => setAddingSeatToRow(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddSingleSeat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Seat Number
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={singleSeatNumber}
                  onChange={(e) => setSingleSeatNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Identifier will be: <span className="text-white font-bold">{addingSeatToRow.rowIdentifier}{singleSeatNumber}</span>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddingSeatToRow(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Add Seat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
