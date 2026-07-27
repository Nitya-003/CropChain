"use client";
import React from "react";
import { useTranslation } from "react-i18next";

export interface BatchFilterValues {
  search: string;
  stage: string;
  cropType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: string;
  page: number;
  limit: number;
}

interface BatchFiltersProps {
  filters: BatchFilterValues;
  onFilterChange: (filters: Partial<BatchFilterValues>) => void;
  onSearchSubmit: (search: string) => void;
  onClearFilters: () => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  activeFilterCount?: number;
}

const STAGES = ["farmer", "mandi", "transport", "retailer"];
const CROP_TYPES = ["rice", "wheat", "corn", "tomato"];
const STATUSES = ["Active", "Flagged", "Inactive"];

const BatchFilters: React.FC<BatchFiltersProps> = ({
  filters,
  onFilterChange,
  onSearchSubmit,
  onClearFilters,
  searchInput,
  onSearchInputChange,
  activeFilterCount,
}) => {
  const { t } = useTranslation();

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearchSubmit(searchInput);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col md:flex-row gap-4"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={t("filters.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 border border-border bg-background rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                onSearchInputChange("");
                onFilterChange({ search: "", page: 1 });
              }}
              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center h-[42px] px-6 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
        >
          {t("filters.search")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.stage")}
          </label>
          <select
            value={filters.stage}
            onChange={(e) => onFilterChange({ stage: e.target.value, page: 1 })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t("filters.allStages")}</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.cropType")}
          </label>
          <select
            value={filters.cropType}
            onChange={(e) =>
              onFilterChange({ cropType: e.target.value, page: 1 })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t("filters.allCrops")}</option>
            {CROP_TYPES.map((crop) => (
              <option key={crop} value={crop}>
                {crop.charAt(0).toUpperCase() + crop.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.status")}
          </label>
          <select
            value={filters.status}
            onChange={(e) =>
              onFilterChange({ status: e.target.value, page: 1 })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t("filters.allStatus")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.dateFrom")}
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              onFilterChange({ dateFrom: e.target.value, page: 1 })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.dateTo")}
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) =>
              onFilterChange({ dateTo: e.target.value, page: 1 })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.sortBy")}
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({ sortBy: e.target.value, page: 1 })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="createdAt">{t("filters.dateCreated")}</option>
            <option value="cropType">{t("filters.cropType")}</option>
            <option value="quantity">{t("filters.quantity")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("filters.order")}
          </label>
          <select
            value={filters.sortOrder}
            onChange={(e) =>
              onFilterChange({ sortOrder: e.target.value, page: 1 })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="desc">{t("filters.descending")}</option>
            <option value="asc">{t("filters.ascending")}</option>
          </select>
        </div>

        {(activeFilterCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-rose-500 hover:text-rose-600 hover:underline mt-4 ml-2 font-bold"
          >
            {t("filters.clearFilters", { count: activeFilterCount })}
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchFilters;
