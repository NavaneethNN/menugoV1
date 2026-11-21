'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Cpu,
  Database,
  ExternalLink,
  Film,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  Menu,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
  Users,
  Wifi,
  X,
  Zap
} from 'lucide-react';

const faqs = [
  {
    q: 'Do guests need to download an app?',
    a: 'No. Guests scan a table or seat QR code with their phone camera and place an order in their mobile browser.'
  },
  {
    q: 'Does The QROS take a commission or charge monthly subscriptions?',
    a: 'No. The QROS is a 100% pay-as-you-go service with zero subscriptions and zero commission on your orders. Your venue keeps 100% of its food and beverage revenue, with payments deposited directly to your connected merchant gateway. You only pay for the metered infrastructure usage (API requests, database processing, storage, and bandwidth) your venue actually consumes.'
  },
  {
    q: 'Can it work with the devices we already own?',
    a: 'Yes. The browser-based kitchen, cashier, and runner workstations can run on supported tablets, touch displays, and computers.'
  },
  {
    q: 'How does it adapt to a restaurant and a cinema?',
    a: 'Restaurants can route table orders to service and kitchen teams. Cinemas can map QR codes to screens, rows, and seats, then dispatch orders to runners.'
  },
  {
    q: 'How do payments work?',
    a: 'You connect your own payment gateway (Razorpay, Paytm, UPI). Funds settle directly into your bank account with zero platform middleman fees.'
  }
];

const venueData = {
  restaurant: {
    label: 'Restaurants',
    eyebrow: 'For restaurants, cafés & bars',
    heading: 'Make every table an easier way to order.',
    description: 'Give guests the freedom to browse at their own pace, while orders reach your kitchen with the table context your team needs.',
    icon: UtensilsCrossed,
    url: process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000',
    steps: ['Guest scans table QR', 'Order reaches kitchen', 'Team serves with context'],
  },
  cinema: {
    label: 'Cinemas',
    eyebrow: 'For cinemas & multiplexes',
    heading: 'Keep guests in the film. Bring concessions to their seat.',
    description: 'Make armrest QR ordering a natural part of movie night, with each order routed from concession kitchen to the right seat.',
    icon: Film,
    url: process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001',
    steps: ['Guest scans seat QR', 'Kitchen prepares order', 'Runner delivers to seat'],
  }
};

const pricingCatalogue = [
  {
    icon: Cpu,
    name: 'API Requests',
    rate: '₹1.00',
    unit: '1,000 requests',
    desc: 'Order creation, real-time ticket dispatch, and guest menu browsing'
  },
  {
    icon: Database,
    name: 'Database Operations',
    rate: '₹2.00',
    unit: '1,000 queries',
    desc: 'PostgreSQL reads, writes, table session states, and order persistence'
  },
  {
    icon: HardDrive,
    name: 'Storage & Assets',
    rate: '₹10.00',
    unit: 'GB / month',
    desc: 'High-resolution food photos, cinema posters, and digital asset storage'
  },
  {
    icon: Wifi,
    name: 'Network Bandwidth',
    rate: '₹10.00',
    unit: 'GB transferred',
    desc: 'Fast edge CDN delivery of menus, images, and live websocket streams'
  }
];

