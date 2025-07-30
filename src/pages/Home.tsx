import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Truck, Store, Users, TrendingUp, Globe } from 'lucide-react';

const Home: React.FC = () => {
  const benefits = [
    {
      icon: Shield,
      title: 'Food Safety',
      description: 'Complete traceability ensures food safety and quality at every step'
    },
    {
      icon: Users,
      title: 'Consumer Trust',
      description: 'Transparent supply chain builds trust between farmers and consumers'
    },
    {
      icon: TrendingUp,
      title: 'Premium Pricing',
      description: 'Traceable crops command premium prices in the market'
    },
    {
      icon: Globe,
      title: 'Global Standards',
      description: 'Meet international food safety and quality standards'
    }
  ];

  const stages = [
    { icon: '🌾', title: 'Farmer', description: 'Crop planting and harvesting' },
    { icon: '🏪', title: 'Mandi', description: 'Market aggregation and quality check' },
    { icon: '🚛', title: 'Transport', description: 'Logistics and distribution' },
    { icon: '🏬', title: 'Retailer', description: 'Final sale to consumers' }
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-6">
            Track Your Crops with
            <span className="text-green-600 block">Blockchain Technology</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            CropChain provides complete transparency in the agricultural supply chain using immutable blockchain records.
            From farm to fork, every step is traceable, verified, and secure.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/add-batch"
              className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Start Tracking
            </Link>
            <Link
              to="/track-batch"
              className="bg-white text-green-600 px-8 py-4 rounded-lg font-semibold text-lg border-2 border-green-600 hover:bg-green-50 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              Track a Batch
            </Link>
          </div>
        </div>
      </section>

      {/* Supply Chain Stages */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">
            Complete Supply Chain Visibility
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {stages.map((stage, index) => (
              <div key={index} className="text-center group">
                <div className="bg-white rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center text-4xl shadow-lg group-hover:shadow-xl transform group-hover:scale-110 transition-all duration-300">
                  {stage.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">{stage.title}</h3>
                <p className="text-gray-600">{stage.description}</p>
                {index < stages.length - 1 && (
                  <div className="hidden md:block absolute mt-12 ml-24 w-8 h-0.5 bg-green-300"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white rounded-3xl shadow-xl">
        <div className="max-w-6xl mx-auto px-8">
          <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">
            Why Choose CropChain?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-6 hover:bg-green-50 rounded-xl transition-all duration-300">
                <benefit.icon className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-3">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 text-center">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-green-600 to-blue-600 rounded-3xl p-12 text-white shadow-2xl">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Supply Chain?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of farmers, markets, and retailers using CropChain for transparent food traceability.
          </p>
          <Link
            to="/add-batch"
            className="bg-white text-green-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
