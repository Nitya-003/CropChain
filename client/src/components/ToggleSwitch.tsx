import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, onLabel = 'Active', offLabel = 'Flagged / Inactive' }) => {
  return (
    <label className="flex items-center cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors duration-300 ${checked ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <div
          className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-4' : ''}`}
        ></div>
      </div>
      <span className={`ml-3 text-sm font-medium ${checked ? 'text-green-600' : 'text-red-600'}`}>
        {checked ? onLabel : offLabel}
      </span>
    </label>
  );
};

export default ToggleSwitch;
