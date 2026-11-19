'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Server,
  KeyRound,
  Mail,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Database,
  Globe
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function SuperAdminSettingsPage() {
  const restaurantUrl = process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000';
  const cinemaUrl = process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInfo() {
      try {
        const data = await apiRequest('/api/super-admin/me');
        setAdminData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadInfo();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-black text-slate-950 tracking-tight">Platform Governance &amp; Settings</h2>
        <p className="text-xs text-slate-500 mt-1">
          Internal configuration parameters, microservice endpoints, and platform operator credentials.
        </p>
      </div>

      {/* Admin Identity Card */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-black text-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-base text-slate-900">Operator Identity</h3>
            <p className="text-xs text-slate-500">Authenticated administrative profile for this session</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Admin Name</span>
            <span className="font-extrabold text-slate-900 text-sm mt-1 block">
              {adminData?.user?.name || 'Platform Administrator'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Admin Email</span>
            <span className="font-extrabold text-slate-900 text-sm mt-1 block font-mono">
              {adminData?.user?.email || 'superadmin@menugo.in'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Authorization Role</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-red-700 text-xs mt-1">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              <span>SUPER_ADMINISTRATOR (Full Tenant &amp; Billing Access)</span>
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Emergency Master Key</span>
            <span className="font-bold text-slate-800 text-xs mt-1 block">
              Configured via SUPER_ADMIN_KEY
            </span>
          </div>
        </div>
      </div>

      {/* Monorepo Topology Card */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl">
            <Server className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="font-black text-base text-slate-900">Monorepo Topology &amp; Service Ports</h3>
            <p className="text-xs text-slate-500">Independent Next.js frontends and Express backend</p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-slate-900 block">Express Backend API</span>
              <span className="text-slate-400 text-[11px] font-mono">{apiUrl}</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              Port 5001 • Online
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-slate-900 block">Restaurant Web App (@menugo/restaurant-web)</span>
              <span className="text-slate-400 text-[11px] font-mono">{restaurantUrl}</span>
            </div>
            <a
              href={restaurantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 hover:underline"
            >
              <span>Port 3000</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-slate-900 block">Cinema Web App (@menugo/cinema-web)</span>
              <span className="text-slate-400 text-[11px] font-mono">{cinemaUrl}</span>
            </div>
            <a
              href={cinemaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline"
            >
              <span>Port 3001</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-slate-900 block">Main Platform &amp; Super Admin (@menugo/main-web)</span>
              <span className="text-slate-400 text-[11px] font-mono">http://localhost:3002</span>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800">
              Port 3002 • Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
