'use client';

import React, { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { slugify, isValidSlug } from '@menugo/shared';
import { Store, Loader2, CheckCircle2, AlertCircle, Globe, Phone, Mail, MapPin, DollarSign } from 'lucide-react';

interface RestaurantOnboardingFormProps {
  onSuccess?: (restaurant: any) => void;
  onCancel?: () => void;
}

export function RestaurantOnboardingForm({ onSuccess, onCancel }: RestaurantOnboardingFormProps) {
  // Form values
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [logoUrl, setLogoUrl] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  // Auto-generate slug when name changes (unless user manually touched slug)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSlugCustomized) {
      setSlug(slugify(val));
    }
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: '' }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugCustomized(true);
    const val = e.target.value.toLowerCase().replace(/\s+/g, '-');
    setSlug(val);
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: '' }));
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Restaurant name must be at least 2 characters.';
    }

    if (!slug.trim()) {
      errors.slug = 'Slug is required.';
    } else if (!isValidSlug(slug.trim())) {
      errors.slug = 'Slug can only contain lowercase letters, numbers, and single hyphens, without leading/trailing hyphens.';
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (logoUrl && logoUrl.trim() && !/^https?:\/\/.+/.test(logoUrl.trim())) {
      errors.logoUrl = 'Logo URL must start with http:// or https://';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        currency,
        logoUrl: logoUrl.trim() || null
      };

      const response = await apiRequest('/api/restaurants', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessData(response.restaurant);
      if (onSuccess) {
        setTimeout(() => {
          onSuccess(response.restaurant);
        }, 1200);
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to create restaurant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successData) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-emerald-100 shadow-sm">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h3 className="text-2xl font-black text-slate-900">Restaurant Created Successfully!</h3>
        <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
          <span className="font-bold text-slate-900">{successData.name}</span> has been registered with slug{' '}
          <code className="bg-slate-100 px-2 py-0.5 rounded text-orange-600 font-mono font-semibold">
            /{successData.slug}
          </code>
          . Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {serverError && (
        <div className="p-4 bg-red-50 text-red-800 rounded-xl border border-red-200 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Creation Failed</p>
            <p className="mt-0.5 text-xs text-red-700">{serverError}</p>
          </div>
        </div>
      )}

      {/* Restaurant Name */}
      <div>
        <label htmlFor="restaurant-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Restaurant Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Store className="w-4 h-4" />
          </div>
          <input
            id="restaurant-name"
            type="text"
            disabled={isSubmitting}
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Copper Chimney Bistro"
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 ${
              fieldErrors.name
                ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
            }`}
          />
        </div>
        {fieldErrors.name && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.name}</p>}
      </div>

      {/* Unique Slug & Live Preview */}
      <div>
        <label htmlFor="restaurant-slug" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Customer URL Slug <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center">
          <span className="bg-slate-100 border border-r-0 border-slate-300 px-3.5 py-2.5 rounded-l-xl text-slate-500 text-sm font-mono select-none">
            /menu/
          </span>
          <input
            id="restaurant-slug"
            type="text"
            disabled={isSubmitting}
            value={slug}
            onChange={handleSlugChange}
            placeholder="copper-chimney"
            className={`flex-1 px-4 py-2.5 rounded-r-xl border text-sm font-mono text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 ${
              fieldErrors.slug
                ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
            }`}
          />
        </div>
        {fieldErrors.slug ? (
          <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.slug}</p>
        ) : (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Customers will scan QR codes pointing to: </span>
            <span className="font-mono text-orange-600 font-medium">
              /menu/{slug || 'your-slug'}/[table]
            </span>
          </p>
        )}
      </div>

      {/* Contact Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phone */}
        <div>
          <label htmlFor="restaurant-phone" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Phone className="w-4 h-4" />
            </div>
            <input
              id="restaurant-phone"
              type="tel"
              disabled={isSubmitting}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="restaurant-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Contact Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="restaurant-email"
              type="email"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@copperchimney.com"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 ${
                fieldErrors.email
                  ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                  : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
              }`}
            />
          </div>
          {fieldErrors.email && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.email}</p>}
        </div>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="restaurant-address" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Physical Address
        </label>
        <div className="relative">
          <div className="absolute top-3 left-3.5 flex items-center pointer-events-none text-slate-400">
            <MapPin className="w-4 h-4" />
          </div>
          <textarea
            id="restaurant-address"
            rows={2}
            disabled={isSubmitting}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Shop 12, High Street Food Court, Indiranagar, Bengaluru, Karnataka"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 resize-none"
          />
        </div>
      </div>

      {/* Currency & Logo URL Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Currency */}
        <div>
          <label htmlFor="restaurant-currency" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Billing Currency
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <select
              id="restaurant-currency"
              disabled={isSubmitting}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            >
              <option value="INR">INR (₹ - Indian Rupee)</option>
              <option value="USD">USD ($ - US Dollar)</option>
              <option value="EUR">EUR (€ - Euro)</option>
              <option value="GBP">GBP (£ - British Pound)</option>
              <option value="AED">AED (د.إ - UAE Dirham)</option>
            </select>
          </div>
        </div>

        {/* Logo URL */}
        <div>
          <label htmlFor="restaurant-logo" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Logo URL (Optional)
          </label>
          <input
            id="restaurant-logo"
            type="url"
            disabled={isSubmitting}
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://images.example.com/logo.png"
            className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 ${
              fieldErrors.logoUrl
                ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
            }`}
          />
          {fieldErrors.logoUrl && <p className="text-xs text-red-600 mt-1 font-medium">{fieldErrors.logoUrl}</p>}
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating Restaurant...</span>
            </>
          ) : (
            <span>Complete Onboarding</span>
          )}
        </button>
      </div>
    </form>
  );
}

