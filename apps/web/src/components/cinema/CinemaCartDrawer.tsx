'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  AlertCircle,
  Armchair,
  Film,
  Sparkles,
  ChevronRight,
  RotateCcw,
  User,
  Phone,
  Clock,
  Loader2,
  Tv,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatPaise } from '@menugo/shared';
import { CinemaCartItem } from '@/lib/cinema-cart';

export interface CinemaShow {
  id: string;
  screenId: string;
  movieId: string;
  movieTitle: string;
  moviePosterUrl?: string | null;
  language?: string | null;
  durationMinutes: number;
  movieDescription?: string | null;
  showDate: string;
  startTime: string;
  expectedEndTime: string;
  orderingStartTime: string;
  orderingEndTime: string;
  isOrderingOpen: boolean;
  orderingStatus: 'open' | 'upcoming' | 'closed';
}

export interface SeatingRow {
  id: string;
  rowIdentifier: string;
  seatCategory: string;
  totalSeats: number;
  seats: Array<{
    id: string;
    seatIdentifier: string;
    seatNumber: number;
    seatCategory: string;
    status: string;
  }>;
}

interface CinemaCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theatreName: string;
  currency: string;
  cart: CinemaCartItem[];
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  totalCount: number;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  screens: Array<{
    id: string;
    screenName: string;
    screenType: string;
    totalSeats: number;
  }>;
  isScreenPreselected: boolean;
  selectedScreenId: string;
  onScreenChange: (screenId: string) => void;
  shows: CinemaShow[];
  selectedShowId: string;
  onShowChange: (showId: string) => void;
  loadingShows: boolean;
  seatingRows: SeatingRow[];
  loadingSeating: boolean;
  selectedSeatKey: string; // e.g. "A:A1"
  onSeatChange: (seatKey: string) => void;
  customerName: string;
  onCustomerNameChange: (val: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (val: string) => void;
  specialInstructions: string;
  onSpecialInstructionsChange: (val: string) => void;
  onPlaceOrder: () => void;
  isSubmittingOrder: boolean;
  orderError: string | null;
  setOrderError: (err: string | null) => void;
}

