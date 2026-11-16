'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import {
  Film,
  Building2,
  Tv,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Coins,
  Globe,
  FileText,
  UtensilsCrossed,
  CreditCard,
  QrCode,
  Zap,
  Plus,
  Trash2,
  Armchair,
  Popcorn,
  ChevronRight,
  Check,
  ExternalLink
} from 'lucide-react';

interface CinemaScreenItem {
  id: string;
  screenName: string;
  screenType: string;
  totalRows: number;
  totalSeats: number;
  seatingConfigured: boolean;
}

export default function CinemaOnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [checkingExisting, setCheckingExisting] = useState(true);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxCompletedStep, setMaxCompletedStep] = useState<number>(0);

  // Theatre Data
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreData, setTheatreData] = useState<any>(null);

  // Step 1: Profile Form State
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
    timezone: 'Asia/Kolkata'
  });

  // Step 2: Screens State
  const [screens, setScreens] = useState<CinemaScreenItem[]>([]);
  const [screenNameInput, setScreenNameInput] = useState('');
  const [screenTypeInput, setScreenTypeInput] = useState('standard');
  const [addingScreen, setAddingScreen] = useState(false);

  // Step 3: Seating Layout State
  const [selectedScreenForSeating, setSelectedScreenForSeating] = useState<string>('');
  const [seatingRowsCount, setSeatingRowsCount] = useState<number>(5);
  const [seatsPerRowInput, setSeatsPerRowInput] = useState<number>(15);
  const [generatingSeating, setGeneratingSeating] = useState(false);
  const [screenSeatingDone, setScreenSeatingDone] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  // Step 4: Concessions Menu State
  const [seedingMenu, setSeedingMenu] = useState(false);
  const [seededMenuCount, setSeededMenuCount] = useState<number>(0);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // General Loading & Feedback State
  const [submittingStep, setSubmittingStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const wizardSteps = [
    { step: 1, title: 'Theatre Profile', desc: 'Identity, city & contact', icon: Building2 },
    { step: 2, title: 'Auditoriums', desc: 'Add screens & specs', icon: Tv },
    { step: 3, title: 'Seating Layout', desc: 'Rows & seat numbers', icon: Armchair },
    { step: 4, title: 'Concessions', desc: 'Popcorn & beverages', icon: UtensilsCrossed },
    { step: 5, title: 'Launch', desc: 'Ready for operations', icon: Zap }
  ];

  // Auth Guard & Existing Theatre Detection
  useEffect(() => {
    if (sessionLoading) return;

    if (!session?.user) {
      router.push('/admin/login?mode=signup&business=cinema&redirect=/cinema/onboarding');
      return;
    }

    // Check if user already has an active cinema theatre
    apiRequest('/api/restaurants/my?tenantType=cinema')
      .then(async (tenants) => {
        const cinemaTenant = Array.isArray(tenants) && tenants.find((m: any) => m.restaurant?.tenantType === 'cinema');
        if (cinemaTenant?.restaurant?.id) {
          const tId = cinemaTenant.restaurant.id;
          setTheatreId(tId);
          setTheatreData(cinemaTenant.restaurant);
          setMaxCompletedStep(1);

          // Populate profile fields
          setFormData({
            theatreName: cinemaTenant.restaurant.name || '',
            chainOrBrand: cinemaTenant.restaurant.chainOrBrand || '',
            address: cinemaTenant.restaurant.address || '',
            city: cinemaTenant.restaurant.city || '',
            state: cinemaTenant.restaurant.state || '',
            country: cinemaTenant.restaurant.country || 'India',
            contactNumber: cinemaTenant.restaurant.contactNumber || '',
            contactEmail: cinemaTenant.restaurant.contactEmail || session.user.email || '',
            businessDetails: cinemaTenant.restaurant.businessDetails || '',
            currency: cinemaTenant.restaurant.currency || 'INR',
            timezone: cinemaTenant.restaurant.timezone || 'Asia/Kolkata'
          });

          // Check screens
          try {
            const screensRes = await apiRequest('/api/cinema/screens', { theatreId: tId });
            const screenList: CinemaScreenItem[] = screensRes.screens || [];
            setScreens(screenList);

            if (screenList.length > 0) {
              setMaxCompletedStep(2);
              setSelectedScreenForSeating(screenList[0]!.id);

              // Check seating for first screen
              const seatingRes = await apiRequest(`/api/cinema/screens/${screenList[0]!.id}/seating`, { theatreId: tId });
              if (seatingRes?.totalSeats > 0) {
                setMaxCompletedStep(3);
                setScreenSeatingDone(true);
                setPreviewRows(seatingRes.rows || []);

                // Check menu products
                const prods = await apiRequest<any[]>('/api/products', { restaurantId: tId });
                if (Array.isArray(prods) && prods.length > 0) {
                  setMaxCompletedStep(4);
                  setMenuItems(prods);
                  setSeededMenuCount(prods.length);
                  setCurrentStep(5); // Land on launchpad
                } else {
                  setCurrentStep(4); // Advance to menu
                }
              } else {
                setCurrentStep(3); // Advance to seating
              }
            } else {
              setCurrentStep(2); // Advance to screens
            }
          } catch (e) {
            console.warn('Could not inspect screens/seating during onboarding resume:', e);
            setCurrentStep(2);
          }
        } else {
          // Pre-fill email from logged in user account
          if (session.user.email) {
            setFormData((prev) => ({
              ...prev,
              contactEmail: prev.contactEmail || session.user.email
            }));
          }
          setCurrentStep(1);
        }
      })
      .catch((err) => {
        console.warn('Could not check existing cinema theatres:', err);
      })
      .finally(() => {
        setCheckingExisting(false);
      });
  }, [session, sessionLoading, router]);

  // Step 1: Submit Theatre Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    if (!formData.theatreName.trim()) {
      setError('Theatre name is required');
      return;
    }

    try {
      setSubmittingStep(true);

      const payload = {
        theatreName: formData.theatreName.trim(),
        chainOrBrand: formData.chainOrBrand.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim() || 'India',
        contactNumber: formData.contactNumber.trim(),
        contactEmail: formData.contactEmail.trim().toLowerCase(),
        businessDetails: formData.businessDetails.trim() || undefined,
        currency: formData.currency || 'INR',
        timezone: formData.timezone || 'Asia/Kolkata'
      };

      const result = await apiRequest('/api/cinema/theatres', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const newTheatre = result.theatre;
      setTheatreId(newTheatre.id);
      setTheatreData(newTheatre);
      setMaxCompletedStep((prev) => Math.max(prev, 1));
      setSuccessNotice(`Theatre "${newTheatre.name}" registered successfully! Moving to Step 2.`);

      // Advance to Step 2: Screens
      setTimeout(() => {
        setSuccessNotice(null);
        setCurrentStep(2);
      }, 700);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err?.message || 'Failed to save theatre profile');
    } finally {
      setSubmittingStep(false);
    }
  };

  // Step 2: Add Screen
  const handleAddScreen = async (name: string, type: string = 'standard') => {
    if (!theatreId) return;
    if (!name.trim()) {
      setError('Please provide a screen name');
      return;
    }

    try {
      setAddingScreen(true);
      setError(null);

      const res = await apiRequest('/api/cinema/screens', {
        method: 'POST',
        theatreId,
        body: JSON.stringify({
          screenName: name.trim(),
          screenType: type,
          status: 'active'
        })
      });

      const updatedScreens = [...screens, res.screen];
      setScreens(updatedScreens);
      setScreenNameInput('');
      setSelectedScreenForSeating(res.screen.id);
      setMaxCompletedStep((prev) => Math.max(prev, 2));
      setSuccessNotice(`Screen "${res.screen.screenName}" added!`);
      setTimeout(() => setSuccessNotice(null), 2500);
    } catch (err: any) {
      console.error('Add screen failed:', err);
      setError(err?.message || 'Failed to add screen');
    } finally {
      setAddingScreen(false);
    }
  };

  // Step 3: Quick Generate Seating Layout
  const handleGenerateSeating = async () => {
    if (!theatreId || !selectedScreenForSeating) {
      setError('Please select an auditorium screen first');
      return;
    }

    const rowCount = Math.min(Math.max(seatingRowsCount, 1), 20);
    const seatCount = Math.min(Math.max(seatsPerRowInput, 1), 30);

    try {
      setGeneratingSeating(true);
      setError(null);

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const createdRows: any[] = [];

      for (let i = 0; i < rowCount; i++) {
        const rowIdChar = alphabet[i] || `R${i + 1}`;
        const category = i >= rowCount - 2 ? (rowCount > 4 ? 'premium' : 'regular') : 'regular';

        const rowRes = await apiRequest(`/api/cinema/screens/${selectedScreenForSeating}/rows`, {
          method: 'POST',
          theatreId,
          body: JSON.stringify({
            rowIdentifier: rowIdChar,
            startSeatNumber: 1,
            endSeatNumber: seatCount,
            seatCategory: category,
            status: 'active',
            sortOrder: i
          })
        });
        createdRows.push(rowRes.row);
      }

      // Fetch refreshed seating
      const seatingRes = await apiRequest(`/api/cinema/screens/${selectedScreenForSeating}/seating`, { theatreId });
      setPreviewRows(seatingRes?.rows || createdRows);
      setScreenSeatingDone(true);
      setMaxCompletedStep((prev) => Math.max(prev, 3));
      setSuccessNotice(`Generated ${rowCount} rows with ${rowCount * seatCount} seats for this auditorium!`);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to generate seating:', err);
      setError(err?.message || 'Failed to generate seating layout');
    } finally {
      setGeneratingSeating(false);
    }
  };

  // Step 4: Seed Concessions Menu Items
  const handleSeedMenu = async () => {
    if (!theatreId) return;

    try {
      setSeedingMenu(true);
      setError(null);

      // 1. Create or get category: "Popcorn & Combos"
      let cat = await apiRequest<any>('/api/categories', {
        method: 'POST',
        restaurantId: theatreId,
        body: JSON.stringify({
          name: 'Popcorn & Combos',
          description: 'Fresh theater popcorn, snacks, and combo deals',
          sortOrder: 1,
          isActive: true
        })
      }).catch(() => null);

      if (!cat?.id) {
        const cats = await apiRequest<any[]>('/api/categories', { restaurantId: theatreId });
        cat = cats?.[0];
      }

      const catId = cat?.id || null;

      // 2. Default popular items
      const standardItems = [
        { name: 'Classic Salted Popcorn (Large)', price: 18000, isVeg: true, desc: 'Hot, freshly popped corn tossed with fine sea salt' },
        { name: 'Caramel Crunch Popcorn (Large)', price: 22000, isVeg: true, desc: 'Crispy popcorn coated in rich golden caramel glaze' },
        { name: 'Loaded Cheese Nachos with Salsa', price: 19000, isVeg: true, desc: 'Warm tortilla chips served with warm cheese sauce and jalapeño salsa' },
        { name: 'Fountain Soda (Pepsi 500ml)', price: 12000, isVeg: true, desc: 'Chilled bubbly fountain soda in signature cinema cup' },
        { name: 'Movie Duo Combo (Popcorn + 2 Sodas)', price: 34000, isVeg: true, desc: 'One large tub of butter popcorn paired with two 500ml drinks' }
      ];

      for (const item of standardItems) {
        await apiRequest('/api/products', {
          method: 'POST',
          restaurantId: theatreId,
          body: JSON.stringify({
            name: item.name,
            categoryId: catId,
            price: item.price,
            description: item.desc,
            isAvailable: true,
            isVegetarian: item.isVeg,
            sortOrder: 1
          })
        }).catch((e) => console.warn('Could not seed product:', item.name, e));
      }

      const prods = await apiRequest<any[]>('/api/products', { restaurantId: theatreId });
      setMenuItems(prods || []);
      setSeededMenuCount(prods?.length || standardItems.length);
      setMaxCompletedStep((prev) => Math.max(prev, 4));
      setSuccessNotice(`Added ${standardItems.length} cinema concessions ready for in-seat ordering!`);
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      console.error('Menu seeding failed:', err);
      setError(err?.message || 'Failed to populate concessions menu');
    } finally {
      setSeedingMenu(false);
    }
  };

  if (sessionLoading || checkingExisting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-slate-400 font-medium">
          Verifying cinema administrator account...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-white leading-none">
                Menu<span className="text-indigo-400">Go</span> <span className="text-[10px] uppercase bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-800/80 ml-1">Cinema</span>
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">
                Multi-Step Onboarding
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 text-xs font-semibold">
            {theatreData && (
              <Link
                href="/cinema/admin/dashboard"
                className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 font-bold"
              >
                <span>Go to Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors hidden sm:inline"
            >
              Exit Setup
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Step Progress Bar & Navigation Stepper */}
        <div className="mb-8 p-4 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-800/80">
                Setup Step {currentStep} of 5
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                {wizardSteps[currentStep - 1]?.title}
              </h1>
            </div>
            <span className="text-xs text-slate-400">
              {theatreData?.name ? (
                <>Operating as <strong className="text-white">{theatreData.name}</strong></>
              ) : (
                'Configure cinema essentials to launch seat ordering'
              )}
            </span>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            {wizardSteps.map((s) => {
              const Icon = s.icon;
              const isCurrent = currentStep === s.step;
              const isDone = maxCompletedStep >= s.step;
              const isClickable = maxCompletedStep >= s.step - 1;

              return (
                <button
                  key={s.step}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && setCurrentStep(s.step)}
                  className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                      : isDone
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/60'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 opacity-60'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isCurrent
                        ? 'bg-white text-indigo-600'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isDone && !isCurrent ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.step}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : isDone ? 'text-emerald-200' : 'text-slate-400'}`}>
                      {s.title}
                    </p>
                    <span className="text-[10px] text-slate-400 truncate hidden sm:block">
                      {s.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 rounded-2xl text-red-300 text-xs flex items-center gap-3 shadow-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successNotice && (
          <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-emerald-300 text-xs flex items-center gap-3 shadow-lg animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* ================= STEP 1: THEATRE PROFILE ================= */}
        {currentStep === 1 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="mb-6 border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white">Step 1: Cinema Identity & Location</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter your theatre name, city, and manager contact details.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Theatre Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Theatre / Cinema Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Film className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cinepolis Nexus Grand / PVR INOX Forum"
                      value={formData.theatreName}
                      onChange={(e) => setFormData({ ...formData, theatreName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Chain / Brand */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Theatre Chain / Brand (Optional)
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Cinepolis / PVR / Independent"
                      value={formData.chainOrBrand}
                      onChange={(e) => setFormData({ ...formData, chainOrBrand: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Contact Phone (+91) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Auditorium Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <textarea
                      required
                      rows={2}
                      placeholder="Level 4, Nexus Mall, Koramangala"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengaluru, Mumbai, Delhi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karnataka, Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="manager@theatre.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* GSTIN / Business ID */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    GSTIN (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      value={formData.businessDetails}
                      onChange={(e) => setFormData({ ...formData, businessDetails: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-4">
                <Link
                  href="/"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel setup
                </Link>

                <button
                  type="submit"
                  disabled={submittingStep}
                  className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submittingStep ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Step 2: Add Screens</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 2: AUDITORIUMS / SCREENS ================= */}
        {currentStep === 2 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Step 2: Add Cinema Screens</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure the screens and auditoriums in your theatre complex.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-400 bg-indigo-950 px-3 py-1 rounded-full border border-indigo-800">
                {screens.length} Screen{screens.length === 1 ? '' : 's'} Configured
              </span>
            </div>

            {/* Quick 1-Click Screen Addition Presets */}
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                Quick 1-Click Screen Templates:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={addingScreen}
                  onClick={() => handleAddScreen('Screen 1', 'standard')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+ Screen 1 (Standard)</span>
                </button>
                <button
                  type="button"
                  disabled={addingScreen}
                  onClick={() => handleAddScreen('Screen 2', 'standard')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+ Screen 2 (Standard)</span>
                </button>
                <button
                  type="button"
                  disabled={addingScreen}
                  onClick={() => handleAddScreen('Audi 3 (Dolby Atmos)', 'dolby_atmos')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+ Audi 3 (Dolby Atmos)</span>
                </button>
                <button
                  type="button"
                  disabled={addingScreen}
                  onClick={() => handleAddScreen('Audi 4 (IMAX)', 'imax')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+ Audi 4 (IMAX Laser)</span>
                </button>
              </div>
            </div>

            {/* Custom Screen Name Input */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs font-bold text-slate-300 block mb-2">Or Add Custom Screen:</span>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="e.g. Screen 5 / VIP Gold Lounge"
                  value={screenNameInput}
                  onChange={(e) => setScreenNameInput(e.target.value)}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={screenTypeInput}
                  onChange={(e) => setScreenTypeInput(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="standard">Standard Screen</option>
                  <option value="dolby_atmos">Dolby Atmos</option>
                  <option value="imax">IMAX Laser</option>
                  <option value="vip">VIP Lounge</option>
                  <option value="4dx">4DX Motion</option>
                </select>
                <button
                  type="button"
                  disabled={addingScreen || !screenNameInput.trim()}
                  onClick={() => handleAddScreen(screenNameInput, screenTypeInput)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {addingScreen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add Screen</span>
                </button>
              </div>
            </div>

            {/* Configured Screens List */}
            <div className="space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Screens in This Theatre ({screens.length}):
              </span>
              {screens.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  <Tv className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <span>No screens added yet. Click one of the quick templates above to add your first screen.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {screens.map((sc) => (
                    <div
                      key={sc.id}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                          <Tv className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{sc.screenName}</h4>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {sc.screenType}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Navigation Footer */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Step 1 (Profile)</span>
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/cinema/admin/dashboard"
                  className="flex-1 sm:flex-none text-xs text-slate-400 hover:text-white px-4 py-3 rounded-xl border border-slate-800 text-center"
                >
                  Skip to Dashboard
                </Link>

                <button
                  type="button"
                  disabled={screens.length === 0}
                  onClick={() => {
                    if (screens.length > 0) {
                      setSelectedScreenForSeating(screens[0]!.id);
                      setCurrentStep(3);
                    }
                  }}
                  className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-40"
                >
                  <span>Continue to Step 3: Seating</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: SEATING LAYOUT ================= */}
        {currentStep === 3 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Step 3: Seating Layout Setup</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate row-by-row seat layouts for contactless in-seat orders.
                </p>
              </div>

              {screens.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-semibold">Configuring:</span>
                  <select
                    value={selectedScreenForSeating}
                    onChange={(e) => setSelectedScreenForSeating(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs"
                  >
                    {screens.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.screenName} ({s.screenType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Generator Panel */}
            <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-800/60 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  One-Click Seat Generator
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Choose the number of rows and seats per row to auto-generate seat labels (A1..A15, B1..B15, etc.).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Number of Rows (A to...)
                  </label>
                  <select
                    value={seatingRowsCount}
                    onChange={(e) => setSeatingRowsCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                  >
                    <option value={4}>4 Rows (Rows A to D • Boutique)</option>
                    <option value={5}>5 Rows (Rows A to E • Standard Audi)</option>
                    <option value={8}>8 Rows (Rows A to H • Medium Audi)</option>
                    <option value={10}>10 Rows (Rows A to J • Large Audi)</option>
                    <option value={12}>12 Rows (Rows A to L • Mega Cine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Seats Per Row
                  </label>
                  <select
                    value={seatsPerRowInput}
                    onChange={(e) => setSeatsPerRowInput(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold"
                  >
                    <option value={10}>10 Seats per row (1..10)</option>
                    <option value={15}>15 Seats per row (1..15)</option>
                    <option value={20}>20 Seats per row (1..20)</option>
                    <option value={25}>25 Seats per row (1..25)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-indigo-300 font-semibold">
                  Total Seats to Generate: <strong className="text-white">{seatingRowsCount * seatsPerRowInput} seats</strong>
                </span>

                <button
                  type="button"
                  disabled={generatingSeating}
                  onClick={handleGenerateSeating}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {generatingSeating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Seats...</span>
                    </>
                  ) : (
                    <>
                      <Armchair className="w-3.5 h-3.5" />
                      <span>Generate Layout Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Visual Seat Layout Preview */}
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-4">
              {/* Cinema Screen Indicator */}
              <div className="w-3/4 mx-auto pb-3">
                <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent rounded-full shadow-lg shadow-indigo-500/50" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1 block">
                  ALL EYES THIS WAY • CINEMA SCREEN
                </span>
              </div>

              {previewRows.length === 0 ? (
                <div className="py-8 text-xs text-slate-400">
                  <Armchair className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <span>No seating layout configured yet. Click "Generate Layout Now" above.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {previewRows.map((row, idx) => (
                    <div key={idx} className="flex items-center justify-center gap-1.5 text-xs">
                      <span className="w-6 font-bold text-indigo-400 text-[11px] text-right">
                        {row.rowIdentifier || String.fromCharCode(65 + idx)}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-center">
                        {Array.from({ length: Math.min(row.totalSeats || seatsPerRowInput, 15) }).map((_, sIdx) => (
                          <div
                            key={sIdx}
                            className="w-4 h-4 rounded-sm bg-indigo-900/60 border border-indigo-700/80 text-[8px] flex items-center justify-center text-indigo-200"
                            title={`Seat ${row.rowIdentifier || String.fromCharCode(65 + idx)}${sIdx + 1}`}
                          >
                            {sIdx + 1}
                          </div>
                        ))}
                        {(row.totalSeats || seatsPerRowInput) > 15 && (
                          <span className="text-[9px] text-slate-400 px-1">+{(row.totalSeats || seatsPerRowInput) - 15} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Navigation Footer */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Step 2 (Screens)</span>
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/cinema/admin/dashboard"
                  className="flex-1 sm:flex-none text-xs text-slate-400 hover:text-white px-4 py-3 rounded-xl border border-slate-800 text-center"
                >
                  Skip to Dashboard
                </Link>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <span>Continue to Step 4: Food Menu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: CONCESSIONS MENU ================= */}
        {currentStep === 4 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Step 4: Concessions & Food Menu</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Populate your cinema concessions menu with popcorn, nachos, and chilled fountain sodas.
                </p>
              </div>

              <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800">
                {menuItems.length} Product{menuItems.length === 1 ? '' : 's'} Ready
              </span>
            </div>

            {/* Quick 1-Click Menu Seeder */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-800/80 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Popcorn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Recommended Cinema Concession Package</h3>
                  <p className="text-xs text-slate-300">
                    Pre-loads standard theater favorites: Salted Popcorn, Caramel Popcorn, Nachos, and Fountain Sodas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-bold text-white block">Salted Popcorn</span>
                  <span className="text-emerald-400 font-semibold">₹180</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-bold text-white block">Caramel Popcorn</span>
                  <span className="text-emerald-400 font-semibold">₹220</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-bold text-white block">Loaded Nachos</span>
                  <span className="text-emerald-400 font-semibold">₹190</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="font-bold text-white block">Fountain Soda</span>
                  <span className="text-emerald-400 font-semibold">₹120</span>
                </div>
              </div>

              <button
                type="button"
                disabled={seedingMenu}
                onClick={handleSeedMenu}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {seedingMenu ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Adding Concessions to Menu...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>1-Click Add Popular Concessions Package</span>
                  </>
                )}
              </button>
            </div>

            {/* Menu Items Preview */}
            <div className="space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Configured Concessions ({menuItems.length}):
              </span>
              {menuItems.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  <UtensilsCrossed className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <span>No menu items added yet. Click the 1-Click button above to add popular cinema snacks.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {menuItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                        <span className="text-[10px] text-slate-400 truncate block">{item.description}</span>
                      </div>
                      <span className="text-xs font-black text-emerald-400 shrink-0">
                        ₹{(item.price / 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Navigation Footer */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Step 3 (Seating)</span>
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/cinema/admin/dashboard"
                  className="flex-1 sm:flex-none text-xs text-slate-400 hover:text-white px-4 py-3 rounded-xl border border-slate-800 text-center"
                >
                  Skip to Dashboard
                </Link>

                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  <span>Complete Setup &amp; Launch</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: LAUNCHPAD & READY ================= */}
        {currentStep === 5 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 text-center max-w-2xl mx-auto">
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-3xl bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-950/80">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Setup Complete • Theatre Live</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {theatreData?.name || formData.theatreName} is Ready!
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                Your auditorium screens, seat rows, and concessions menu have been successfully configured. You can now launch operations.
              </p>
            </div>

            {/* Setup Summary Snapshot */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Screens</span>
                <span className="text-lg font-black text-white mt-0.5 block">{screens.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Seating</span>
                <span className="text-lg font-black text-emerald-400 mt-0.5 block">Configured</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Menu</span>
                <span className="text-lg font-black text-indigo-400 mt-0.5 block">{menuItems.length} Items</span>
              </div>
            </div>

            {/* Primary Action Launch Buttons */}
            <div className="space-y-3 pt-2">
              <Link
                href="/cinema/admin/dashboard"
                className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30"
              >
                <span>Enter Cinema Management Console</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/cinema/kitchen"
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  <span>Open Kitchen Display (KDS)</span>
                </Link>

                <Link
                  href="/cinema/admin/qr"
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-indigo-400" />
                  <span>Deploy Screen QR Codes</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>MenuGo Cinema Module • Multi-Tenant Enterprise Architecture</p>
      </footer>
    </div>
  );
}
