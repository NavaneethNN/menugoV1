'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { CinemaSettingsTabs } from '@/components/cinema/CinemaSettingsTabs';
import {
  QrCode,
  Download,
  Copy,
  RefreshCw,
  Ban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Tv,
  Film,
  Sparkles,
  ExternalLink,
  Printer,
  History,
  Check,
  Plus,
  ShieldAlert,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';

interface CinemaQrCode {
  id: string;
  theatreId: string;
  screenId?: string | null;
  screenName?: string;
  screenType?: string;
  totalSeats?: number;
  qrType: 'theatre' | 'screen';
  qrName: string;
  token: string;
  theatreToken?: string | null;
  screenToken?: string | null;
  targetUrl: string;
  qrCodeData: string;
  status: 'active' | 'revoked' | 'replaced';
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CinemaScreen {
  id: string;
  screenName: string;
  screenType: string;
  totalSeats: number;
}

export default function CinemaQrManagementPage() {
  const [theatreId, setTheatreId] = useState<string | null>(null);
  const [theatreName, setTheatreName] = useState<string>('');
  const [theatreQr, setTheatreQr] = useState<CinemaQrCode | null>(null);
  const [screenQrs, setScreenQrs] = useState<CinemaQrCode[]>([]);
  const [screensWithoutQr, setScreensWithoutQr] = useState<CinemaScreen[]>([]);
  const [history, setHistory] = useState<CinemaQrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals & States
  const [previewQr, setPreviewQr] = useState<CinemaQrCode | null>(null);
  const [confirmRevokeQr, setConfirmRevokeQr] = useState<CinemaQrCode | null>(null);
  const [confirmRegenerateQr, setConfirmRegenerateQr] = useState<CinemaQrCode | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    loadTheatreAndQrs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTheatreAndQrs = async () => {
    try {
      setLoading(true);
      setError(null);

      const myMemberships = await apiRequest('/api/restaurants/my');
      const cinemaMembership = myMemberships.find(
        (m: any) => m.restaurant?.tenantType === 'cinema'
      );

      if (!cinemaMembership || !cinemaMembership.restaurant) {
        throw new Error('No cinema theatre found for the authenticated account');
      }

      const tId = cinemaMembership.restaurant.id;
      setTheatreId(tId);
      setTheatreName(cinemaMembership.restaurant.name);

      await fetchQrData(tId);
    } catch (err: any) {
      console.error('Failed to load cinema QR codes:', err);
      setError(err?.message || 'Failed to load QR code management data');
    } finally {
      setLoading(false);
    }
  };

  const fetchQrData = async (tId: string) => {
    try {
      const data = await apiRequest('/api/cinema/qr', { theatreId: tId });
      setTheatreQr(data.theatreQr || null);
      setScreenQrs(data.screenQrs || []);
      setScreensWithoutQr(data.screensWithoutQr || []);
      setHistory(data.history || []);
    } catch (err: any) {
      console.error('Failed to fetch QR details:', err);
      setError(err?.message || 'Failed to retrieve QR codes');
    }
  };

  // Generate Theatre QR
  const handleGenerateTheatreQr = async () => {
    if (!theatreId) return;
    try {
      setActionLoading(true);
      setError(null);

      await apiRequest('/api/cinema/qr/theatre', {
        method: 'POST',
        theatreId
      });

      setSuccess('General theatre QR code generated successfully!');
      await fetchQrData(theatreId);
    } catch (err: any) {
      console.error('Failed to generate theatre QR:', err);
      setError(err?.message || 'Failed to generate theatre QR code');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Screen QR
  const handleGenerateScreenQr = async (screenId: string) => {
    if (!theatreId) return;
    try {
      setActionLoading(true);
      setError(null);

      await apiRequest(`/api/cinema/qr/screens/${screenId}`, {
        method: 'POST',
        theatreId
      });

      setSuccess('Screen QR code generated successfully!');
      await fetchQrData(theatreId);
    } catch (err: any) {
      console.error('Failed to generate screen QR:', err);
      setError(err?.message || 'Failed to generate screen QR code');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate All Screens QR in bulk
  const handleGenerateAllScreenQrs = async () => {
    if (!theatreId || screensWithoutQr.length === 0) return;
    try {
      setActionLoading(true);
      setError(null);

      for (const scr of screensWithoutQr) {
        await apiRequest(`/api/cinema/qr/screens/${scr.id}`, {
          method: 'POST',
          theatreId
        });
      }

      setSuccess(`Generated QR codes for all ${screensWithoutQr.length} screens!`);
      await fetchQrData(theatreId);
    } catch (err: any) {
      console.error('Failed to generate all screen Qrs:', err);
      setError(err?.message || 'Failed to generate some screen QR codes');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke QR code
  const handleRevokeQr = async () => {
    if (!theatreId || !confirmRevokeQr) return;
    try {
      setActionLoading(true);
      setError(null);

      await apiRequest(`/api/cinema/qr/${confirmRevokeQr.id}/revoke`, {
        method: 'POST',
        theatreId
      });

      setSuccess(`QR code "${confirmRevokeQr.qrName}" has been revoked.`);
      setConfirmRevokeQr(null);
      await fetchQrData(theatreId);
    } catch (err: any) {
      console.error('Failed to revoke QR code:', err);
      setError(err?.message || 'Failed to revoke QR code');
    } finally {
      setActionLoading(false);
    }
  };

  // Regenerate QR code
  const handleRegenerateQr = async () => {
    if (!theatreId || !confirmRegenerateQr) return;
    try {
      setActionLoading(true);
      setError(null);

      await apiRequest(`/api/cinema/qr/${confirmRegenerateQr.id}/regenerate`, {
        method: 'POST',
        theatreId
      });

      setSuccess(`QR code "${confirmRegenerateQr.qrName}" regenerated with fresh token.`);
      setConfirmRegenerateQr(null);
      await fetchQrData(theatreId);
    } catch (err: any) {
      console.error('Failed to regenerate QR code:', err);
      setError(err?.message || 'Failed to regenerate QR code');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy target URL to clipboard
  const handleCopyUrl = (qr: CinemaQrCode) => {
    navigator.clipboard.writeText(qr.targetUrl);
    setCopiedId(qr.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">Loading QR Code Deployment...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 print:hidden">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">QR Code Deployment</h1>
              <p className="text-xs text-slate-400 font-medium">
                {theatreName} • Secure Stand QR Codes for In-Auditorium & Lobby Ordering
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {screensWithoutQr.length > 0 && (
            <button
              onClick={handleGenerateAllScreenQrs}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate All Screen QRs ({screensWithoutQr.length})
            </button>
          )}

          {!theatreQr && (
            <button
              onClick={handleGenerateTheatreQr}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              Generate General Theatre QR
            </button>
          )}
        </div>
      </div>

      {/* Settings & Operations Unified Sub-Tab Navigation */}
      <CinemaSettingsTabs />

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: General Theatre QR Stand */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-400 uppercase tracking-wider border border-indigo-500/30">
                Primary Theatre Stand
              </span>
              <span className="text-xs text-slate-400 font-medium">• Lobby / Concessions / General Entry</span>
            </div>
            <h2 className="text-lg font-black text-white mt-1">General Cinema Theatre QR Code</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customers scan this QR code to view the theatre menu, choose an auditorium, and order food directly to their seat.
            </p>
          </div>

          {theatreQr && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewQr(theatreQr)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-indigo-400" />
                Preview & Print Stand
              </button>
              <a
                href={theatreQr.qrCodeData}
                download={`${theatreName.toLowerCase().replace(/\s+/g, '-')}-general-qr.png`}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </a>
            </div>
          )}
        </div>

        {theatreQr ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* QR Thumbnail */}
            <div className="md:col-span-3 flex justify-center">
              <div
                onClick={() => setPreviewQr(theatreQr)}
                className="group relative cursor-pointer p-4 bg-white rounded-2xl shadow-xl transition-transform hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theatreQr.qrCodeData}
                  alt="General Theatre QR"
                  className="w-44 h-44 object-contain"
                />
                <div className="absolute inset-0 bg-indigo-900/80 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white font-bold text-xs transition-opacity">
                  <Printer className="w-6 h-6 mb-1 text-indigo-300" />
                  <span>Click to Preview</span>
                </div>
              </div>
            </div>

            {/* Info and Token Breakdown */}
            <div className="md:col-span-9 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Status</p>
                  <p className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active & Deployable
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Cryptographic Entropy</p>
                  <p className="text-xs font-bold text-indigo-400 mt-0.5">
                    192 Bits (Unguessable)
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Target Customer Route</p>
                  <p className="text-xs font-bold text-slate-300 mt-0.5 truncate">
                    /cinema/{theatreQr.token.slice(0, 10)}...
                  </p>
                </div>
              </div>

              {/* Public URL Box */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Public Encoded URL
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                  <span className="flex-1 truncate">{theatreQr.targetUrl}</span>
                  <button
                    onClick={() => handleCopyUrl(theatreQr)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
                    title="Copy URL"
                  >
                    {copiedId === theatreQr.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={theatreQr.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Dangerous actions: Replace / Revoke */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setConfirmRegenerateQr(theatreQr)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  Regenerate Token
                </button>
                <button
                  onClick={() => setConfirmRevokeQr(theatreQr)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Revoke Stand QR
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center">
            <QrCode className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">No General Theatre QR Code Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              Generate a primary contactless QR code for your theatre lobby or entry stands to allow guests to browse your concessions menu and pick their auditorium.
            </p>
            <button
              onClick={handleGenerateTheatreQr}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Theatre QR Stand
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Screen-Specific QR Codes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-indigo-400" />
              Auditorium Screen-Specific QR Codes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              These QR stands are placed inside specific auditoriums to automatically preselect the customer&apos;s screen.
            </p>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            {screenQrs.length} Active • {screensWithoutQr.length} Pending Screens
          </span>
        </div>

        {screenQrs.length === 0 && screensWithoutQr.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400">
              No screens configured yet. Please add cinema screens in the Screens section first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Active Screen QRs */}
            {screenQrs.map((qr) => (
              <div
                key={qr.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Active Stand
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {qr.screenType?.toUpperCase() || 'STANDARD'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{qr.qrName}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Preselects {qr.screenName} • {qr.totalSeats || 0} Seats Capacity
                  </p>

                  {/* QR Image & URL */}
                  <div className="my-4 flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div
                      onClick={() => setPreviewQr(qr)}
                      className="cursor-pointer bg-white p-2 rounded-lg shrink-0 hover:scale-105 transition-transform"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr.qrCodeData} alt={qr.qrName} className="w-20 h-20 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Customer Route</p>
                      <p className="text-xs font-mono text-slate-300 truncate mt-0.5">
                        {qr.targetUrl}
                      </p>
                      <button
                        onClick={() => handleCopyUrl(qr)}
                        className="mt-2 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        {copiedId === qr.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === qr.id ? 'Copied!' : 'Copy URL'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewQr(qr)}
                      title="Preview & Print"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={qr.qrCodeData}
                      download={`${qr.qrName.toLowerCase().replace(/\s+/g, '-')}.png`}
                      title="Download PNG"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setConfirmRegenerateQr(qr)}
                      title="Regenerate Token"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmRevokeQr(qr)}
                      title="Revoke Screen QR"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Screens without active QR */}
            {screensWithoutQr.map((scr) => (
              <div
                key={scr.id}
                className="p-5 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400">
                      Stand Not Deployed
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {scr.screenType?.toUpperCase() || 'STANDARD'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{scr.screenName}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {scr.totalSeats || 0} Seats • No Screen-Specific QR Generated
                  </p>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => handleGenerateScreenQr(scr.id)}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    Generate QR Stand
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Historical / Revoked Audit Log */}
      {history.length > 0 && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              Token History & Revocation Audit Log
            </h3>
            <span className="text-xs text-slate-500">{history.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5">QR Stand Name</th>
                  <th className="py-2.5">Type</th>
                  <th className="py-2.5">Public Token</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Updated / Revoked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 font-sans font-medium text-white">{h.qrName}</td>
                    <td className="py-2.5 uppercase text-[10px] text-slate-400">{h.qrType}</td>
                    <td className="py-2.5 text-slate-400">{h.token.slice(0, 16)}...</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                          h.status === 'revoked'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {h.status === 'revoked' ? 'Revoked' : 'Replaced'}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400 text-[11px] font-sans">
                      {new Date(h.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* PREVIEW & PRINT STAND MODAL */}
      {previewQr && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:block print:overflow-visible">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md my-auto shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:max-w-none print:w-full print:m-0 print:block">
            <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 shrink-0 print:hidden bg-slate-950/60 rounded-t-3xl">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">Printable QR Stand Preview</h3>
                <p className="text-[11px] text-slate-400">High-resolution QR Stand Card</p>
              </div>
              <button
                onClick={() => setPreviewQr(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 print:p-0 print:overflow-visible">
              {/* Stand Graphic */}
              <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl border-2 border-slate-200 print:border-2 print:border-slate-800 print:rounded-3xl print:p-8 print:max-w-md print:mx-auto print:my-4 print:shadow-none print:break-inside-avoid">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 block">
                    {theatreName}
                  </span>
                  <h4 className="text-xl font-black tracking-tight mt-0.5 text-slate-950">
                    {previewQr.qrName}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                    Scan to order food, snacks &amp; beverages directly to your seat
                  </p>
                </div>

                <div className="flex justify-center p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs inline-block print:border-2 print:border-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewQr.qrCodeData}
                    alt={previewQr.qrName}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider print:text-slate-600">
                    Powered by The QROS Cinema Contactless SaaS
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons (Pinned footer, always visible, hidden during print) */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 rounded-b-3xl shrink-0 print:hidden">
              <button
                onClick={() => setPreviewQr(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
              <a
                href={previewQr.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4 text-indigo-400" />
                <span>Test Live Menu</span>
              </a>
              <a
                href={previewQr.qrCodeData}
                download={`${previewQr.qrName.toLowerCase().replace(/\s+/g, '-')}.png`}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Download PNG</span>
              </a>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>Print Stand Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REVOCATION MODAL */}
      {confirmRevokeQr && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Revoke QR Code?</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to revoke &ldquo;{confirmRevokeQr.qrName}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              Any printed stands with this QR code will immediately stop working and return an &ldquo;Invalid or Expired QR&rdquo; error when scanned by customers.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmRevokeQr(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeQr}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Revoke QR Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REGENERATION MODAL */}
      {confirmRegenerateQr && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Regenerate QR Code?</h3>
                <p className="text-xs text-slate-400">
                  Replace token for &ldquo;{confirmRegenerateQr.qrName}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              This will generate a brand new cryptographic token and QR image. You must reprint or replace the physical stand, as the previous stand token will be marked replaced.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmRegenerateQr(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateQr}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Regenerate & Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
