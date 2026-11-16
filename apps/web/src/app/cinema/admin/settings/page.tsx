'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { CinemaSettingsTabs } from '@/components/cinema/CinemaSettingsTabs';
import {
  Film,
  Building2,
  MapPin,
  Phone,
  Mail,
  Coins,
  Globe,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export default function CinemaAdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreSlug, setTheatreSlug] = useState<string>('');

  const [formData, setFormData] = useState({
    theatreName: '',
    chainOrBrand: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    contactNumber: '',
    contactEmail: '',
    businessDetails: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    logoUrl: '',
    logoKey: ''
  });

  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    loadTheatreProfile();
  }, []);

  const loadTheatreProfile = async () => {
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
      setTheatreSlug(activeTheatre.restaurant.slug || '');

      // Load profile
      const profile = await apiRequest('/api/cinema/profile', {
        theatreId: activeId
      });

      const data = {
        theatreName: profile.theatreName || activeTheatre.restaurant.name || '',
        chainOrBrand: profile.chainOrBrand || '',
        address: profile.address || activeTheatre.restaurant.address || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || 'India',
        contactNumber: profile.contactNumber || activeTheatre.restaurant.phone || '',
        contactEmail: profile.contactEmail || activeTheatre.restaurant.email || '',
        businessDetails: profile.businessDetails || '',
        currency: profile.currency || activeTheatre.restaurant.currency || 'INR',
        timezone: profile.timezone || 'Asia/Kolkata',
        logoUrl: profile.logoUrl || activeTheatre.restaurant.logoUrl || '',
        logoKey: profile.logoKey || activeTheatre.restaurant.logoKey || ''
      };

      setFormData(data);
      setInitialData(data);
    } catch (err: any) {
      console.error('Failed to load theatre profile:', err);
      setError(err?.message || 'Failed to fetch cinema profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, or WEBP)');
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData((prev) => ({
          ...prev,
          logoUrl: dataUrl,
          logoKey: `theatre-logo-${Date.now()}`
        }));
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Logo upload failed:', err);
      setError('Failed to upload theatre logo');
      setUploadingLogo(false);
    }
  };

  const handleReset = () => {
    if (initialData) {
      setFormData(initialData);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theatreId) return;

    setError(null);
    setSuccessMessage(null);

    // Basic client validation
    if (!formData.theatreName.trim()) {
      setError('Theatre name is required');
      return;
    }
    if (!formData.city.trim() || !formData.state.trim()) {
      setError('City and State are required');
      return;
    }
    if (!formData.contactNumber.trim()) {
      setError('Contact phone number is required');
      return;
    }
    if (!formData.contactEmail.trim()) {
      setError('Contact email address is required');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        theatreName: formData.theatreName.trim(),
        chainOrBrand: formData.chainOrBrand.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim() || 'India',
        contactNumber: formData.contactNumber.trim(),
        contactEmail: formData.contactEmail.trim().toLowerCase(),
        businessDetails: formData.businessDetails.trim() || null,
        timezone: formData.timezone,
        currency: formData.currency,
        logoUrl: formData.logoUrl || null,
        logoKey: formData.logoKey || null
      };

      const result = await apiRequest('/api/cinema/profile', {
        method: 'PATCH',
        theatreId,
        body: JSON.stringify(payload)
      });

      setSuccessMessage('Theatre profile details updated successfully!');
      setInitialData(formData);
    } catch (err: any) {
      console.error('Failed to update theatre profile:', err);
      setError(err?.message || 'Failed to update theatre profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading cinema profile settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
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
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Theatre Profile & Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure your cinema theatre identity, address, contact coordinates, currency, and timezone.
          </p>
        </div>

        {theatreSlug && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/cinema/admin/payments"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>Payment Gateway Settings</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </Link>
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs">
              <span className="text-slate-500 mr-1.5">Slug:</span>
              <span className="font-mono text-indigo-400 font-semibold">{theatreSlug}</span>
            </div>
          </div>
        )}
      </div>

      {/* Settings & Operations Unified Sub-Tab Navigation */}
      <CinemaSettingsTabs />

      {/* Notifications */}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Essential Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cinema Profile</h2>
              <p className="text-xs text-slate-400">Essential theatre identity and auditorium location</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            {/* Logo Display & Upload */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-900 border-2 border-dashed border-slate-700 flex items-center justify-center mb-2.5 group">
                {formData.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={formData.logoUrl}
                    alt="Theatre Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film className="w-8 h-8 text-slate-600" />
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition text-white text-[11px] font-semibold">
                  <Upload className="w-4 h-4 mb-1" />
                  <span>Change</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                </label>
              </div>

              <label className="cursor-pointer text-xs font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1.5">
                {uploadingLogo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{uploadingLogo ? 'Processing...' : 'Upload Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
            </div>

            {/* Essential Theatre Inputs */}
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Theatre Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.theatreName}
                  onChange={(e) => setFormData({ ...formData, theatreName: e.target.value })}
                  placeholder="e.g., PVR Superplex Forum Mall"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  City <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Bengaluru"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  State <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Karnataka"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Contact Phone <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    placeholder="9876543210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Contact Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="admin@theatre.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Business & Address Disclosure */}
        <details className="group rounded-3xl border border-slate-800 bg-slate-900/60 p-6 transition-all">
          <summary className="text-xs font-bold text-slate-300 hover:text-indigo-400 cursor-pointer list-none flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Optional Details (Mall Address, Brand Name, GSTIN)</span>
            </span>
            <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Brand / Chain Name
              </label>
              <input
                type="text"
                value={formData.chainOrBrand}
                onChange={(e) => setFormData({ ...formData, chainOrBrand: e.target.value })}
                placeholder="e.g. PVR INOX, Cinepolis"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={formData.businessDetails}
                onChange={(e) => setFormData({ ...formData, businessDetails: e.target.value })}
                placeholder="GSTIN: 29AAAAA0000A1Z5"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Physical Street / Mall Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="4th Floor, Nexus Mall, Koramangala 7th Block"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </details>

        {/* Region & Currency Indicator */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Region: <strong>India</strong> • Timezone: <strong>Asia/Kolkata (IST)</strong> • Currency: <strong>INR (₹)</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Changes</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
