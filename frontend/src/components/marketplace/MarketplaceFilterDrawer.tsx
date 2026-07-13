"use client";

import React from 'react';

import type { MarketplaceFilterState } from './MarketplaceFilters';
import MarketplaceFilters from './MarketplaceFilters';

export default function MarketplaceFilterDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  onClearAll,
  activeFilterCount,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  filters: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
  onClearAll: () => void;
  activeFilterCount: number;
}) {
  return (
    <div className={open ? 'fixed inset-0 z-50' : 'hidden'} aria-hidden={!open}>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close filters"
        onClick={() => onOpenChange(false)}
      />

      <aside
        className="absolute right-0 top-0 h-full w-full max-w-sm bg-background border-l border-border shadow-xl p-0 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Filters</p>
              <p className="text-xs text-muted-foreground">
                {activeFilterCount > 0 ? `${activeFilterCount} active` : 'No active filters'}
              </p>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground font-bold text-2xl leading-none"
              onClick={() => onOpenChange(false)}
              aria-label="Close filters"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4">
          <MarketplaceFilters
            filters={filters}
            onChange={onChange}
            onClearAll={onClearAll}
            activeFilterCount={activeFilterCount}
            isMobile
            onRequestClose={() => onOpenChange(false)}
          />
        </div>
      </aside>
    </div>
  );
}


