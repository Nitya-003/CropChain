"use client";

import React from 'react';
import { Button } from '../ui/button';

import type { MarketplaceFilterState } from './MarketplaceFilters';

export interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function MarketplaceFilterChips({ chips }: { chips: Chip[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1"
        >
          <span className="text-xs font-semibold text-foreground">{chip.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={chip.onRemove}
            className="h-6 px-0 text-xs text-muted-foreground hover:text-foreground"
            aria-label={`Remove filter: ${chip.label}`}
          >
            ×
          </Button>
        </span>
      ))}
    </div>
  );
}

export function buildMarketplaceChips(
  filters: MarketplaceFilterState,
  onRemove: {
    category: () => void;
    priceMin: () => void;
    priceMax: () => void;
    location: () => void;
    availability: () => void;
  }
): Chip[] {
  const chips: Chip[] = [];

  if (filters.productCategory) {
    chips.push({
      key: 'category',
      label: `Category: ${capitalize(filters.productCategory)}`,
      onRemove: onRemove.category,
    });
  }

  const hasMin = filters.priceMin !== '';
  const hasMax = filters.priceMax !== '';
  if (hasMin || hasMax) {
    const min = hasMin ? Number(filters.priceMin) : undefined;
    const max = hasMax ? Number(filters.priceMax) : undefined;

    if (min !== undefined && max !== undefined) {
      chips.push({
        key: 'price',
        label: `Price: ${min} - ${max}`,
        onRemove: () => {
          onRemove.priceMin();
          onRemove.priceMax();
        },
      });
    } else if (min !== undefined) {
      chips.push({
        key: 'priceMin',
        label: `Min: ${min}`,
        onRemove: onRemove.priceMin,
      });
    } else if (max !== undefined) {
      chips.push({
        key: 'priceMax',
        label: `Max: ${max}`,
        onRemove: onRemove.priceMax,
      });
    }
  }

  if (filters.location) {
    chips.push({
      key: 'location',
      label: `Location: ${filters.location}`,
      onRemove: onRemove.location,
    });
  }

  if (filters.availability) {
    chips.push({
      key: 'availability',
      label: `Availability: ${filters.availability === 'active' ? 'Active' : 'Ended'}`,
      onRemove: onRemove.availability,
    });
  }

  return chips;
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

