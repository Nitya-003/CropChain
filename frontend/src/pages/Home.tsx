import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Truck, Store, Users, TrendingUp, Globe, Wifi } from 'lucide-react';
import { useSocketStatus } from '../hooks/useBatchSocket';

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
    { icon: '🌾', title: t('home.stages.farmer.title'), description: t('home.stages.farmer.description') },
    { icon: '🏪', title: t('home.stages.mandi.title'), description: t('home.stages.mandi.description') },
    { icon: '🚛', title: t('home.stages.transport.title'), description: t('home.stages.transport.description') },
    { icon: '🏬', title: t('home.stages.retailer.title'), description: t('home.stages.retailer.description') }
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16 relative bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 rounded-3xl px-4 sm:px-6">
        {/* Live Connection Badge */}
        <div className="absolute top-4 right-4">
          {isConnected && (
            <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full border border-green-300 dark:border-green-700 animate-pulse">
              <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">LIVE UPDATES</span>
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 dark:text-white mb-6">
            {t('home.welcome')}
            <span className="text-green-600 dark:text-green-400 block">{t('app.tagline')}</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            {t('home.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/add-batch"
              className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transform hover:scale-105 hover:-translate-y-1 transition-all duration-200 shadow-lg" 
            >
              {t('home.getStarted')}
            </Link>
            <Link
              to="/track-batch"
             className="bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 px-8 py-4 rounded-lg font-semibold text-lg border-2 border-green-600 hover:bg-green-50 dark:hover:bg-gray-700 transform hover:scale-105 hover:-translate-y-1 transition-all duration-200 shadow-lg"
            >
              {t('nav.trackBatch')}
            </Link>
          </div>
        </div>
      </section>

      {/* Supply Chain Stages */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 dark:text-white mb-12">
            {t('home.supplyChainVisibility')}
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {stages.map((stage, index) => (
              <div key={index} className="relative text-center group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center">
                {/* Connecting Line */}
                {index < stages.length - 1 && (
                  <div className="hidden md:block absolute left-1/2 ml-12 top-18 w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-green-500 to-blue-500 z-0 opacity-60"></div>
                )}
                <div className="bg-white dark:bg-gray-800 rounded-full w-24 h-24 mb-6 flex items-center justify-center text-4xl shadow-lg group-hover:shadow-xl transform group-hover:scale-110 transition-all duration-300 relative z-10 border border-gray-100 dark:border-gray-700">
                  {stage.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3 relative z-10">{stage.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-[200px] relative z-10">{stage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white dark:bg-gray-800 rounded-3xl shadow-xl">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center text-gray-800 dark:text-white mb-12">
            {t('home.whyChoose')}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-6 hover:bg-green-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl">
                <benefit.icon className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{benefit.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 text-center">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-green-600 to-blue-600 rounded-3xl p-12 text-white shadow-2xl hover:scale-[1.02] transition-all duration-300"> 
          <h2 className="text-4xl font-bold mb-6">{t('home.transformSupplyChain')}</h2>
          <p className="text-xl mb-8 opacity-90">
            {t('home.joinThousands')}
          </p>
          <Link
            to="/add-batch"
            className="bg-white text-green-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            {t('home.getStartedToday')}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;                                                                                                                                                                                                       