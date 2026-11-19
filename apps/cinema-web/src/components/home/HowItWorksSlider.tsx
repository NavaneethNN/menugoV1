'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  QrCode,
  Compass,
  ShoppingBag,
  ChefHat,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Armchair,
  Popcorn,
  Smartphone,
  Flame,
  Check,
  CreditCard
} from 'lucide-react';

interface Step {
  id: string;
  stepNumber: string;
  title: string;
  shortDesc: string;
  headline: string;
  details: string;
  highlights: string[];
  icon: React.ElementType;
  previewBadge: string;
  previewCard: {
    tag: string;
    subtag: string;
    title: string;
    detail: string;
    actionText: string;
  };
}

const RESTAURANT_STEPS: Step[] = [
  {
    id: 'scan',
    stepNumber: '01',
    title: 'Scan QR Code',
    shortDesc: 'Instant table access',
    headline: 'Point, scan, and start browsing in under 2 seconds.',
    details:
      'Guests simply point their standard phone camera at the physical The QROS QR stand on their table. No app download, registration, or password required.',
    highlights: [
      'Works in default camera on iOS & Android',
      'Table number automatically bound to session',
      'Zero battery or storage impact on guest phone'
    ],
    icon: QrCode,
    previewBadge: 'Direct Browser Access',
    previewCard: {
      tag: 'Table #07 Active',
      subtag: 'Instant Session',
      title: 'The Grand Bistro',
      detail: 'Welcome! Scan verified table #07. Live menu unlocked.',
      actionText: 'Browse Menu'
    }
  },
  {
    id: 'explore',
    stepNumber: '02',
    title: 'Explore Menu',
    shortDesc: 'Rich visual ordering',
    headline: 'High-res photos, allergen tags, and real-time availability.',
    details:
      'Guests browse customizable categories, filter for vegetarian or chef specials, view detailed ingredients, and customize their dishes freely without waiting.',
    highlights: [
      'Visual categories & dietary badges',
      'Custom dish modifications & cooking notes',
      'Real-time sold-out item synchronization'
    ],
    icon: Compass,
    previewBadge: 'Smart Filtering',
    previewCard: {
      tag: 'Chef Special',
      subtag: 'Top Rated Dish',
      title: 'Truffle Mushroom Risotto',
      detail: 'Wild mushrooms, Arborio rice, Parmigiano Reggiano & truffle oil.',
      actionText: '+ Add to Order · ₹340'
    }
  },
  {
    id: 'order',
    stepNumber: '03',
    title: 'Smart Order',
    shortDesc: 'Direct to kitchen',
    headline: 'Confirm items and send directly into the preparation stream.',
    details:
      'Once items are selected, guests review their order summary, append special kitchen instructions, and send the order straight to the kitchen.',
    highlights: [
      'Idempotent safe order submission',
      'Live running table bill calculation',
      'Kitchen preparation instructions preserved'
    ],
    icon: ShoppingBag,
    previewBadge: 'Instant Transmission',
    previewCard: {
      tag: 'Table #07 · 2 Items',
      subtag: 'Order Confirmed',
      title: 'Order #382 Placed',
      detail: '1x Truffle Risotto (No onions), 1x Artisan Lemonade.',
      actionText: 'Track Order Live'
    }
  },
  {
    id: 'prepare',
    stepNumber: '04',
    title: 'Kitchen KDS',
    shortDesc: 'Zero miscommunication',
    headline: 'Live digital tickets organize priority for chef and kitchen staff.',
    details:
      'Kitchen displays update in real time with color-coded elapsed time badges, precise table labels, and item-by-item completion checks.',
    highlights: [
      'Color-coded preparation timers',
      'Eliminates lost paper tickets and handwriting errors',
      'Instant audio chime and visual alert'
    ],
    icon: ChefHat,
    previewBadge: 'Live KDS Stream',
    previewCard: {
      tag: 'KDS Station 1',
      subtag: 'Cooking · 4m elapsed',
      title: 'Ticket #382 · Table 07',
      detail: '1x Truffle Risotto [Special: No onions] · 1x Artisan Lemonade.',
      actionText: 'Mark Ready for Pickup'
    }
  },
  {
    id: 'serve',
    stepNumber: '05',
    title: 'Serve & Enjoy',
    shortDesc: 'Elevated hospitality',
    headline: 'Smooth service leaves staff free to focus on genuine guest care.',
    details:
      'Waiters receive ready notifications and deliver piping hot meals directly to the identified table. Guests enjoy quick, frictionless dining.',
    highlights: [
      'Staff focus on guest hospitality instead of taking orders',
      'Faster table turnaround by 18-25 minutes',
      'Higher customer satisfaction and repeat visits'
    ],
    icon: Sparkles,
    previewBadge: 'Service Complete',
    previewCard: {
      tag: 'Table #07 Delivered',
      subtag: 'Satisfied Guests',
      title: 'Meal Served Gracefully',
      detail: 'Order delivered by Floor Staff. Table is happily dining.',
      actionText: 'Table Active'
    }
  }
];

