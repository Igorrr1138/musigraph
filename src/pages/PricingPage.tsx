import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, Sparkles, Music, Diamond, ShieldCheck, RotateCcw, Clock, Music2 } from '@/components/icons';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';

const basicIncluded = [
  'Rate up to 50 albums per month',
  'Basic artist & album discovery',
  'Personal rating history',
  '3 custom playlists',
];
const basicExcluded = [
  'Advanced music statistics',
  'Unlimited ratings & playlists',
  'Data export (CSV, JSON)',
  'Priority customer support',
];
const proFeatures = [
  'Unlimited album & track ratings',
  'Unlimited custom playlists',
  'Advanced music statistics & graphs',
  'AI-powered music recommendations',
  'Artist deep-dive analytics',
  'Export data as CSV or JSON',
  'Priority customer support',
  'Early access to new features',
];

const highlights = [
  {
    icon: Music,
    title: 'Unlimited Ratings',
    body: 'Rate as many albums, tracks, and artists as you want. Build your complete music history without any restrictions.',
  },
  {
    icon: Diamond,
    title: 'Deep Analytics',
    body: 'Visualize your listening patterns with advanced charts and stats. See how your taste evolves over time.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Picks',
    body: 'Get personalized music recommendations based on your unique rating history. Discover your next favorite album.',
  },
];

const trustPoints = [
  { icon: ShieldCheck, label: 'Secure payments' },
  { icon: RotateCcw, label: 'Cancel anytime' },
  { icon: Clock, label: '7-day free trial' },
  { icon: Music2, label: 'Built for music lovers' },
];

export default function PricingPage() {
  useEffect(() => {
    document.title = 'Pricing — Discover & Rate';
    const desc = 'Simple, transparent pricing. Choose Basic (free) or Pro to unlock unlimited ratings, deep analytics, and AI picks.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="container mx-auto px-6 text-center max-w-3xl">
          <div className="inline-block px-4 py-1.5 rounded-full border border-border/60 text-xs uppercase tracking-[0.25em] text-muted-foreground mb-6">
            Pricing
          </div>
          <h1 className="text-4xl md:text-6xl mb-5 text-balance">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Choose the plan that fits your music journey.<br />
            Upgrade or cancel anytime — no strings attached.
          </p>
        </section>

        {/* Why go pro */}
        <section className="container mx-auto px-6 mt-20 max-w-6xl">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Why go Pro</p>
            <h2 className="text-3xl md:text-4xl text-balance">
              Everything you need for<br />the ultimate music experience
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {highlights.map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass rounded-2xl p-7">
                <div className="w-11 h-11 rounded-lg bg-secondary flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section className="container mx-auto px-6 mt-16 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Basic */}
            <div className="glass rounded-3xl p-8 md:p-10 flex flex-col">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Free</p>
              <h3 className="text-4xl mb-3">Basic</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                Perfect for casual listeners who want to start tracking their music taste.
              </p>
              <div className="border-t border-border/50 pt-6 mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-boldonse">$0</span>
                  <span className="text-muted-foreground">/ month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Free forever — no credit card required.</p>
              </div>
              <Link to="/auth" className="block">
                <Button variant="secondary" className="w-full h-12 rounded-xl">Get Started for Free</Button>
              </Link>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-8 mb-4">What's included</p>
              <ul className="space-y-3">
                {basicIncluded.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/90 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </span>
                    {f}
                  </li>
                ))}
                {basicExcluded.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground/60">
                    <Circle className="w-5 h-5 shrink-0" strokeWidth={1.25} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="relative rounded-3xl p-8 md:p-10 flex flex-col gradient-bg text-primary-foreground overflow-hidden">
              <div className="absolute inset-0 bg-background/85" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/10 border border-foreground/15 text-xs mb-5">
                  <Sparkles className="w-3 h-3" /> Most popular
                </div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Premium</p>
                <h3 className="text-4xl mb-3 text-foreground">Pro</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  For true music enthusiasts who want the ultimate rating experience.
                </p>
                <div className="border-t border-border/50 pt-6 mb-6">
                  <div className="flex items-baseline gap-2 text-foreground">
                    <span className="text-5xl font-boldonse">$9.99</span>
                    <span className="text-muted-foreground">/ month</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Billed monthly — cancel anytime.</p>
                </div>
                <Link to="/auth" className="block">
                  <Button className="w-full h-12 rounded-xl gradient-bg text-primary-foreground border-0 hover:opacity-90">
                    Start Free Trial
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-3 text-center">7-day free trial — no credit card required.</p>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-8 mb-4">Everything in Free, plus:</p>
                <ul className="space-y-3">
                  {proFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                      <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Trust bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-border/40">
            {trustPoints.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Icon className="w-4 h-4" /> {label}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
