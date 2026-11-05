import Link from 'next/link';
import {
  QrCode,
  ChefHat,
  ArrowRight,
  Smartphone,
  Sparkles,
  Clock,
  CheckCircle2,
  HeartHandshake,
  Compass,
  ShoppingBag,
  Flame,
  Check,
  Store,
  KeyRound,
  Eye,
  ShieldCheck
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-orange-500 selection:text-white">
      {/* =========================================================================
          NAVIGATION HEADER
          ========================================================================= */}
      <header className="border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                Menu<span className="text-orange-600">Go</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">
                Smart Table Dining
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-orange-600 transition-colors">
              How It Works
            </a>
            <a href="#dining-experience" className="hover:text-orange-600 transition-colors">
              The Experience
            </a>
            <a href="#for-restaurants" className="hover:text-orange-600 transition-colors">
              For Restaurants
            </a>
            <Link href="/menu/demo-cafe" className="hover:text-orange-600 flex items-center gap-1.5 transition-colors">
              <Eye className="w-4 h-4 text-orange-500" />
              <span>Live Demo Menu</span>
            </Link>
          </nav>

          {/* Actions & Login */}
          <div className="flex items-center gap-3">
            <Link
              href="/staff/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-orange-600 bg-slate-50 hover:bg-orange-50/80 border border-slate-200/80 px-3.5 py-2.5 rounded-xl transition-all"
              title="Fast 4-digit PIN workstation login"
            >
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              <span>Staff PIN</span>
            </Link>

            <Link
              href="/admin/login"
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 px-3 sm:px-4 py-2.5 transition-colors"
            >
              Sign In
            </Link>

            <Link
              href="/admin/login?mode=signup"
              className="text-xs sm:text-sm font-bold bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-4 sm:px-5 py-2.5 rounded-xl transition-all shadow-md shadow-orange-600/20 hover:shadow-orange-600/30 hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* =========================================================================
            HERO SECTION
            ========================================================================= */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-orange-50/40 via-white to-slate-50/50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              {/* Product Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100/70 border border-orange-200 text-orange-800 text-xs sm:text-sm font-bold mb-6 shadow-sm">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span>MenuGo • The Modern Dining Platform</span>
              </div>

              {/* Tagline & Main Heading */}
              <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-orange-600 mb-3">
                Your Table. Your Time. Your Order.
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-[1.1] mb-6">
                A better way to dine.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
                  A smarter way to serve.
                </span>
              </h1>

              {/* Lead Description */}
              <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
                Give your customers the freedom to explore your menu, take their time and order whenever they&apos;re ready.
                Give your restaurant a simpler way to receive and manage table orders.
              </p>

              {/* Zero-Friction Pill Tagline */}
              <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-2 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto mb-10 text-xs sm:text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-xl">
                  <Check className="w-4 h-4 text-emerald-600" />
                  No app downloads
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-xl">
                  <Check className="w-4 h-4 text-emerald-600" />
                  No customer registration
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-900 rounded-xl font-bold">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  Just scan, explore and order
                </span>
              </div>

              {/* Primary Call-to-Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/admin/login?mode=signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-base font-bold px-8 py-4 rounded-xl shadow-lg shadow-orange-600/25 transition-all hover:-translate-y-0.5"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-base font-bold px-8 py-4 rounded-xl shadow-sm transition-all hover:border-slate-400"
                >
                  <span>See How It Works</span>
                </a>
              </div>
            </div>

            {/* Interactive Visual Graphic: From Diner Phone to Kitchen Screen */}
            <div className="mt-16 sm:mt-20 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left: Customer Mobile View */}
              <div className="md:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-800 text-white">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-slate-300">Table T-04 • Diner View</span>
                  </div>
                  <span className="text-[11px] font-bold text-orange-400 bg-orange-950/80 px-2.5 py-0.5 rounded-full border border-orange-800/60">
                    No App Needed
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Dish Mockup 1 */}
                  <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center text-lg shadow">
                        🍛
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm border border-emerald-500 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </span>
                          <span className="font-bold text-sm text-slate-100">Butter Chicken Masala</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">₹340 • Rich cashew gravy</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-orange-600 text-white px-2.5 py-1.5 rounded-lg shadow-sm">
                      1 Added
                    </span>
                  </div>

                  {/* Dish Mockup 2 */}
                  <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-lg shadow">
                        🫓
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm border border-emerald-500 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </span>
                          <span className="font-bold text-sm text-slate-100">Garlic Butter Naan</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">₹65 • Clay oven baked</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-orange-600 text-white px-2.5 py-1.5 rounded-lg shadow-sm">
                      2 Added
                    </span>
                  </div>

                  {/* Floating Cart Bar */}
                  <div className="p-3 bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl flex items-center justify-between text-xs font-bold shadow-lg shadow-orange-600/30">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      <span>3 Items • ₹470</span>
                    </div>
                    <span className="bg-white text-orange-600 px-3 py-1 rounded-lg">
                      Order Placed ✓
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle: Zero Latency Bridge Arrow */}
              <div className="md:col-span-2 flex flex-col items-center justify-center text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-md mb-2">
                  <Flame className="w-6 h-6 animate-bounce" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Instant 0ms
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">WebSockets</span>
              </div>

              {/* Right: Kitchen Workstation View */}
              <div className="md:col-span-5 bg-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-orange-600" />
                    <span className="font-extrabold text-slate-900">Kitchen Display (KDS)</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Live Stream
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">#104</span>
                      <span className="text-xs font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                        Table T-04
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Just now
                    </span>
                  </div>

                  <ul className="text-xs text-slate-700 space-y-1 font-medium mb-3">
                    <li>• 1x Butter Chicken Masala</li>
                    <li>• 2x Garlic Butter Naan <span className="text-orange-700 font-semibold">(Crispy)</span></li>
                  </ul>

                  <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                    <span className="text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-lg flex-1 text-center">
                      Preparing
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg flex-1 text-center">
                      Mark Ready →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION: DINING SHOULD HAPPEN AT YOUR PACE
            ========================================================================= */}
        <section id="dining-experience" className="py-20 sm:py-28 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-full border border-orange-200/80">
                The Diner&apos;s Perspective
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-6">
                Dining should happen at your pace.
              </h2>
              <p className="text-lg sm:text-xl font-medium text-slate-800 mb-6 italic">
                &ldquo;Ever felt rushed while deciding what to eat because a waiter was waiting beside your table?&rdquo;
              </p>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6">
                With MenuGo, those days are optional. Scan the QR code, browse the complete menu, explore dishes, compare prices and decide at your own pace.
              </p>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8">
                No pressure. No unnecessary waiting. Just a better dining experience.
              </p>
              <div className="inline-block px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm sm:text-base tracking-wide shadow-md">
                Your table. Your time. Your choice.
              </div>
            </div>

            {/* 3 Experience Highlight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Card 1 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-lg hover:border-orange-200 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl mb-6 shadow-sm">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Browse Without Pressure</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Take all the time you need to study dish ingredients, spice levels, and dietary tags without anyone hovering over your conversation.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-lg hover:border-orange-200 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xl mb-6 shadow-sm">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Full Visual Clarity</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  View clear dish photos, authoritative pricing in rupees, and customize instructions directly from the convenience of your smartphone.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-lg hover:border-orange-200 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xl mb-6 shadow-sm">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Human Touch Preserved</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Order when you&apos;re ready, or easily ask your server for personal recommendations whenever you desire warm hospitality.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION: FROM YOUR TABLE TO THE KITCHEN. SEAMLESSLY.
            ========================================================================= */}
        <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-100/70 px-3.5 py-1.5 rounded-full border border-orange-200">
                The 5-Step Ordering Flow
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-4">
                From your table to the kitchen. Seamlessly.
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                Every table becomes an effortless, self-sufficient ordering station in seconds.
              </p>
            </div>

            {/* 5-Step Process Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
              {/* Step 1: Scan */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                    1
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <QrCode className="w-5 h-5 text-orange-600" />
                    <h3 className="text-xl font-black text-slate-900">Scan.</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Scan the table&apos;s QR code to instantly open the restaurant menu.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  No App Install
                </div>
              </div>

              {/* Step 2: Explore */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                    2
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Compass className="w-5 h-5 text-orange-600" />
                    <h3 className="text-xl font-black text-slate-900">Explore.</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Browse categories, discover dishes, view prices and add your favourites.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Rich Photos & Tags
                </div>
              </div>

              {/* Step 3: Order */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                    3
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className="w-5 h-5 text-orange-600" />
                    <h3 className="text-xl font-black text-slate-900">Order.</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Place your order whenever you&apos;re ready. No app installation or account required.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  1-Click Checkout
                </div>
              </div>

              {/* Step 4: Prepare */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                    4
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <ChefHat className="w-5 h-5 text-orange-600" />
                    <h3 className="text-xl font-black text-slate-900">Prepare.</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Your order reaches the restaurant&apos;s order management system and kitchen workflow.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Real-time KDS Ticket
                </div>
              </div>

              {/* Step 5: Enjoy */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-orange-300 transition-all">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm mb-4 shadow-md shadow-orange-600/20">
                    5
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-orange-600" />
                    <h3 className="text-xl font-black text-slate-900">Enjoy.</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Relax while your food is prepared and served directly to your table.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Status Tracking
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION: BUILT FOR RESTAURANTS. DESIGNED FOR PEOPLE.
            ========================================================================= */}
        <section id="for-restaurants" className="py-20 sm:py-28 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-full border border-orange-200">
                Mutual Value
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight mt-4 mb-4">
                Built for restaurants. Designed for people.
              </h2>
              <p className="text-base sm:text-lg text-slate-600">
                A purpose-built platform that delights diners while boosting kitchen throughput and order accuracy.
              </p>
            </div>

            {/* Dual Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* For Your Customers */}
              <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-black uppercase tracking-wider mb-6">
                    Customer Experience
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">
                    For your customers
                  </h3>

                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-700 font-medium">
                        Browse without feeling rushed.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-700 font-medium">
                        Discover dishes with clear descriptions and images.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-700 font-medium">
                        Order at their convenience.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-700 font-medium">
                        Get assistance whenever they need it.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200/80 text-xs font-semibold text-slate-500">
                  Zero learning curve for guests of any age.
                </div>
              </div>

              {/* For Your Restaurant */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600/30 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider mb-6">
                    Restaurant Operator
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-6">
                    For your restaurant
                  </h3>

                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-200 font-medium">
                        Receive clear digital table orders.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-200 font-medium">
                        Reduce verbal ordering mistakes.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-200 font-medium">
                        Manage incoming orders and kitchen preparation.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-200 font-medium">
                        Keep track of order progress.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-base text-slate-200 font-medium">
                        Maintain the personal service your customers value.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 text-xs font-semibold text-slate-400">
                  Operate with full kitchen pass or floor service pass.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION: TECHNOLOGY SHOULD IMPROVE HOSPITALITY, NOT REPLACE IT.
            ========================================================================= */}
        <section className="py-20 sm:py-28 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-white relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs sm:text-sm font-bold mb-8">
              <HeartHandshake className="w-4 h-4 text-orange-400" />
              <span>Hospitality First Philosophy</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight mb-8">
              Technology should improve hospitality,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                not replace it.
              </span>
            </h2>

            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-6 font-medium">
              MenuGo gives customers the convenience of self-ordering while allowing restaurants to retain the human touch.
            </p>

            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-medium">
              Let customers choose how they want to order.
            </p>

            <p className="text-xl sm:text-2xl font-black text-amber-300 max-w-2xl mx-auto mb-10">
              Make every table a smarter table with MenuGo.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/admin/login?mode=signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:from-orange-700 active:to-amber-700 text-white text-base sm:text-lg font-bold px-10 py-5 rounded-2xl shadow-xl shadow-orange-600/30 transition-all hover:-translate-y-0.5"
              >
                <span>Bring MenuGo to Your Restaurant</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Quick Workstation Access */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-semibold">
              <Link href="/staff/login" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <KeyRound className="w-4 h-4 text-orange-400" />
                <span>Staff 4-Digit PIN Access</span>
              </Link>
              <span>•</span>
              <Link href="/kitchen" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <ChefHat className="w-4 h-4 text-orange-400" />
                <span>Kitchen Display System</span>
              </Link>
              <span>•</span>
              <Link href="/menu/demo-cafe" className="hover:text-white flex items-center gap-1.5 transition-colors">
                <Eye className="w-4 h-4 text-orange-400" />
                <span>Customer Menu Preview</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer className="border-t border-slate-200 bg-white text-slate-600 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-100">
            {/* Brand Logo & Mission */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-orange-500/20">
                M
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-slate-900">
                  Menu<span className="text-orange-600">Go</span>
                </span>
                <p className="text-xs text-slate-500 font-medium">
                  A better way to dine. A smarter way to serve.
                </p>
              </div>
            </div>

            {/* Navigation shortcuts */}
            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600">
              <a href="#how-it-works" className="hover:text-orange-600 transition-colors">
                How It Works
              </a>
              <a href="#dining-experience" className="hover:text-orange-600 transition-colors">
                Experience
              </a>
              <a href="#for-restaurants" className="hover:text-orange-600 transition-colors">
                For Restaurants
              </a>
              <Link href="/admin/login" className="hover:text-orange-600 transition-colors">
                Admin Console
              </Link>
              <Link href="/staff/login" className="hover:text-orange-600 transition-colors">
                Staff PIN Login
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <p>© {new Date().getFullYear()} MenuGo Technologies. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tenant Cloud QR Architecture • Instant WebSockets</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