export default function MainPlatformHomePage() {
  const restaurantUrl = venueData.restaurant.url;
  const cinemaUrl = venueData.cinema.url;
  const [activeTab, setActiveTab] = useState<'restaurant' | 'cinema'>('restaurant');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedVenue = venueData[activeTab];
  const SelectedIcon = selectedVenue.icon;

  return (
    <main className="min-h-screen overflow-hidden bg-[#ffffff] text-[#0f172a] selection:bg-[#dc2626] selection:text-white">
      {/* Top Banner */}
      <div className="bg-[#0f172a] px-4 py-2.5 text-center text-[11px] font-medium tracking-wide text-white/75 sm:text-xs">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
        Pure Pay-As-You-Go Service • Zero Monthly Subscriptions • Zero Order Commission
        <Link href="/super-admin/login" className="ml-3 hidden items-center gap-1 text-white/80 hover:text-white sm:inline-flex">
          <ShieldCheck className="h-3 w-3" /> Platform access
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#ffffff]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1360px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="The QROS home" className="shrink-0">
            <Image src="/qros_logo.png" alt="The QROS" width={2172} height={724} priority sizes="220px" className="h-14 w-auto max-w-[220px] object-contain" />
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-semibold text-[#475569] lg:flex">
            <a href="#venues" className="transition hover:text-[#b91c1c]">Solutions</a>
            <a href="#how-it-works" className="transition hover:text-[#b91c1c]">How it works</a>
            <a href="#pricing" className="transition hover:text-[#b91c1c]">Pay-As-You-Go</a>
            <a href="#faq" className="transition hover:text-[#b91c1c]">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <a href={restaurantUrl} className="rounded-full px-3 py-2 text-xs font-semibold text-[#475569] hover:text-black">Restaurant portal</a>
            <a href={cinemaUrl} className="rounded-full px-3 py-2 text-xs font-semibold text-[#475569] hover:text-black">Cinema portal</a>
            <a href="#venues" className="inline-flex items-center gap-2 rounded-full bg-[#dc2626] px-5 py-3 text-[13px] font-bold text-white shadow-[0_5px_16px_rgba(216,59,48,.18)] transition hover:-translate-y-0.5 hover:bg-[#b91c1c]">
              Find your solution <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-xl p-2 sm:hidden" aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="space-y-1 border-t border-black/5 bg-[#ffffff] px-5 py-4 sm:hidden">
            <a href="#venues" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold">Solutions</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold">How it works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold">Pay-As-You-Go</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold">FAQ</a>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <a href={restaurantUrl} className="rounded-xl bg-slate-100 px-3 py-3 text-center text-xs font-bold">Restaurant portal</a>
              <a href={cinemaUrl} className="rounded-xl bg-slate-100 px-3 py-3 text-center text-xs font-bold">Cinema portal</a>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative isolate bg-white text-slate-900">
        <div className="mx-auto grid max-w-[1360px] items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.95fr_1.05fr] lg:gap-12 lg:py-28">
          <div className="max-w-[620px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-red-700">
              <Sparkles className="h-3.5 w-3.5 text-red-600" />
              100% Pay-As-You-Go • No Monthly Plans
            </div>
            <h1 className="text-[clamp(3rem,6vw,5.6rem)] font-semibold leading-[.98] tracking-[-.065em]">
              More memorable<br />moments. <span className="font-serif font-normal italic text-red-600">Smoother service.</span>
            </h1>
            <p className="mt-7 max-w-[540px] text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              The QROS connects guest ordering with the people serving them. Pay only for the metered usage you consume—no subscriptions, no forced upgrades, and zero commission on your orders.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#venues" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#dc2626] px-7 py-4 text-sm font-bold text-white shadow-[0_10px_35px_rgba(220,73,58,.22)] transition hover:-translate-y-0.5 hover:bg-[#ef4444]">
                Explore your venue solution <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                View pay-as-you-go rates
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-red-600" /> No monthly subscription fees</span>
              <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-red-600" /> 0% commission on food &amp; drinks</span>
              <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-red-600" /> Direct merchant bank payouts</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[650px] lg:ml-auto">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_35px_100px_rgba(0,0,0,.15)] sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef4444]/15 text-red-600">
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Venue operations</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">One clear view of service</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> PAY-AS-YOU-GO
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('restaurant')}
                  className={`rounded-2xl border p-4 text-left transition sm:p-5 ${activeTab === 'restaurant' ? 'border-[#f87171]/60 bg-red-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <UtensilsCrossed className={`h-5 w-5 ${activeTab === 'restaurant' ? 'text-red-600' : 'text-slate-500'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">01 / DINING</span>
                  </div>
                  <p className="mt-6 text-sm font-bold">Restaurants</p>
                  <p className="mt-1 text-[10px] text-slate-500">Table to kitchen</p>
                </button>
                <button
                  onClick={() => setActiveTab('cinema')}
                  className={`rounded-2xl border p-4 text-left transition sm:p-5 ${activeTab === 'cinema' ? 'border-[#ef4444]/60 bg-red-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <Film className={`h-5 w-5 ${activeTab === 'cinema' ? 'text-red-600' : 'text-slate-500'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">02 / CINEMA</span>
                  </div>
                  <p className="mt-6 text-sm font-bold">Theatres</p>
                  <p className="mt-1 text-[10px] text-slate-500">Armrest to seat</p>
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">{selectedVenue.eyebrow}</p>
                    <p className="mt-1.5 text-lg font-semibold tracking-tight">{selectedVenue.heading}</p>
                  </div>
                  <SelectedIcon className="h-5 w-5 shrink-0 text-red-600" />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{selectedVenue.description}</p>
                <div className="mt-5 space-y-2">
                  {selectedVenue.steps.map((step, i) => (
                    <div key={step} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 border border-slate-100">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[9px] font-bold text-red-600">{i + 1}</span>
                      <span className="text-[10px] font-medium text-slate-600">{step}</span>
                      <span className="ml-auto text-slate-400">{i < 2 && <ArrowRight className="h-3 w-3" />}</span>
                    </div>
                  ))}
                </div>
              </div>
              <a href={selectedVenue.url} className="mt-3 flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3.5 text-xs font-bold text-[#1e293b] transition hover:bg-[#f8fafc]">
                <span>Explore {selectedVenue.label} solution</span>
                <ArrowRight className="h-4 w-4 text-[#dc2626]" />
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1360px] grid-cols-2 border-t border-slate-200 px-5 sm:grid-cols-4 sm:px-8">
          {[
            ['01', 'Guest-first ordering'],
            ['02', '100% Pay-As-You-Go'],
            ['03', 'Zero subscription lock-in'],
            ['04', 'Your gateway, your payouts']
          ].map(([n, text]) => (
            <div key={n} className="flex items-center gap-3 border-b border-r border-slate-200 py-5 pl-2 last:border-r-0 sm:border-b-0 sm:py-6">
              <span className="font-mono text-[10px] text-red-600">{n}</span>
              <span className="text-[10px] font-medium text-slate-600 sm:text-xs">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Venues Solutions */}
      <section id="venues" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1360px]">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dc2626]">Made for your kind of service</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-6xl">
              Different venues.<br />
              <span className="font-serif font-normal italic text-[#b91c1c]">A better way to serve.</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#475569]">
              Purpose-built guest journeys meet one thoughtful operations platform.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {(['restaurant', 'cinema'] as const).map((type) => {
              const venue = venueData[type];
              const Icon = venue.icon;
              const isRestaurant = type === 'restaurant';
              return (
                <article key={type} className={`group relative overflow-hidden rounded-[28px] border p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(44,32,24,.09)] sm:p-10 ${isRestaurant ? 'border-[#fecaca] bg-[#ffffff]' : 'border-[#e2e8f0] bg-[#ffffff]'}`}>
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#fee2e2] text-[#b91c1c]">
                        <Icon className="h-3.5 w-3.5" /> {venue.eyebrow}
                      </span>
                      <span className="text-xs font-mono text-black/30">0{isRestaurant ? '1' : '2'}</span>
                    </div>
                    <h3 className="mt-7 max-w-lg text-3xl font-semibold leading-tight tracking-[-.04em] sm:text-4xl">{venue.heading}</h3>
                    <p className="mt-4 max-w-lg text-sm leading-6 text-[#475569]">{venue.description}</p>
                    <div className="mt-8 flex flex-wrap gap-2">
                      {(isRestaurant ? ['QR menu & table ordering', 'Kitchen KDS', 'Service team tools', 'Pay-as-you-go'] : ['Seat QR ordering', 'Concession kitchen', 'Runner dispatch', 'Pay-as-you-go']).map((tag) => (
                        <span key={tag} className="rounded-full border border-black/[.08] bg-slate-50 px-3 py-2 text-[10px] font-semibold text-[#475569]">{tag}</span>
                      ))}
                    </div>
                    <a href={venue.url} className={`mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white transition group-hover:gap-3 ${isRestaurant ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-[#334155] hover:bg-[#1e293b]'}`}>
                      Explore {venue.label} <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 bg-[#f8fafc] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1360px]">
          <div className="grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dc2626]">One simple journey</p>
              <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-6xl">From scan to service,<br />in sync.</h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-[#475569] md:justify-self-end">
              A guest-friendly front end, connected to the tools your team needs to receive, prepare, and fulfill every order.
            </p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { icon: QrCode, title: 'Guests scan and order', body: 'A quick, mobile-friendly menu opens from the table or seat QR. No app install to get started.' },
              { icon: ChefHat, title: 'Your team gets the detail', body: 'Orders arrive with the context that matters—table for dining, screen and seat for cinema.' },
              { icon: Truck, title: 'Service moves together', body: 'Kitchen, cashier, and runner workflows stay connected through a live operations view.' }
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[24px] border border-[#e2e8f0] bg-white p-7 sm:p-8">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#94a3b8]">0{i + 1} / 03</span>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fef2f2] text-[#dc2626]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-9 text-xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1360px] gap-14 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dc2626]">Thoughtful by default</p>
            <h2 className="mt-4 max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-.05em] sm:text-6xl">Your venue stays yours.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#475569]">
              Give your guests a smoother way to order and your team a clearer way to serve, while keeping your brand, your customer relationships, and your revenue 100% under your control.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Store, title: 'Your brand, front and center', body: 'Present a digital ordering experience shaped around your restaurant or theatre identity.' },
              { icon: Zap, title: '100% Pay-As-You-Go', body: 'Zero monthly subscriptions and zero upfront fees. Pay strictly for measured infrastructure consumption.' },
              { icon: BarChart3, title: 'A clearer view of service', body: 'Bring live order volume, revenue metrics, and kitchen preparation times into one place.' },
              { icon: Users, title: 'Tools for the whole team', body: 'Equip cooks, servers, and runners with workstation screens tailored to their exact floor roles.' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[22px] border border-black/[.06] bg-white p-6 sm:p-7">
                  <Icon className="h-5 w-5 text-[#dc2626]" />
                  <h3 className="mt-5 font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#64748b]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* PURE PAY-AS-YOU-GO PRICING SECTION */}
      <section id="pricing" className="scroll-mt-24 bg-[#f8fafc] px-5 py-20 sm:px-8 sm:py-28 border-t border-slate-200">
        <div className="mx-auto max-w-[1360px]">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 mb-4">
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
              <span>Metered Infrastructure Pricing</span>
            </div>
            <h2 className="text-4xl font-semibold tracking-[-.05em] sm:text-5xl text-slate-950">
              No Subscriptions. 100% Pay-As-You-Go.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#475569]">
              Never pay for idle software. You only pay for what your venue actually consumes—billed transparently through an understandable monthly usage statement. Zero upfront lock-in, zero commission on food sales.
            </p>
          </div>

          {/* Pricing Catalogue Cards */}
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pricingCatalogue.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-red-200 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        Metered
                      </span>
                    </div>

                    <h3 className="mt-5 text-lg font-black text-slate-950">{item.name}</h3>
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed min-h-10">{item.desc}</p>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-950">{item.rate}</span>
                      <span className="text-xs font-semibold text-slate-500">/ {item.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customer Guarantees Banner */}
          <div className="mt-10 rounded-3xl bg-slate-900 text-white p-8 sm:p-10 border border-slate-800">
            <div className="grid gap-8 lg:grid-cols-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="text-emerald-400 font-extrabold text-xs uppercase tracking-wider">0% Order Commission</div>
                <div className="text-xl font-black">Keep 100% of Revenue</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We never take a percentage cut of your food, drink, or concession sales.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-emerald-400 font-extrabold text-xs uppercase tracking-wider">No Monthly Plan Fees</div>
                <div className="text-xl font-black">Zero Base Commitment</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Quiet days cost less. You only pay for active guest orders and operational compute.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-emerald-400 font-extrabold text-xs uppercase tracking-wider">Direct Merchant Payouts</div>
                <div className="text-xl font-black">Your Gateway &amp; Account</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect your Razorpay, Paytm, or UPI merchant account. Payouts go directly to your bank.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-emerald-400 font-extrabold text-xs uppercase tracking-wider">Usage Transparency</div>
                <div className="text-xl font-black">Understandable Statements</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Track live estimated usage daily in your admin console with itemized monthly invoices.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-400 font-medium text-center sm:text-left">
                Ready to launch contactless ordering with zero upfront fees?
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={`${restaurantUrl}/admin/login?mode=signup`}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm"
                >
                  <span>Start Restaurant</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href={`${cinemaUrl}/signup`}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-white transition"
                >
                  <span>Start Cinema</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#dc2626]">Good to know</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Questions, answered.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <article key={faq.q} className="overflow-hidden rounded-2xl border border-black/[.07] bg-white">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-sm font-semibold sm:px-6"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${openFaq === i ? 'rotate-180 text-[#dc2626]' : ''}`} />
                </button>
                {openFaq === i && (
                  <p className="border-t border-black/[.05] px-5 pb-5 pt-4 text-sm leading-6 text-[#475569] sm:px-6">
                    {faq.a}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="mx-auto flex max-w-[1360px] flex-col items-start justify-between gap-8 rounded-[28px] bg-red-700 p-7 text-white sm:p-12 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#f87171]">Zero subscription lock-in</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] sm:text-5xl">Let’s make service feel effortless.</h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Sign up today with zero upfront payment. Pay only for the metered usage your venue consumes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={restaurantUrl} className="inline-flex items-center gap-2 rounded-full bg-white text-slate-950 px-6 py-3.5 text-xs font-black hover:bg-slate-100 transition shadow-md">
              For restaurants <ArrowRight className="h-4 w-4 text-red-600" />
            </a>
            <a href={cinemaUrl} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-xs font-bold text-white hover:bg-white/10 transition">
              For cinemas <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[.07] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1360px] flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Image src="/qros_logo.png" alt="The QROS" width={2172} height={724} sizes="160px" className="h-9 w-auto" />
            <span className="h-5 w-px bg-black/10" />
            <span className="text-xs text-[#64748b]">Pay-as-you-go service for restaurants and cinemas.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-[#475569]">
            <a href={restaurantUrl} className="hover:text-[#dc2626]">Restaurant portal <ExternalLink className="ml-1 inline h-3 w-3" /></a>
            <a href={cinemaUrl} className="hover:text-[#dc2626]">Cinema portal <ExternalLink className="ml-1 inline h-3 w-3" /></a>
            <Link href="/super-admin" className="hover:text-[#dc2626]">Platform access</Link>
            <span className="font-normal text-[#94a3b8]">© {new Date().getFullYear()} The QROS</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
