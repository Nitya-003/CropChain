"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

const AccessDenied: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full mb-6">
        <ShieldAlert className="h-16 w-16 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {t("errors.accessDenied")}
      </h1>
      <p className="text-gray-600 dark:text-gray-300 max-w-md mb-8">
        {t("errors.accessDeniedMessage")}
      </p>
      <Link
        href="/"
        className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>{t("errors.returnHome")}</span>
      </Link>
    </div>
  );
};

export default AccessDenied;
