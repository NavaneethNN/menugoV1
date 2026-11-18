'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Armchair,
  ChevronRight,
  RotateCcw,
  User,
  Phone,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatPaise } from '@menugo/shared';
import { CinemaCartItem } from '@/lib/cinema-cart';

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

    const scrollToTop = () => {
      const container = document.getElementById('cinema-cart-drawer-content');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    if (cart.length === 0) {
      setOrderError('Your cart is empty. Please add items from the menu first.');
      scrollToTop();
      return;
    }

    if (!isScreenValid) {
      setOrderError('Please select your Auditorium / Screen.');
      scrollToTop();
      return;
    }

    if (!isRowValid) {
      setOrderError('Please select your Seat Row from the dropdown.');
      scrollToTop();
      return;
    }

    if (!isSeatValid || !seatNumber) {
      setOrderError('Please select your Seat Number from the dropdown.');
      scrollToTop();
      return;
    }

    if (!isNameValid) {
      setOrderError('Name is mandatory. Please enter your name (at least 2 characters).');
      scrollToTop();
      return;
    }

    if (!isPhoneValid) {
      setOrderError('Mobile number is mandatory. Please enter a valid 10-digit mobile number.');
      scrollToTop();
      return;
    }

    onPlaceOrder();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Place Concessions Order
              </h2>
              <p className="text-[11px] text-slate-500">
                {theatreName} • {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
            aria-label="Close checkout drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div id="cinema-cart-drawer-content" className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Global Order Error Alert */}
          {orderError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{orderError}</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderError(null)}
                className="text-rose-600 hover:text-rose-800 p-0.5"
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
              <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Your Order ({totalCount})</span>
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-700 transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Your cart is empty</p>
                <p className="text-[11px] text-slate-500">
                  Select delicious popcorn and beverages from the menu to continue.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
                {cart.map((item) => {
                  const itemTotal = item.product.price * item.quantity;
                  return (
                    <div key={item.productId} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 relative">
                          {item.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-bold ${
                              item.product.isVegetarian
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {item.product.isVegetarian ? 'V' : 'NV'}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {item.product.name}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {formatPaise(item.product.price, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, -1)}
                            className="w-5 h-5 text-slate-600 hover:text-slate-900 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-900 px-1">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, 1)}
                            className="w-5 h-5 text-slate-600 hover:text-slate-900 flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-xs font-mono font-bold text-slate-900 w-14 text-right">
                          {formatPaise(itemTotal, currency)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          className="text-slate-400 hover:text-red-700 p-1 transition"
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
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                <Armchair className="w-3.5 h-3.5" />
                <span>Delivery Location (Screen &amp; Seat)</span>
              </h3>
              <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                In-Seat Delivery
              </span>
            </div>

            {/* 1. Screen Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>Auditorium Screen <span className="text-rose-500">*</span></span>
                {isScreenPreselected && (
                  <span className="text-[10px] text-red-700 font-semibold">Pre-selected from QR</span>
                )}
              </label>

              <select
                value={selectedScreenId}
                onChange={(e) => onScreenChange(e.target.value)}
                disabled={isScreenPreselected}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-xl text-slate-900 font-medium focus:outline-none transition ${
                  attemptedSubmit && !isScreenValid
                    ? 'border-rose-500 ring-1 ring-rose-500'
                    : 'border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600'
                } disabled:bg-slate-100 disabled:text-slate-500`}
              >
                <option value="">-- Select Auditorium / Screen --</option>
                {screens.map((scr) => (
                  <option key={scr.id} value={scr.id}>
                    {scr.screenName} ({scr.screenType.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Dedicated Row & Seat Number Dropdowns */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Dedicated Dropdown for Row */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Seat Row <span className="text-rose-500">*</span>
                    </span>
                    {loadingSeating && (
                      <span className="text-[10px] text-red-700 flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Loading...
                      </span>
                    )}
                  </label>

                  <select
                    value={selectedRow}
                    onChange={(e) => handleRowSelect(e.target.value)}
                    disabled={!selectedScreenId || loadingSeating || seatingRows.length === 0}
                    className={`w-full px-3 py-2 text-xs bg-white border rounded-xl text-slate-900 font-medium focus:outline-none transition ${
                      attemptedSubmit && !isRowValid
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600'
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
                      >
                        Row {row.rowIdentifier} {row.seatCategory ? `(${row.seatCategory.toUpperCase()})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dedicated Dropdown for Seat Number (Populated based on Row) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Seat Number <span className="text-rose-500">*</span>
                    </span>
                    {selectedRow && activeRow && (
                      <span className="text-[10px] text-red-700 font-semibold">
                        {availableSeatsForActiveRow.length} {availableSeatsForActiveRow.length === 1 ? 'seat' : 'seats'}
                      </span>
                    )}
                  </label>

                  <select
                    value={seatRow === selectedRow ? seatNumber : ''}
                    onChange={(e) => handleSeatSelect(e.target.value)}
                    disabled={!selectedRow || !activeRow || availableSeatsForActiveRow.length === 0}
                    className={`w-full px-3 py-2 text-xs bg-white border rounded-xl text-slate-900 font-medium focus:outline-none transition ${
                      attemptedSubmit && (!isSeatValid || !seatNumber)
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600'
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
                      >
                        Seat {seat.seatIdentifier}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Confirmed Delivery Pill */}
              {isSeatValid && activeSeat && (
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
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
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Customer Details (Mandatory)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mandatory Customer Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Your Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={customerName}
                    onChange={(e) => onCustomerNameChange(e.target.value)}
                    maxLength={100}
                    className={`w-full pl-8 pr-3 py-2 text-xs bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                      attemptedSubmit && !isNameValid
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600'
                    }`}
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                {attemptedSubmit && !isNameValid && (
                  <p className="text-[10px] text-rose-600">Name is required (at least 2 letters)</p>
                )}
              </div>

              {/* Mandatory Mobile Phone */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Mobile Number <span className="text-rose-500">*</span>
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
                    className={`w-full pl-8 pr-3 py-2 text-xs bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none transition font-mono ${
                      attemptedSubmit && !isPhoneValid
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-slate-300 focus:border-red-600 focus:ring-1 focus:ring-red-600'
                    }`}
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                {attemptedSubmit && !isPhoneValid && (
                  <p className="text-[10px] text-rose-600">Valid 10-digit mobile number is required</p>
                )}
              </div>

              {/* Special Instructions (Optional) */}
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  Delivery Notes for Usher (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please deliver during intermission, extra napkins"
                  value={specialInstructions}
                  onChange={(e) => onSpecialInstructionsChange(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-600"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 4: PRICE BREAKDOWN
          ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block pb-1 border-b border-slate-200">
              Bill Summary
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Concessions Subtotal</span>
                <span className="font-mono text-slate-900">{formatPaise(subtotalPaise, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Applicable Taxes (GST 5%)</span>
                <span className="font-mono text-slate-900">{formatPaise(taxPaise, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Payable</span>
                <span className="font-mono text-red-700 text-base font-black">
                  {formatPaise(totalPaise, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 5: ACTION FOOTER
        ========================================================================= */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0 flex flex-col gap-2.5">
          {orderError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{orderError}</span>
              </div>
              <button
                type="button"
                onClick={() => setOrderError(null)}
                className="text-rose-600 hover:text-rose-800 p-0.5 ml-2"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Back
            </button>

            <button
              type="button"
              disabled={isSubmittingOrder || cart.length === 0}
              onClick={handleValidateAndPlaceOrder}
              className="flex-1 py-3.5 px-4 rounded-xl bg-red-700 hover:bg-red-800 active:scale-[0.98] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-red-700/20 disabled:opacity-50"
            >
              {isSubmittingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing Order...</span>
                </>
              ) : (
                <>
                  <span>Place Order &amp; Pay • {formatPaise(totalPaise, currency)}</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
