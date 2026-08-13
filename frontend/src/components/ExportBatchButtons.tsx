import React, { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { exportBatchToCSV, exportBatchToPDF, ExportableBatch } from "../utils/exporters";

interface ExportBatchButtonsProps {
  batch: ExportableBatch;
  className?: string;
}

export const ExportBatchButtons: React.FC<ExportBatchButtonsProps> = ({
  batch,
  className = "",
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
      exportBatchToCSV(batch);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    } finally {
      setTimeout(() => setIsExportingCSV(false), 500);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportBatchToPDF(batch);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    } finally {
      setTimeout(() => setIsExportingPDF(false), 500);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        onClick={handleExportPDF}
        disabled={isExportingPDF}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
      >
        {isExportingPDF ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        Export PDF Certificate
      </button>

      <button
        onClick={handleExportCSV}
        disabled={isExportingCSV}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-600 transition-all disabled:opacity-50"
      >
        {isExportingCSV ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export CSV Data
      </button>
    </div>
  );
};