export function CinemaCartDrawer({
  isOpen,
  onClose,
  theatreName,
  currency,
  cart,
  subtotalPaise,
  taxPaise,
  totalPaise,
  totalCount,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  screens,
  isScreenPreselected,
  selectedScreenId,
  onScreenChange,
  shows,
  selectedShowId,
  onShowChange,
  loadingShows,
  seatingRows,
  loadingSeating,
  selectedSeatKey,
  onSeatChange,
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  specialInstructions,
  onSpecialInstructionsChange,
  onPlaceOrder,
  isSubmittingOrder,
  orderError,
  setOrderError
}: CinemaCartDrawerProps) {
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Parse seat row and number from selectedSeatKey ("ROW:SEAT")
  const [seatRow, seatNumber] = selectedSeatKey ? selectedSeatKey.split(':') : ['', ''];
  const [selectedRow, setSelectedRow] = useState<string>(seatRow || '');

  // Sync selectedRow when selectedSeatKey changes externally (or when screen changes)
  useEffect(() => {
    if (seatRow) {
      setSelectedRow(seatRow);
    } else if (!selectedSeatKey) {
      setSelectedRow('');
    }
  }, [seatRow, selectedSeatKey]);

  // Reset row if current selected row no longer exists in newly loaded screen seating
  useEffect(() => {
    if (selectedRow && seatingRows.length > 0 && !seatingRows.some((r) => r.rowIdentifier === selectedRow)) {
      setSelectedRow('');
    }
  }, [seatingRows, selectedRow]);

  if (!isOpen) return null;

  // Selected screen & seat object lookups
  const selectedScreen = screens.find((s) => s.id === selectedScreenId);
  const selectedShow = shows.find((s) => s.id === selectedShowId);

  const activeRow = seatingRows.find((r) => r.rowIdentifier === (selectedRow || seatRow));
  const availableSeatsForActiveRow = activeRow?.seats || [];
  const activeSeat = availableSeatsForActiveRow.find((s) => s.seatIdentifier === seatNumber);

  // Field validation checks
  const isScreenValid = Boolean(selectedScreenId);
  const isRowValid = Boolean(selectedRow);
  const isSeatValid = Boolean(selectedSeatKey && seatRow && seatNumber && (seatRow === selectedRow || !selectedRow));
  const isNameValid = customerName.trim().length >= 2;
  const cleanedPhone = customerPhone.replace(/\D/g, '');
  const isPhoneValid = cleanedPhone.length === 10;

  const handleRowSelect = (rowIdStr: string) => {
    setSelectedRow(rowIdStr);
    onSeatChange(''); // Reset seat selection when row changes
  };

  const handleSeatSelect = (seatIdStr: string) => {
    const row = selectedRow || seatRow;
    if (!row || !seatIdStr) {
      onSeatChange('');
      return;
    }
    onSeatChange(`${row}:${seatIdStr}`);
  };

  const handleValidateAndPlaceOrder = () => {
    setAttemptedSubmit(true);
    setOrderError(null);

    if (cart.length === 0) {
      setOrderError('Your cart is empty. Please add items from the menu first.');
      return;
    }

    if (!isScreenValid) {
      setOrderError('Please select your Auditorium / Screen.');
      return;
    }

    if (!isRowValid) {
      setOrderError('Please select your Seat Row from the dropdown.');
      return;
    }

    if (!isSeatValid || !seatNumber) {
      setOrderError('Please select your Seat Number from the dropdown.');
      return;
    }

    if (!isNameValid) {
      setOrderError('Name is mandatory. Please enter your name (at least 2 characters).');
      return;
    }

    if (!isPhoneValid) {
      setOrderError('Mobile number is mandatory. Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!selectedShowId) {
      setOrderError('No active movie showtime is selected for this screen.');
      return;
    }

    onPlaceOrder();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Place Concessions Order
              </h2>
              <p className="text-[11px] text-slate-400">
                {theatreName} • {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            aria-label="Close checkout drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Global Order Error Alert */}
          {orderError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{orderError}</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderError(null)}
                className="text-rose-400 hover:text-rose-300 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* =========================================================================
              SECTION 1: CART ITEMS
          ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Your Order ({totalCount})</span>
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-400 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 p-4 space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-300">Your cart is empty</p>
                <p className="text-[11px] text-slate-500">
                  Select delicious popcorn and beverages from the menu to continue.
                </p>
              </div>
            ) : (
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                {cart.map((item) => {
                  const itemTotal = item.product.price * item.quantity;
                  return (
                    <div key={item.productId} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 relative">
                          {item.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-bold ${
                              item.product.isVegetarian
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            {item.product.isVegetarian ? 'V' : 'NV'}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">
                            {item.product.name}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            {formatPaise(item.product.price, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, -1)}
                            className="w-5 h-5 text-slate-300 hover:text-white flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-white px-1">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, 1)}
                            className="w-5 h-5 text-slate-300 hover:text-white flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-xs font-mono font-bold text-white w-14 text-right">
                          {formatPaise(itemTotal, currency)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition"
                          title="Remove item"
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

          {/* =========================================================================
              SECTION 2: DELIVERY DESTINATION (SCREEN & SEAT DROPDOWN)
          ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <Armchair className="w-3.5 h-3.5" />
                <span>Delivery Location (Screen & Seat)</span>
              </h3>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                In-Seat Delivery
              </span>
            </div>

            {/* 1. Screen Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>Auditorium Screen <span className="text-rose-400">*</span></span>
                {isScreenPreselected && (
                  <span className="text-[10px] text-red-400 font-semibold">Pre-selected from QR</span>
                )}
              </label>

              <select
                value={selectedScreenId}
                onChange={(e) => onScreenChange(e.target.value)}
                disabled={isScreenPreselected}
                className={`w-full px-3 py-2 text-xs bg-slate-900 border rounded-xl text-white font-medium focus:outline-none transition ${
                  attemptedSubmit && !isScreenValid
                    ? 'border-rose-500 ring-1 ring-rose-500'
                    : 'border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                }`}
              >
                <option value="">-- Choose Auditorium Screen --</option>
                {screens.map((scr) => (
                  <option key={scr.id} value={scr.id}>
                    {scr.screenName} ({scr.screenType.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Movie Showtime Info (Auto-resolved) */}
            {selectedShow && (
              <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Film className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{selectedShow.movieTitle}</span>
                    <span className="text-[10px] text-red-300">
                      {new Date(selectedShow.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(selectedShow.expectedEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 border ${
                    selectedShow.isOrderingOpen
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {selectedShow.isOrderingOpen ? 'Ordering Open' : 'Upcoming'}
                </span>
              </div>
            )}

            {/* Multiple Shows Selector if available */}
            {shows.length > 1 && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 block">
                  Select Showtime
                </label>
                <select
                  value={selectedShowId}
                  onChange={(e) => onShowChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-red-500"
                >
                  {shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.movieTitle} (
                      {new Date(show.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      ) {show.isOrderingOpen ? '• Open' : '• Upcoming'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. Dedicated Row & Seat Number Dropdowns */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Dedicated Dropdown for Row */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>
                      Seat Row <span className="text-rose-400">*</span>
                    </span>
                    {loadingSeating && (
                      <span className="text-[10px] text-red-400 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Loading rows...
                      </span>
                    )}
                  </label>

                  <select
                    value={selectedRow}
                    onChange={(e) => handleRowSelect(e.target.value)}
                    disabled={!selectedScreenId || loadingSeating || seatingRows.length === 0}
                    className={`w-full px-3 py-2 text-xs bg-slate-900 border rounded-xl text-white font-medium focus:outline-none transition ${
                      attemptedSubmit && !selectedRow
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    }`}
                  >
                    <option value="">
                      {!selectedScreenId
                        ? '-- Select Screen First --'
                        : loadingSeating
                        ? '-- Loading Rows... --'
                        : seatingRows.length === 0
                        ? '-- No Rows Available --'
                        : '-- Select Row --'}
                    </option>

                    {seatingRows.map((row) => (
                      <option
                        key={row.id}
                        value={row.rowIdentifier}
                        className="bg-slate-950 text-white"
                      >
                        Row {row.rowIdentifier} {row.seatCategory ? `(${row.seatCategory.toUpperCase()})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dedicated Dropdown for Seat Number (Populated based on Row) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>
                      Seat Number <span className="text-rose-400">*</span>
                    </span>
                    {selectedRow && activeRow && (
                      <span className="text-[10px] text-red-400 font-semibold">
                        {availableSeatsForActiveRow.length} {availableSeatsForActiveRow.length === 1 ? 'seat' : 'seats'}
                      </span>
                    )}
                  </label>

                  <select
                    value={seatRow === selectedRow ? seatNumber : ''}
                    onChange={(e) => handleSeatSelect(e.target.value)}
                    disabled={!selectedRow || !activeRow || availableSeatsForActiveRow.length === 0}
                    className={`w-full px-3 py-2 text-xs bg-slate-900 border rounded-xl text-white font-medium focus:outline-none transition ${
                      attemptedSubmit && (!isSeatValid || !seatNumber)
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    }`}
                  >
                    <option value="">
                      {!selectedRow
                        ? '-- Select Row First --'
                        : availableSeatsForActiveRow.length === 0
                        ? '-- No Seats in Row --'
                        : '-- Select Seat Number --'}
                    </option>

                    {availableSeatsForActiveRow.map((seat) => (
                      <option
                        key={seat.id}
                        value={seat.seatIdentifier}
                        className="bg-slate-950 text-white"
                      >
                        Seat {seat.seatIdentifier}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Confirmed Delivery Pill */}
              {isSeatValid && activeSeat && (
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Delivering to: {selectedScreen?.screenName} • Row {seatRow}, Seat {seatNumber} ({activeSeat.seatCategory})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* =========================================================================
              SECTION 3: MANDATORY CUSTOMER CONTACT DETAILS
          ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Customer Details (Mandatory)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mandatory Customer Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Your Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => onCustomerNameChange(e.target.value)}
                    maxLength={100}
                    className={`w-full pl-8 pr-3 py-2 text-xs bg-slate-900 border rounded-xl text-white placeholder-slate-600 focus:outline-none transition ${
                      attemptedSubmit && !isNameValid
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    }`}
                  />
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
                {attemptedSubmit && !isNameValid && (
                  <p className="text-[10px] text-rose-400">Name is required (at least 2 letters)</p>
                )}
              </div>

              {/* Mandatory Mobile Phone */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Mobile Number <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => {
                      const numOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                      onCustomerPhoneChange(numOnly);
                    }}
                    maxLength={10}
                    className={`w-full pl-8 pr-3 py-2 text-xs bg-slate-900 border rounded-xl text-white placeholder-slate-600 focus:outline-none transition font-mono ${
                      attemptedSubmit && !isPhoneValid
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    }`}
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
                {attemptedSubmit && !isPhoneValid && (
                  <p className="text-[10px] text-rose-400">Valid 10-digit mobile number is required</p>
                )}
              </div>

              {/* Special Instructions (Optional) */}
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 block">
                  Delivery Notes for Usher (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please deliver during intermission, extra napkins"
                  value={specialInstructions}
                  onChange={(e) => onSpecialInstructionsChange(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 4: PRICE BREAKDOWN
          ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block pb-1 border-b border-slate-800">
              Bill Summary
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Concessions Subtotal</span>
                <span className="font-mono text-white">{formatPaise(subtotalPaise, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Applicable Taxes (GST 5%)</span>
                <span className="font-mono text-white">{formatPaise(taxPaise, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                <span>Total Payable</span>
                <span className="font-mono text-red-500 text-base font-black">
                  {formatPaise(totalPaise, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 5: ACTION FOOTER
        ========================================================================= */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/95 shrink-0 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
          >
            Back
          </button>

          <button
            type="button"
            disabled={isSubmittingOrder || cart.length === 0}
            onClick={handleValidateAndPlaceOrder}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-xl shadow-red-600/30 disabled:opacity-50"
          >
            {isSubmittingOrder ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Preparing Order...</span>
              </>
            ) : (
              <>
                <span>Place Order & Pay • {formatPaise(totalPaise, currency)}</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
