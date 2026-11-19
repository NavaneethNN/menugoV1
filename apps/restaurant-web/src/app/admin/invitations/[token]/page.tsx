'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiRequest } from '@/lib/api';
import { getRoleBadgeStyles } from '@/lib/staff';
import { RestaurantMemberRole } from '@menugo/shared';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Store,
  Sparkles,
  LogIn
} from 'lucide-react';
import Link from 'next/link';

export default function InvitationAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const { data: session, isPending: sessionLoading } = useSession();

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchInvite = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest(`/api/restaurants/invitations/${token}`);
        setInvitation(data);
      } catch (err: any) {
        setError(err.message || 'Invitation is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    try {
      setAccepting(true);
      setError(null);

      await apiRequest(`/api/restaurants/invitations/${token}/accept`, {
        method: 'POST'
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  const roleInfo = invitation?.role ? getRoleBadgeStyles(invitation.role as RestaurantMemberRole) : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black flex items-center justify-center text-sm shadow-md">
            M
          </div>
          <span className="font-black text-xl text-slate-900">
            The QROS
          </span>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Invitation Unavailable</h2>
            <p className="text-slate-600 text-sm">{error}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                <span>Back to Homepage</span>
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Welcome to the Team!</h2>
            <p className="text-slate-600 text-sm">
              You are now an authorized member of <strong>{invitation?.restaurant?.name}</strong>. Redirecting to your dashboard...
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Store className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 block mb-1">
                Team Invitation
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                Join {invitation?.restaurant?.name}
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                You have been invited to collaborate as staff on The QROS.
              </p>
            </div>

            {/* Role Card */}
            {roleInfo && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Assigned Staff Role
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${roleInfo.badgeClass}`}>
                    {roleInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{roleInfo.description}</p>
              </div>
            )}

            {/* Authenticated user vs Unauthenticated */}
            {session?.user ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-slate-600">
                  Signed in as <strong>{session.user.email}</strong>
                </p>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition shadow-md shadow-red-950/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {accepting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Activating Membership...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Accept Invitation &amp; Join</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-slate-600">
                  Please sign in or create an account with <strong>{invitation?.email}</strong> to accept this invitation.
                </p>
                <Link
                  href={`/admin/login?redirect=/admin/invitations/${token}`}
                  className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm transition shadow-md flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Accept</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

