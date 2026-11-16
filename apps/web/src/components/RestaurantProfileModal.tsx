'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';
import { isValidSlug } from '@menugo/shared';
import {
  X,
  Store,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Globe,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Lock
} from 'lucide-react';

interface RestaurantProfileModalProps {
  restaurantId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updatedRestaurant: any) => void;
}

export function RestaurantProfileModal({
  restaurantId,
  isOpen,
  onClose,
  onUpdated
}: RestaurantProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('owner');

  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status & feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canEdit = userRole === 'owner' || userRole === 'admin';

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setServerError(null);
      setSuccessMessage(null);
      setFieldErrors({});

      const data = await apiRequest(`/api/restaurants/${restaurantId}`, {
        restaurantId
      });

      const rest = data.restaurant;
      setName(rest.name || '');
      setSlug(rest.slug || '');
      setPhone(rest.phone || '');
      setEmail(rest.email || '');
      setAddress(rest.address || '');
      setCurrency(rest.currency || 'INR');
      setLogoUrl(rest.logoUrl || '');
      setIsActive(rest.isActive ?? true);
      setUserRole(data.userRole || 'owner');
    } catch (err: any) {
      setServerError(err.message || 'Failed to load restaurant profile.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (isOpen && restaurantId) {
      loadProfile();
    }
  }, [isOpen, restaurantId, loadProfile]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Restaurant name must be at least 2 characters.';
    }

    if (!slug.trim()) {
      errors.slug = 'Slug is required.';
    } else if (!isValidSlug(slug.trim())) {
      errors.slug = 'Invalid slug format (only lowercase alphanumeric and hyphens).';
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Invalid email address.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        currency,
        logoUrl: logoUrl.trim() || null,
        isActive
      };

      const res = await apiRequest(`/api/restaurants/${restaurantId}`, {
        method: 'PATCH',
        restaurantId,
        body: JSON.stringify(payload)
      });

      setSuccessMessage('Restaurant profile updated successfully!');
      if (onUpdated) {
        onUpdated(res.restaurant);
      }
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setServerError(err.message || 'Failed to update restaurant profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Restaurant Profile & Settings</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">Role:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                  <ShieldCheck className="w-3 h-3" />
                  {userRole}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <p className="text-xs text-slate-500">Loading profile data...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Alert Feedback Messages */}
              {serverError && (
                <div className="p-3.5 bg-red-50 text-red-800 text-sm rounded-xl border border-red-200 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{serverError}</p>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 bg-emerald-50 text-emerald-800 text-sm rounded-xl border border-emerald-200 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs font-semibold">{successMessage}</p>
                </div>
              )}

              {!canEdit && (
                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>You have view-only access. Only restaurant Owners and Admins can update profile settings.</span>
                </div>
              )}

              {/* Name & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit || saving}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 font-medium text-slate-900"
                  />
                  {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Public Slug
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit || saving}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 text-slate-900"
                  />
                  {fieldErrors.slug && <p className="text-xs text-red-600 mt-1">{fieldErrors.slug}</p>}
                </div>
              </div>

              {/* Contact Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit || saving}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    disabled={!canEdit || saving}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 text-slate-900"
                  />
                  {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Physical Address
                </label>
                <textarea
                  rows={2}
                  disabled={!canEdit || saving}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 text-slate-900 resize-none"
                />
              </div>

              {/* Currency & Logo URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    disabled={!canEdit || saving}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 text-slate-900"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Logo Image URL
                  </label>
                  <input
                    type="url"
                    disabled={!canEdit || saving}
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Active Toggle (Owner only) */}
              {userRole === 'owner' && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div>
                    <span className="text-sm font-bold text-slate-800">Operational Status</span>
                    <p className="text-xs text-slate-500">Toggle whether this restaurant is publicly accepting orders.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={saving}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
                >
                  Close
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <span>Save Profile</span>
                    )}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
