import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";

export default function NotFound() {
  const navigate = useNavigate();
  const [batchId, setBatchId] = useState("");
  
  if (import.meta.env.DEV) {
    console.warn("404 route hit – user navigated to undefined path");
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && batchId.trim()) {
      navigate(`/track-batch/${batchId.trim()}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative backdrop-blur-xl bg-white/60 rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center border border-white/20"
      >
        {/* Floating 404 Background */}
        <motion.h1
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="text-8xl font-bold text-gray-400/20 absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        >
          404
        </motion.h1>

        {/* Content */}
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">
            This batch has left the field
          </h2>

          <p className="text-gray-600 mb-8 leading-relaxed">
            The page you're looking for doesn't exist or the link expired.
          </p>

          {/* Search Input */}
          <div className="mb-8">
            <input
              type="text"
              placeholder="Enter Batch ID"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              onKeyDown={handleSearch}
              className="w-full px-5 py-3.5 rounded-xl bg-white/50 border border-gray-200/60 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all duration-200"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors duration-200 shadow-lg shadow-gray-900/10"
            >
              Dashboard
            </Link>

            <Link
              to="/track-batch"
              className="px-6 py-3 bg-white/50 text-gray-900 rounded-xl font-medium border border-gray-200/60 hover:bg-white/80 transition-all duration-200"
            >
              Track Batch
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}