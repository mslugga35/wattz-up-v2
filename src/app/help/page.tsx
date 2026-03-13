'use client';

/**
 * WATTZ UP v2 - Help & Support Page
 * Consumer-facing guide for using the app
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Zap,
  ArrowLeft,
  MapPin,
  Search,
  Bell,
  MessageSquarePlus,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
  Smartphone,
  HelpCircle,
  Navigation,
  Download,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'How does Wattz Up estimate wait times?',
    answer:
      'We combine crowd-sourced reports from other EV drivers with historical charging patterns at each station. The more people report, the more accurate our estimates become. When no recent data is available, we use industry averages based on station type (DC Fast vs Level 2) and the number of chargers.',
  },
  {
    question: 'How do I report what I see at a station?',
    answer:
      'Tap the chat bubble icon on any station card, then select what you see: Available, Short Wait, Long Wait, or Full. You can also enter your queue position if you\'re waiting. Reports expire after a few hours to keep data fresh.',
  },
  {
    question: 'What do the colored markers on the map mean?',
    answer:
      'Green means short wait (under 5 minutes), yellow means moderate wait (5-15 minutes), red means long wait (15+ minutes), and gray means we don\'t have enough data yet. Help us turn gray markers green by reporting!',
  },
  {
    question: 'Can I set alerts for a station?',
    answer:
      'Yes! When viewing a station, you can set an alert to be notified when chargers become available. Alerts automatically expire after 2 hours so you don\'t get notifications you no longer need.',
  },
  {
    question: 'Which charging networks are included?',
    answer:
      'We include all major US networks: Tesla Supercharger, ChargePoint, Electrify America, EVgo, Blink, FLO, and many more. Our data comes from the US Department of Energy\'s Alternative Fuels Station Locator, covering 60,000+ stations nationwide.',
  },
  {
    question: 'How do I install Wattz Up on my phone?',
    answer:
      'Wattz Up is a Progressive Web App (PWA). On iPhone: open the site in Safari, tap the Share button, then "Add to Home Screen." On Android: tap the browser menu (three dots), then "Install app" or "Add to Home Screen." It works offline and feels like a native app!',
  },
  {
    question: 'Is my location data private?',
    answer:
      'Yes. We never store your exact location. When you submit a report, we only save a geohash (a rough area, not a precise point). Your device ID is hashed with a one-way function so it can\'t be traced back to you. We don\'t sell data to third parties.',
  },
  {
    question: 'Why are some stations showing "Unknown" wait times?',
    answer:
      'This means no one has reported from that station recently. Wattz Up gets better the more people use it. Next time you charge, take 5 seconds to report what you see — you\'ll help every EV driver who comes after you.',
  },
  {
    question: 'Can I filter stations by plug type?',
    answer:
      'Yes! Use the plug type dropdown in the search bar to filter by CCS, NACS (Tesla), CHAdeMO, or J1772. You can also filter by network and adjust the search radius from 5 to 50 km.',
  },
  {
    question: 'The app isn\'t loading or showing errors. What do I do?',
    answer:
      'Try these steps: 1) Pull down to refresh. 2) Check your internet connection. 3) Clear the app cache (Settings > Apps > Wattz Up > Clear Cache). 4) Reinstall from the browser. If the problem persists, the station data service may be temporarily down — try again in a few minutes.',
  },
];

function FAQSection({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-sm"
      onClick={() => setOpen(!open)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-sm">{item.question}</h3>
          {open ? (
            <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
          ) : (
            <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
          )}
        </div>
        {open && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {item.answer}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-3 bg-card sticky top-0 z-10">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold">Help & Support</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-8">
        {/* Quick Start */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            Quick Start
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-1">1. Allow Location</h3>
                  <p className="text-xs text-muted-foreground">
                    Let Wattz Up find chargers near you. We never store your exact position.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                  <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-1">2. Find a Charger</h3>
                  <p className="text-xs text-muted-foreground">
                    Browse the map or scroll the list. Filter by network, plug type, or distance.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-1">3. Check Wait Times</h3>
                  <p className="text-xs text-muted-foreground">
                    See estimated waits based on crowd reports and historical patterns.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                  <MessageSquarePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-1">4. Report & Help Others</h3>
                  <p className="text-xs text-muted-foreground">
                    Tap the report button to share what you see. It takes 5 seconds and helps everyone.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Understanding the Map */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-500" />
            Understanding the Map
          </h2>
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-sm flex-shrink-0" />
                <div>
                  <span className="font-medium text-sm">Green</span>
                  <span className="text-sm text-muted-foreground"> — Short wait, under 5 minutes</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-sm flex-shrink-0" />
                <div>
                  <span className="font-medium text-sm">Yellow</span>
                  <span className="text-sm text-muted-foreground"> — Moderate wait, 5-15 minutes</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-sm flex-shrink-0" />
                <div>
                  <span className="font-medium text-sm">Red</span>
                  <span className="text-sm text-muted-foreground"> — Long wait, 15+ minutes</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white shadow-sm flex-shrink-0" />
                <div>
                  <span className="font-medium text-sm">Gray</span>
                  <span className="text-sm text-muted-foreground"> — No recent data available</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Install as App */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-500" />
            Install on Your Phone
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm mb-1">iPhone (Safari)</h3>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open this site in Safari</li>
                    <li>Tap the Share button (square with arrow)</li>
                    <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                    <li>Tap &quot;Add&quot;</li>
                  </ol>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm mb-1">Android (Chrome)</h3>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open this site in Chrome</li>
                    <li>Tap the menu (three dots)</li>
                    <li>Tap &quot;Install app&quot; or &quot;Add to Home Screen&quot;</li>
                    <li>Tap &quot;Install&quot;</li>
                  </ol>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Privacy */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Your Privacy
          </h2>
          <Card className="p-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                Your exact location is never stored — only a rough area (geohash)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                Your device ID is one-way hashed — it cannot be traced back to you
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                No account or sign-up required — just open and use
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                We never sell your data to third parties
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">&#10003;</span>
                Reports expire automatically to keep only fresh data
              </li>
            </ul>
          </Card>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-500" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <FAQSection key={i} item={faq} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Wattz Up</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Station data provided by the U.S. Department of Energy — Alternative Fuels Station Locator
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Made for EV drivers, by EV drivers.
          </p>
        </footer>
      </div>
    </div>
  );
}
