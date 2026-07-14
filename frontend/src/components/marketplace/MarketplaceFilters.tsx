"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export type MarketplaceSortKey =
  | 'latest'
  | 'price_asc'
  | 'price_desc'
  | 'popular';

export type AvailabilityStatus = 'active' | 'ended' | '';

export interface MarketplaceFilterState {
  productCategory: string; // cropType
  priceMin: string;
  priceMax: string;
  location: string; // origin
  availability: AvailabilityStatus;
  sortBy: MarketplaceSortKey;
}

export interface MarketplaceFiltersProps {
  filters: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
  onClearAll: () => void;
  activeFilterCount: number;
  isMobile?: boolean;
  onRequestClose?: () => void;
}

const cropOptions = [
  '',
  'rice',
  'wheat',
  'corn',
  'tomato',
];

export default function MarketplaceFilters({
  filters,
  onChange,
  onClearAll,
  activeFilterCount,
  isMobile,
  onRequestClose,
}: MarketplaceFiltersProps) {
  const set = (patch: Partial<MarketplaceFilterState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <Card className={isMobile ? 'p-5' : 'p-6'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Filters</p>
          <p className="text-xs text-muted-foreground">
            {activeFilterCount > 0 ? `${activeFilterCount} active` : 'No active filters'}
          </p>
        </div>
        {isMobile && onRequestClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onRequestClose}>
            Close
          </Button>
        )}
      </div>

      <div className={isMobile ? 'mt-4 space-y-5' : 'mt-6 space-y-5'}>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Product Category
          </label>
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
            value={filters.productCategory}
            onChange={(e) => set({ productCategory: e.target.value })}
            aria-label="Product category"
          >
            <option value="">All Categories</option>
            {cropOptions
              .filter(Boolean)
              .map((c) => (
                <option key={c} value={c}>
                  {String(c).charAt(0).toUpperCase() + String(c).slice(1)}
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Price Min
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
              value={filters.priceMin}
              onChange={(e) => set({ priceMin: e.target.value })}
              placeholder="Min"
              aria-label="Minimum price"
              min={0}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Price Max
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
              value={filters.priceMax}
              onChange={(e) => set({ priceMax: e.target.value })}
              placeholder="Max"
              aria-label="Maximum price"
              min={0}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Location
          </label>
          <input
            type="text"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
            value={filters.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Origin"
            aria-label="Location"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Availability Status
          </label>
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
            value={filters.availability}
            onChange={(e) => set({ availability: e.target.value as AvailabilityStatus })}
            aria-label="Availability status"
          >
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Sort
          </label>
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
            value={filters.sortBy}
            onChange={(e) => set({ sortBy: e.target.value as MarketplaceSortKey })}
            aria-label="Sort"
          >
            <option value="latest">Latest Listings</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>

        <div className="pt-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClearAll}
            disabled={activeFilterCount === 0}
            className="w-full rounded-xl"
          >
            Clear All Filters
          </Button>
        </div>
      </div>
    </Card>
  );
}