const CINEMA_STEPS: Step[] = [
  {
    id: 'cinema-scan',
    stepNumber: '01',
    title: 'Scan Armrest QR',
    shortDesc: 'Seat-level QR code',
    headline: 'Scan from the comfort of your seat without leaving the screening.',
    details:
      'Every cinema seat armrest or auditorium entry features a clear The QROS QR code. Moviegoers open their smartphone camera to open the menu instantly.',
    highlights: [
      'Scan from armrest QR without downloading apps',
      'Auditorium and screen context auto-detected',
      'Discreet dark mode prevents disturbing other viewers'
    ],
    icon: QrCode,
    previewBadge: 'Auditorium QR',
    previewCard: {
      tag: 'Screen 2 · Seat F12',
      subtag: 'Cinema Concession',
      title: 'PVR Premiere Cineplex',
      detail: 'Welcome to Screen 2. Live snacks & beverage menu loaded.',
      actionText: 'Order Food & Drinks'
    }
  },
  {
    id: 'cinema-seat',
    stepNumber: '02',
    title: 'Screen, Row & Seat',
    shortDesc: 'Precision seat selection',
    headline: 'Confirm your screen, row letter, and seat number.',
    details:
      'Guests confirm their exact seat (e.g. Row F, Seat 12). No complicated movie scheduling needed—simply pick your seat and you are ready to order.',
    highlights: [
      'Visual screen and row selection',
      'No complex schedules or movie configurations required',
      'Supports VIP recliners, balcony, and standard rows'
    ],
    icon: Armchair,
    previewBadge: 'Seat Selection',
    previewCard: {
      tag: 'Row F · Seat 12',
      subtag: 'Auditorium Center',
      title: 'Auditorium Screen 2',
      detail: 'Confirmed: Screen 2, Row F, Seat 12. Seat delivery tag ready.',
      actionText: 'Choose Snacks'
    }
  },
  {
    id: 'cinema-menu',
    stepNumber: '03',
    title: 'Pick Snacks & Combos',
    shortDesc: 'Concession menu',
    headline: 'Browse hot popcorn, nachos, cold drinks, and combo deals.',
    details:
      'Guests explore visual concession categories, pick sizes (Regular, Large, Tub), add combos, and customize snacks without missing a scene.',
    highlights: [
      'Visual snack categories & combo bundles',
      'Clear portion sizes and flavor options',
      'Real-time item availability synced with kitchen'
    ],
    icon: Popcorn,
    previewBadge: 'Concessions',
    previewCard: {
      tag: 'Cinema Combo',
      subtag: 'Best Seller',
      title: 'Caramel Tub + Cold Drink',
      detail: 'Freshly popped caramel popcorn with chilled beverage.',
      actionText: '+ Add to Order · ₹390'
    }
  },
  {
    id: 'cinema-pay',
    stepNumber: '04',
    title: 'Instant Online Pay',
    shortDesc: 'Pre-paid in-seat checkout',
    headline: 'Pay securely via UPI, Cards, or Netbanking (Razorpay / Paytm).',
    details:
      'Concessions are paid directly to your theatre merchant account so delivery runners can deliver swiftly without handling cash or POS machines in the dark.',
    highlights: [
      'Instant UPI, Cards & Netbanking checkout',
      'Theatre directly receives 100% of settlements',
      'Instant digital ticket and delivery tracking'
    ],
    icon: CreditCard,
    previewBadge: 'Direct Settlement',
    previewCard: {
      tag: 'Paid ₹390 via UPI',
      subtag: 'Concession Ticket',
      title: 'Order #C-1048 Paid',
      detail: '1x Large Caramel Popcorn · 1x Cold Drink.',
      actionText: 'Dispatching to Runner'
    }
  },
  {
    id: 'cinema-deliver',
    stepNumber: '05',
    title: 'Seat Delivery',
    shortDesc: 'Direct armrest delivery',
    headline: 'Runner delivers directly to your seat without missing a single movie scene.',
    details:
      'Cinema floor runners receive seat-specific dispatch tickets and deliver hot popcorn and drinks straight to seat Row F-12 inside the auditorium.',
    highlights: [
      'Stealth runner dispatch system',
      'Eliminates long interval concession queues',
      'Significantly increases theatre food and beverage revenue'
    ],
    icon: ChefHat,
    previewBadge: 'Delivered to Seat',
    previewCard: {
      tag: 'Delivered to F12',
      subtag: 'Screen 2 Runner',
      title: 'Concession Delivered',
      detail: 'Order delivered to seat Row F-12. Enjoy your movie!',
      actionText: 'Order Complete'
    }
  }
];

interface HowItWorksSliderProps {
  businessType: 'restaurant' | 'cinema';
}

