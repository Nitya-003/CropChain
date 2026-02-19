import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const AccessDenied: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full mb-6">
                <ShieldAlert className="h-16 w-16 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-md mb-8">
                You do not have permission to access this page. Please contact your administrator if you believe this is a mistake.
            </p>
            <Link
                to="/"
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-md hover:shadow-lg"
            >
                <ArrowLeft className="h-5 w-5" />
                <span>Return to Home</span>
            </Link>
        </div>
    );
};

export default AccessDenied;
