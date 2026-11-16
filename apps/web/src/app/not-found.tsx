import './globals.css';
import Link from 'next/link';
import { ArrowLeft, Home, KeyRound, QrCode } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 selection:bg-orange-500 selection:text-white">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Brand Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-2xl shadow-orange-950/50">
          <QrCode className="w-10 h-10" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
          404 • Not Found
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Table or Menu Not Found
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            The page, table, or restaurant menu you are trying to view does not exist or may have moved.
          </p>
        </div>

        {/* Customer Guidance Card */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-left space-y-2 text-xs text-slate-300">
          <span className="font-extrabold text-white block">Dining in at a restaurant?</span>
          <p>
            Please scan the QR code placed physically on your dining table with your camera to open your table’s live menu.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/"
            className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30"
          >
            <Home className="w-4 h-4" />
            <span>Go to Homepage</span>
          </Link>

          <Link
            href="/staff/login"
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <KeyRound className="w-4 h-4 text-orange-400" />
            <span>Staff PIN Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
