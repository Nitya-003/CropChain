import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Thermometer, Droplets, CloudRain, FlaskConical, Sprout, ChevronRight, RotateCcw, Plus, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCropRecommendation,
  RecommendationRequest,
  RecommendationResult,
} from '../services/cropRecommendationService';

// ── Crop display metadata ────────────────────────────────────────────────────

const CROP_META: Record<string, { color: string; bgColor: string }> = {
  rice:        { color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50/50 dark:bg-yellow-950/10 border-yellow-200/50 dark:border-yellow-900/20' },
  maize:       { color: 'text-yellow-500 dark:text-yellow-300', bgColor: 'bg-yellow-50/30 dark:bg-yellow-950/10 border-yellow-200/30 dark:border-yellow-900/10' },
  chickpea:    { color: 'text-amber-600 dark:text-amber-400',  bgColor: 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/20' },
  kidneybeans: { color: 'text-red-650 dark:text-red-400',    bgColor: 'bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/20' },
  pigeonpeas:  { color: 'text-emerald-600 dark:text-emerald-400',  bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/20' },
  mothbeans:   { color: 'text-green-600 dark:text-green-400',  bgColor: 'bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/20' },
  mungbean:    { color: 'text-emerald-555 dark:text-emerald-400',bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/20' },
  blackgram:   { color: 'text-slate-600 dark:text-slate-400',   bgColor: 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/30' },
  lentil:      { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-900/20' },
  pomegranate: { color: 'text-red-500 dark:text-red-455',    bgColor: 'bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/20' },
  banana:      { color: 'text-yellow-500 dark:text-yellow-355', bgColor: 'bg-yellow-50/30 dark:bg-yellow-950/10 border-yellow-200/30 dark:border-yellow-900/10' },
  mango:       { color: 'text-orange-500 dark:text-orange-400', bgColor: 'bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-900/20' },
  grapes:      { color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50/50 dark:bg-purple-950/10 border-purple-200/50 dark:border-purple-900/20' },
  watermelon:  { color: 'text-emerald-500 dark:text-emerald-400',  bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/20' },
  muskmelon:   { color: 'text-lime-650 dark:text-lime-400',   bgColor: 'bg-lime-50/50 dark:bg-lime-950/10 border-lime-200/50 dark:border-lime-900/20' },
  apple:       { color: 'text-red-500 dark:text-red-400',    bgColor: 'bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/20' },
  orange:      { color: 'text-orange-500 dark:text-orange-455', bgColor: 'bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-900/20' },
  papaya:      { color: 'text-orange-500 dark:text-orange-400', bgColor: 'bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-900/20' },
  coconut:     { color: 'text-amber-700 dark:text-amber-400',  bgColor: 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/20' },
  cotton:      { color: 'text-pink-500 dark:text-pink-400',   bgColor: 'bg-pink-50/50 dark:bg-pink-950/10 border-pink-200/50 dark:border-pink-900/20' },
  jute:        { color: 'text-teal-600 dark:text-teal-400',   bgColor: 'bg-teal-50/50 dark:bg-teal-950/10 border-teal-200/50 dark:border-teal-900/20' },
  coffee:      { color: 'text-stone-600 dark:text-stone-400',  bgColor: 'bg-stone-50/50 dark:bg-stone-950/10 border-stone-200/50 dark:border-stone-900/20' },
};

function getCropMeta(crop: string) {
  return CROP_META[crop.toLowerCase()] ?? { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/20' };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Slider field component ────────────────────────────────────────────────────

interface SliderFieldProps {
  label: string;
  unit: string;
  icon: React.ReactNode;
  name: keyof RecommendationRequest;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
  onChange: (name: keyof RecommendationRequest, value: number) => void;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label, unit, icon, name, value, min, max, step, description, onChange,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <span className="text-primary">{icon}</span>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(name, Math.max(min, Math.min(max, v)));
          }}
          className="w-20 text-right text-sm font-semibold text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{unit}</span>
      </div>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(name, parseFloat(e.target.value))}
      className="w-full h-1.5 bg-gray-250 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
    />
    <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>
  </div>
);

// ── Confidence arc component ──────────────────────────────────────────────────

const ConfidenceArc: React.FC<{ value: number }> = ({ value }) => {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-800" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold text-gray-800 dark:text-white">{value}%</span>
        <p className="text-xs text-gray-500 dark:text-gray-400">Match</p>
      </div>
    </div>
  );
};

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS: RecommendationRequest = {
  N: 79, P: 47, K: 40, pH: 6.5,
  temperature: 23, humidity: 82, rainfall: 120,
};

// ── Main page component ───────────────────────────────────────────────────────

const CropRecommendation: React.FC = () => {
  const navigate = useNavigate();

  const [inputs, setInputs] = useState<RecommendationRequest>(DEFAULT_INPUTS);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name: keyof RecommendationRequest, value: number) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await getCropRecommendation(inputs);
      setResult(data);
      window.scrollTo({ top: document.getElementById('result-card')?.offsetTop ?? 0, behavior: 'smooth' });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to get recommendation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBatch = () => {
    if (!result) return;
    navigate(`/add-batch?cropType=${encodeURIComponent(result.crop)}`, {
      state: { cropType: result.crop },
    });
  };

  const meta = result ? getCropMeta(result.crop) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">

      {/* ── Hero ── */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium px-4 py-1.5 rounded-full">
          <Sprout className="w-4 h-4" />
          AI-Powered Advisory
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
          Smart Planting
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-base">
          Enter your soil nutrients and local climate data. Our ML model will recommend the crop with the highest probability of success on your land.
        </p>
      </div>

      {/* ── Input form ── */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-card rounded-2xl shadow-lg border border-gray-150 dark:border-border overflow-hidden">

          {/* Soil Nutrients */}
          <div className="p-6 border-b border-gray-150 dark:border-border">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white mb-6">
              <FlaskConical className="w-4 h-4 text-primary" />
              Soil Nutrients
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <SliderField
                label="Nitrogen (N)" unit="kg/ha" icon={<Leaf className="w-3.5 h-3.5" />}
                name="N" value={inputs.N} min={0} max={140} step={1}
                description="Primary nutrient for leaf/stem growth"
                onChange={handleChange}
              />
              <SliderField
                label="Phosphorus (P)" unit="kg/ha" icon={<Leaf className="w-3.5 h-3.5" />}
                name="P" value={inputs.P} min={5} max={145} step={1}
                description="Supports root development and flowering"
                onChange={handleChange}
              />
              <SliderField
                label="Potassium (K)" unit="kg/ha" icon={<Leaf className="w-3.5 h-3.5" />}
                name="K" value={inputs.K} min={5} max={205} step={1}
                description="Improves fruit quality and disease resistance"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Soil Chemistry */}
          <div className="p-6 border-b border-gray-150 dark:border-border">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white mb-6">
              <FlaskConical className="w-4 h-4 text-blue-500" />
              Soil Chemistry
            </h2>
            <div className="grid gap-6 sm:grid-cols-1 max-w-sm">
              <SliderField
                label="Soil pH" unit="" icon={<FlaskConical className="w-3.5 h-3.5" />}
                name="pH" value={inputs.pH} min={3.5} max={9.5} step={0.1}
                description="Affects nutrient availability (ideal: 6.0–7.5 for most crops)"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Environmental Factors */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white mb-6">
              <CloudRain className="w-4 h-4 text-sky-500" />
              Environmental Factors
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <SliderField
                label="Temperature" unit="°C" icon={<Thermometer className="w-3.5 h-3.5" />}
                name="temperature" value={inputs.temperature} min={0} max={50} step={0.5}
                description="Average growing-season temperature"
                onChange={handleChange}
              />
              <SliderField
                label="Humidity" unit="%" icon={<Droplets className="w-3.5 h-3.5" />}
                name="humidity" value={inputs.humidity} min={10} max={100} step={1}
                description="Relative atmospheric humidity"
                onChange={handleChange}
              />
              <SliderField
                label="Rainfall" unit="mm" icon={<CloudRain className="w-3.5 h-3.5" />}
                name="rainfall" value={inputs.rainfall} min={0} max={300} step={1}
                description="Average annual rainfall"
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 disabled:bg-primary/50 text-primary-foreground font-semibold px-8 py-3 rounded-xl transition-colors shadow-md shadow-primary/10 dark:shadow-none"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
                Analysing…
              </>
            ) : (
              <>
                <Sprout className="w-4 h-4" />
                Get Recommendation
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </form>

      {/* ── Result card ── */}
      {result && meta && (
        <div id="result-card">
          <div className={`rounded-2xl shadow-lg border border-border overflow-hidden ${meta.bgColor}`}>

            {/* Top banner */}
            <div className="bg-primary/90 px-6 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-primary-foreground text-sm font-medium">Recommendation Ready</span>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                {/* Confidence arc + icon */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="relative">
                    <ConfidenceArc value={result.confidence} />
                    <div className="absolute -bottom-1 -right-1 bg-background dark:bg-card p-2 rounded-full border border-border shadow-sm">
                      <Sprout className={`h-6 w-6 ${meta.color}`} />
                    </div>
                  </div>
                </div>

                {/* Crop info */}
                <div className="flex-1 text-center sm:text-left space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Recommended Crop
                    </p>
                    <h2 className={`text-4xl font-bold ${meta.color}`}>
                      {capitalize(result.crop)}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      {result.confidence}% confidence — based on your soil and climate profile
                    </p>
                  </div>

                  {/* Alternatives */}
                  {result.alternatives?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Alternatives
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        {result.alternatives.map((alt) => {
                          const altMeta = getCropMeta(alt.crop);
                          return (
                            <span
                              key={alt.crop}
                              className="inline-flex items-center gap-1.5 bg-background dark:bg-card text-gray-700 dark:text-gray-300 text-sm font-medium px-3 py-1.5 rounded-lg border border-border shadow-sm"
                            >
                              <Sprout className={`h-4 w-4 ${altMeta.color}`} />
                              <span>{capitalize(alt.crop)}</span>
                              <span className="text-xs text-gray-400 font-normal">{alt.confidence}%</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={handleCreateBatch}
                    className="inline-flex items-center gap-2 bg-foreground text-background hover:opacity-90 font-semibold px-6 py-2.5 rounded-xl transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Batch with {capitalize(result.crop)}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Input summary footer */}
            <div className="bg-background/40 dark:bg-card/40 border-t border-border px-6 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Inputs used — N:{inputs.N} · P:{inputs.P} · K:{inputs.K} · pH:{inputs.pH} · {inputs.temperature}°C · {inputs.humidity}% humidity · {inputs.rainfall}mm rainfall
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Info callouts ── */}
      <div className="grid sm:grid-cols-3 gap-4 text-sm">
        {[
          { icon: Sprout, title: 'For Farmers', text: 'Reduce the risk of planting the wrong crop in unsuitable soil conditions.' },
          { icon: Package, title: 'For the Supply Chain', text: 'Predict what crops will enter the market, helping Mandis and Retailers plan ahead.' },
          { icon: RotateCcw, title: 'For Sustainability', text: 'Encourages optimal resource use — less water and fewer fertilizers wasted.' },
        ].map(({ icon: IconComponent, title, text }) => (
          <div key={title} className="bg-white dark:bg-card rounded-xl p-4 border border-gray-150 dark:border-border shadow-sm space-y-1">
            <div className="text-primary mb-2"><IconComponent className="h-6 w-6" /></div>
            <p className="font-semibold text-gray-800 dark:text-white">{title}</p>
            <p className="text-gray-500 dark:text-gray-400">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CropRecommendation;
