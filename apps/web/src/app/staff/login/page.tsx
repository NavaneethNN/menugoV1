'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import {
  KeyRound,
  Lock,
  Store,
  ChefHat,
  UtensilsCrossed,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Delete,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface ActiveRestaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

function StaffLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRestaurantSlug = searchParams.get('restaurant') || '';

  // Step state: 'select_restaurant' | 'enter_pin' | 'enter_password' | 'setup_password'
  const [step, setStep] = useState<'enter_pin' | 'enter_password' | 'setup_password'>('enter_pin');

  // Restaurant Context
  const [restaurants, setRestaurants] = useState<ActiveRestaurant[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(initialRestaurantSlug);
  const [selectedRestaurant, setSelectedRestaurant] = useState<ActiveRestaurant | null>(null);

  // Form Fields
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // First-time setup info from server
  const [staffInfo, setStaffInfo] = useState<{
    staffName: string;
    restaurantName: string;
    role: string;
    message: string;
  } | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active target field for on-screen numpad: 'pin' | 'password' | 'confirm'
  const [activeInput, setActiveInput] = useState<'pin' | 'password' | 'confirm'>('pin');

  // 1. Load active restaurants list
  useEffect(() => {
    async function loadRestaurants() {
      try {
        setLoadingRestaurants(true);
        const data = await apiRequest<ActiveRestaurant[]>('/api/auth/staff-restaurants');
        setRestaurants(data);
        if (data.length > 0) {
          const match = initialRestaurantSlug
            ? data.find((r) => r.slug === initialRestaurantSlug)
            : null;
          const chosen = match || data[0];
          if (chosen) {
            setSelectedSlug(chosen.slug);
            setSelectedRestaurant(chosen);
          }
        }
      } catch (err: any) {
        console.error('Failed to load restaurants:', err);
      } finally {
        setLoadingRestaurants(false);
      }
    }
    loadRestaurants();
  }, [initialRestaurantSlug]);

  const handleRestaurantChange = (slug: string) => {
    setSelectedSlug(slug);
    const rest = restaurants.find((r) => r.slug === slug) || null;
    setSelectedRestaurant(rest);
    setPin('');
    setPassword('');
    setConfirmPassword('');
    setStep('enter_pin');
    setError(null);
  };

  // Numpad handler
  const handleNumpadPress = useCallback((digit: string) => {
    setError(null);
    if (activeInput === 'pin') {
      setPin((prev) => (prev.length < 4 ? prev + digit : prev));
    } else if (activeInput === 'password') {
      setPassword((prev) => {
        const next = prev.length < 4 ? prev + digit : prev;
        // In password setup, auto-advance to confirm once 4 digits are typed
        if (step === 'setup_password' && next.length === 4) {
          setTimeout(() => setActiveInput('confirm'), 50);
        }
        return next;
      });
    } else if (activeInput === 'confirm') {
      setConfirmPassword((prev) => (prev.length < 4 ? prev + digit : prev));
    }
  }, [activeInput, step]);

  const handleNumpadDelete = useCallback(() => {
    setError(null);
    if (activeInput === 'pin') {
      setPin((prev) => prev.slice(0, -1));
    } else if (activeInput === 'password') {
      setPassword((prev) => prev.slice(0, -1));
    } else if (activeInput === 'confirm') {
      setConfirmPassword((prev) => prev.slice(0, -1));
    }
  }, [activeInput]);

  const handleNumpadClear = () => {
    setError(null);
    if (activeInput === 'pin') setPin('');
    else if (activeInput === 'password') setPassword('');
    else if (activeInput === 'confirm') setConfirmPassword('');
  };

  // Keyboard shortcut listener for desktop/physical keypads
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        handleNumpadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleNumpadDelete();
      } else if (e.key === 'Enter') {
        if (step === 'enter_pin' && pin.length === 4) {
          handleCheckPin();
        } else if (step === 'setup_password' && password.length === 4 && confirmPassword.length === 4) {
          handleSetPasswordAndLogin();
        } else if (step === 'enter_password' && password.length === 4) {
          handleReturningLogin();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNumpadDelete, handleNumpadPress, step, pin, password, confirmPassword]);

  // 2. Submit Step 1: Check 4-digit PIN
  const handleCheckPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSlug) {
      setError('Please select your restaurant');
      return;
    }
    if (pin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verify PIN via dedicated PIN check endpoint
      const res = await apiRequest('/api/auth/staff-pin-check', {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug: selectedSlug,
          pin
        })
      });

      // Always populate identified staff info
      setStaffInfo({
        staffName: res.staffName,
        restaurantName: res.restaurantName,
        role: res.role,
        message: res.message
      });

      if (res.firstTimeLogin) {
        // First-time login: Prompt staff to set password
        setStep('setup_password');
        setActiveInput('password');
        setPassword('');
        setConfirmPassword('');
      } else {
        // Returning staff: Prompt for 4-digit password
        setStep('enter_password');
        setActiveInput('password');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid 4-digit PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Step 2: Set 4-digit password on first login
  const handleSetPasswordAndLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password.length !== 4) {
      setError('Password must be exactly 4 numeric digits');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await apiRequest('/api/auth/staff-login', {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug: selectedSlug,
          pin,
          password
        })
      });

      setSuccessMsg(`Welcome, ${res.user.name}! Logging you in...`);
      // Hard navigation ensures browser reloads all Better Auth cookies and initializes workstation session
      setTimeout(() => {
        window.location.href = res.redirectTo || '/kitchen';
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  // 4. Submit Step 3: Returning staff login with PIN + Password
  const handleReturningLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password.length !== 4) {
      setError('Please enter your 4-digit password');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await apiRequest('/api/auth/staff-login', {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug: selectedSlug,
          pin,
          password
        })
      });

      setSuccessMsg(`Welcome back, ${res.user.name}! Logging you in...`);
      // Hard navigation ensures browser reloads all Better Auth cookies and initializes workstation session
      setTimeout(() => {
        window.location.href = res.redirectTo || '/kitchen';
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Invalid 4-digit password');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 text-white text-center relative">
        <div className="w-12 h-12 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-950/40">
          <KeyRound className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl md:text-2xl font-black tracking-tight">Staff Direct Access</h2>
        <p className="text-slate-400 text-xs mt-1">Fast 4-digit PIN terminal for Kitchen & Floor staff</p>

        {/* Back Link */}
        <Link
          href="/admin/login"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl transition"
          title="Back to Admin Email Login"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Restaurant Selector */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
            Restaurant
          </label>
          {loadingRestaurants ? (
            <div className="h-12 bg-slate-100 rounded-2xl animate-pulse flex items-center px-4 text-xs text-slate-400">
              Loading restaurants...
            </div>
          ) : restaurants.length > 0 ? (
            <div className="relative">
              <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedSlug}
                onChange={(e) => handleRestaurantChange(e.target.value)}
                disabled={step !== 'enter_pin' || loading}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 transition appearance-none"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-800 text-xs font-medium">
              No active restaurants found. Please contact the administrator.
            </div>
          )}
        </div>

        {/* STEP 1: Enter 4-Digit PIN */}
        {step === 'enter_pin' && (
          <form onSubmit={handleCheckPin} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Enter Your 4-Digit PIN
                </label>
                <span className="text-[11px] font-semibold text-slate-400">Assigned by Manager</span>
              </div>

              {/* 4 Large Digit Display Boxes */}
              <div
                onClick={() => setActiveInput('pin')}
                className="flex items-center justify-center gap-3 cursor-pointer py-2"
              >
                {[0, 1, 2, 3].map((idx) => {
                  const val = pin[idx] || '';
                  const isActive = activeInput === 'pin' && pin.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition ${
                        val
                          ? 'border-orange-500 bg-orange-50/50 text-slate-900 shadow-sm'
                          : isActive
                          ? 'border-orange-500 bg-white shadow-md animate-pulse ring-2 ring-orange-200'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {val || (isActive ? '|' : '•')}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Touch Numpad */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  type="button"
                  key={digit}
                  onClick={() => handleNumpadPress(digit)}
                  className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-orange-100 active:text-orange-700 text-slate-800 font-black text-xl rounded-2xl transition shadow-2xs flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleNumpadClear}
                className="h-13 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-2xl transition flex items-center justify-center uppercase tracking-wider"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress('0')}
                className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-orange-100 active:text-orange-700 text-slate-800 font-black text-xl rounded-2xl transition shadow-2xs flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleNumpadDelete}
                className="h-13 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition flex items-center justify-center"
                title="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={pin.length !== 4 || loading}
              className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: First-Time Setup (Create 4-Digit Password) */}
        {step === 'setup_password' && (
          <form onSubmit={handleSetPasswordAndLogin} className="space-y-5">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
              <span className="font-extrabold block mb-0.5">
                👋 Welcome, {staffInfo?.staffName}!
              </span>
              <p className="text-amber-800">
                This is your first login. Please choose a private <strong>4-digit password</strong>. You will use this password alongside your PIN for every future login.
              </p>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                New 4-Digit Password
              </label>
              <div
                onClick={() => setActiveInput('password')}
                className={`flex items-center justify-center gap-3 cursor-pointer p-2 rounded-2xl border ${
                  activeInput === 'password' ? 'bg-orange-50/40 border-orange-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const val = password[idx] || '';
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-14 rounded-xl border flex items-center justify-center text-xl font-black ${
                        val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-300 border-slate-300'
                      }`}
                    >
                      {val ? '•' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm Password input */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                Confirm 4-Digit Password
              </label>
              <div
                onClick={() => setActiveInput('confirm')}
                className={`flex items-center justify-center gap-3 cursor-pointer p-2 rounded-2xl border ${
                  activeInput === 'confirm' ? 'bg-orange-50/40 border-orange-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const val = confirmPassword[idx] || '';
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-14 rounded-xl border flex items-center justify-center text-xl font-black ${
                        val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-300 border-slate-300'
                      }`}
                    >
                      {val ? '•' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Touch Numpad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  type="button"
                  key={digit}
                  onClick={() => handleNumpadPress(digit)}
                  className="h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg rounded-xl transition flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleNumpadClear}
                className="h-11 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-xl transition flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress('0')}
                className="h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg rounded-xl transition flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleNumpadDelete}
                className="h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_pin');
                  setActiveInput('pin');
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={password.length !== 4 || confirmPassword.length !== 4 || loading}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Password & Sign In</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Returning Staff (Enter 4-Digit Password) */}
        {step === 'enter_password' && (
          <form onSubmit={handleReturningLogin} className="space-y-5">
            {/* Staff Recognition Card */}
            {staffInfo?.staffName && (
              <div className="p-3.5 bg-orange-50/70 border border-orange-200/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-600 font-black text-sm">
                    {staffInfo.staffName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-none mb-1">
                      Staff Member
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 leading-none">
                      {staffInfo.staffName}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-white border border-orange-200/80 rounded-xl text-[10px] font-black uppercase text-orange-700 tracking-wider shadow-2xs">
                  {staffInfo.role || 'Staff'}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Enter Your 4-Digit Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('enter_pin');
                    setActiveInput('pin');
                  }}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-700"
                >
                  Change PIN
                </button>
              </div>

              {/* 4 Large Password Boxes */}
              <div
                onClick={() => setActiveInput('password')}
                className="flex items-center justify-center gap-3 cursor-pointer py-2"
              >
                {[0, 1, 2, 3].map((idx) => {
                  const val = password[idx] || '';
                  const isActive = activeInput === 'password' && password.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition ${
                        val
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : isActive
                          ? 'border-orange-500 bg-white shadow-md animate-pulse ring-2 ring-orange-200'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {val ? '•' : isActive ? '|' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Touch Numpad */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  type="button"
                  key={digit}
                  onClick={() => handleNumpadPress(digit)}
                  className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-orange-100 active:text-orange-700 text-slate-800 font-black text-xl rounded-2xl transition shadow-2xs flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleNumpadClear}
                className="h-13 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-2xl transition flex items-center justify-center uppercase tracking-wider"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress('0')}
                className="h-13 bg-slate-100 hover:bg-slate-200 active:bg-orange-100 active:text-orange-700 text-slate-800 font-black text-xl rounded-2xl transition shadow-2xs flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleNumpadDelete}
                className="h-13 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep('enter_pin');
                  setActiveInput('pin');
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={password.length !== 4 || loading}
                className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In to Workstation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="pt-2 text-center border-t border-slate-100">
          <Link
            href="/admin/login"
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            Manager or Owner? Sign in with Email →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-white text-sm">Loading staff terminal...</div>}>
        <StaffLoginContent />
      </Suspense>
    </div>
  );
}