export function HowItWorksSlider({ businessType }: HowItWorksSliderProps) {
  const steps = businessType === 'cinema' ? CINEMA_STEPS : RESTAURANT_STEPS;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const duration = 6000; // 6 seconds per slide

  // Auto-advance logic with smooth progress indicator
  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 60; // 60ms increments
    const stepIncrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveIndex((curr) => (curr + 1) % steps.length);
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, steps.length, duration]);

  // Reset progress when active index changes manually
  const handleSelectStep = (index: number) => {
    setActiveIndex(index);
    setProgress(0);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? steps.length - 1 : prev - 1));
    setProgress(0);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
    setProgress(0);
  };

  const currentStep = steps[activeIndex] ?? steps[0]!;
  const StepIcon = currentStep.icon;

  return (
    <div
      className="w-full relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* =========================================================================
          1. MODERN INTERACTIVE PILL STEP SELECTOR BAR
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-8">
        {steps.map((step, idx) => {
          const isActive = idx === activeIndex;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => handleSelectStep(idx)}
              className={`group relative text-left p-3.5 sm:p-4 rounded-2xl transition-all duration-300 border flex flex-col justify-between overflow-hidden cursor-pointer ${
                isActive
                  ? 'bg-white border-red-500/80 shadow-lg shadow-red-600/10 ring-2 ring-red-500/20 translate-y-[-2px]'
                  : 'bg-white/70 hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Top bar with Step # and Icon */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:text-slate-800'
                  }`}
                >
                  {step.stepNumber}
                </span>
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-red-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
              </div>

              {/* Step Title and Subtitle */}
              <div>
                <p
                  className={`text-xs sm:text-sm font-extrabold tracking-tight transition-colors line-clamp-1 ${
                    isActive ? 'text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 hidden sm:block">
                  {step.shortDesc}
                </p>
              </div>

              {/* Progress Line on Active Step */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-100">
                  <div
                    className="h-full bg-red-600 transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          2. MODERN SHOWCASE HERO STAGE (DUAL CARD)
          ========================================================================= */}
      <div className="rounded-3xl bg-gradient-to-br from-white via-white to-slate-50 border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-10 lg:p-12 relative overflow-hidden transition-all duration-300">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-slate-500/5 blur-3xl pointer-events-none" />

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center relative z-10">
          {/* Left Column: Details & Value Proposition */}
          <div>
            {/* Step badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200/80 text-red-700 text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>Step {currentStep.stepNumber} of 05</span>
              <span>•</span>
              <span className="text-slate-600 font-semibold">{currentStep.previewBadge}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 tracking-tight leading-tight mb-4">
              {currentStep.headline}
            </h3>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
              {currentStep.details}
            </p>

            {/* Feature Highlights */}
            <ul className="space-y-3 mb-8">
              {currentStep.highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>

            {/* Slider Navigation Controls (Modern Pill + Arrows) */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handlePrev}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
                aria-label="Previous step"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={handleNext}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex items-center justify-center transition-all shadow-md shadow-red-600/25 cursor-pointer"
                aria-label="Next step"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <span className="text-xs font-extrabold text-slate-400 pl-2">
                {currentStep.stepNumber} / 05
              </span>

              <div className="ml-auto hidden sm:flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectStep(i)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      i === activeIndex ? 'w-6 bg-red-600' : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Realistic High-Fidelity Device Preview Mockup */}
          <div className="relative mx-auto w-full max-w-sm sm:max-w-md">
            {/* Glow backdrop */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-red-500/15 via-red-500/5 to-slate-200/50 blur-xl" />

            {/* Device Card Shell */}
            <div className="relative rounded-3xl bg-slate-900 border border-slate-800 text-white p-5 sm:p-6 shadow-2xl shadow-slate-950/40">
              {/* Phone Header Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-xs">
                    M
                  </div>
                  <div>
                    <span className="text-xs font-black tracking-tight text-white block">
                      The QROS Live
                    </span>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">
                      {currentStep.previewCard.tag}
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>

              {/* Main Visual Center Stage */}
              <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-red-600 to-red-700 flex items-center justify-center text-white mb-4 shadow-xl shadow-red-600/30">
                  <StepIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>

                <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-400 mb-1">
                  {currentStep.previewCard.subtag}
                </span>

                <h4 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">
                  {currentStep.previewCard.title}
                </h4>

                <p className="text-xs sm:text-sm text-slate-300 max-w-xs leading-relaxed">
                  {currentStep.previewCard.detail}
                </p>
              </div>

              {/* Simulated Interactive Action Pill */}
              <div className="pt-3 border-t border-slate-800">
                <div className="w-full py-2.5 px-4 rounded-xl bg-red-600 text-white font-extrabold text-xs text-center shadow-lg shadow-red-600/30 flex items-center justify-center gap-2">
                  <span>{currentStep.previewCard.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
