"use client";
import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Shield, Users, TrendingUp, Globe, Sprout, Building2, Truck, Store, ArrowRight, Activity } from 'lucide-react';
import { useSocketStatus } from '../hooks/useBatchSocket';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { isConnected } = useSocketStatus();

  const benefits = [
    {
      icon: Shield,
      title: t('home.features.foodSafety.title'),
      description: t('home.features.foodSafety.description')
    },
    {
      icon: Users,
      title: t('home.features.consumerTrust.title'),
      description: t('home.features.consumerTrust.description')
    },
    {
      icon: TrendingUp,
      title: t('home.features.premiumPricing.title'),
      description: t('home.features.premiumPricing.description')
    },
    {
      icon: Globe,
      title: t('home.features.globalStandards.title'),
      description: t('home.features.globalStandards.description')
    }
  ];

  const stages = [
    { href: '/farmer', icon: Sprout, title: t('home.stages.farmer.title'), description: t('home.stages.farmer.description'), color: 'text-emerald-500 bg-emerald-500/10' },
    { href: '/mandi', icon: Building2, title: t('home.stages.mandi.title'), description: t('home.stages.mandi.description'), color: 'text-blue-500 bg-blue-500/10' },
    { href: '/transporter', icon: Truck, title: t('home.stages.transport.title'), description: t('home.stages.transport.description'), color: 'text-amber-500 bg-amber-500/10' },
    { href: '/retailer', icon: Store, title: t('home.stages.retailer.title'), description: t('home.stages.retailer.description'), color: 'text-purple-500 bg-purple-500/10' }
  ];

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 py-20 px-6 sm:px-12 shadow-sm">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -z-10 h-[300px] w-[300px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-10 h-[250px] w-[250px] rounded-full bg-blue-500/5 blur-3xl" />

        {/* Live Connection Badge */}
        <div className="absolute top-6 right-6">
          {isConnected ? (
            <Badge variant="outline" className="flex items-center gap-1.5 border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE UPDATES
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-1.5 border-amber-500/30 bg-amber-500/5 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              OFFLINE MODE
            </Badge>
          )}
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="outline" className="px-3 py-1 text-sm bg-background/50 border-border/60">
            <Activity className="h-3.5 w-3.5 mr-1.5 text-primary" /> Immutable Agricultural Supply Chain
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-tight">
            {t('home.welcome')}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent block mt-2">
              {t('app.tagline')}
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('home.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/add-batch">
              <Button size="lg" className="w-full sm:w-auto px-8 font-semibold shadow-md shadow-primary/10">
                {t('home.getStarted')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/track-batch">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 font-semibold bg-background/50">
                {t('nav.trackBatch')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Supply Chain Stages */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t('home.supplyChainVisibility')}
          </h2>
          <p className="text-muted-foreground text-sm">
            Track crop journey securely with distributed cryptographic checkpoints at every node.
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {stages.map((stage, index) => (
            <Link key={index} href={stage.href} className="block group">
              <Card className="relative h-full hover:shadow-md hover:-translate-y-1 transition-all duration-300 border-border bg-card cursor-pointer">
                {/* Connecting Line */}
                {index < stages.length - 1 && (
                  <div className="hidden md:block absolute left-full top-[4.5rem] w-full h-[1px] bg-gradient-to-r from-primary/30 to-border/30 z-0 translate-x-[-12px] w-[calc(100%-24px)]" />
                )}
                <CardHeader className="flex flex-col items-center text-center pb-2 relative z-10">
                  <div className={`p-4 rounded-full ${stage.color} mb-4 transform group-hover:scale-105 transition-transform duration-300`}>
                    <stage.icon className="h-8 w-8" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{stage.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center pb-6 relative z-10">
                  <p className="text-muted-foreground text-xs leading-relaxed">{stage.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border border-border bg-card rounded-3xl p-8 sm:p-12 shadow-sm max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t('home.whyChoose')}
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => (
            <div key={index} className="p-6 rounded-2xl hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/10 transition-all duration-300 space-y-3">
              <div className="p-3 bg-primary/10 w-fit rounded-xl">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{benefit.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-emerald-950 border border-slate-800 rounded-3xl p-10 sm:p-16 text-white text-center space-y-6 shadow-xl">
          <div className="absolute top-0 right-0 -z-10 h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('home.transformSupplyChain')}</h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed">
            {t('home.joinThousands')}
          </p>
          <div className="pt-4">
            <Link href="/add-batch">
              <Button size="lg" className="bg-white hover:bg-slate-100 text-slate-900 font-semibold px-8">
                {t('home.getStartedToday')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
