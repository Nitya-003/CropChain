import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout,
  Truck,
  Store,
  ChevronDown,
  Building
} from 'lucide-react';
import TimelineStepDetails from './TimelineStepDetails';
import { TimelineEvent } from './types';

interface TimelineStepProps {
  event: TimelineEvent;
  index: number;
  globalCertifications?: string;
}

const stageIconMap: Record<string, any> = {
  farmer: Sprout,
  transport: Truck,
  retailer: Store,
  mandi: Building,
};

const statusStyles: Record<string, { dot: string; badge: string }> = {
  completed: {
    dot: "bg-green-500",
    badge: "text-green-600 bg-green-100",
  },
  pending: {
    dot: "bg-gray-400",
    badge: "text-gray-600 bg-gray-100",
  },
  flagged: {
    dot: "bg-red-500",
    badge: "text-red-600 bg-red-100",
  },
};

const TimelineStep: React.FC<TimelineStepProps> = ({ event, index, globalCertifications }) => {
  const [open, setOpen] = useState(false);

  // Fallback for icon and styles
  const Icon = stageIconMap[event.stage as string] || Store;
  const status = event.status || 'completed';
  const styles = statusStyles[status];

  // Certifications can come from event or global
  const certs = event.certifications || globalCertifications;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      className="relative flex items-start gap-4 sm:gap-6"
    >
      {/* Timeline Dot */}
      <div
        className={`z-10 h-14 w-14 rounded-full flex items-center justify-center ${styles.dot} shadow-lg shrink-0`}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      {/* Card */}
      <div
        className={`flex-1 bg-white rounded-xl border p-4 sm:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${open ? 'ring-2 ring-green-100' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h3 className="text-lg font-semibold capitalize text-gray-800">
                    {event.stage}
                </h3>
                 <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full uppercase w-fit ${styles.badge}`}
                  >
                    {status}
                  </span>
            </div>

             {/* Arrow Rotation */}
            <motion.div
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.2 }}
            >
                <ChevronDown className="h-5 w-5 text-gray-400" />
            </motion.div>
        </div>

        {/* Expandable Section */}
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                >
                    <TimelineStepDetails
                        actor={event.actor}
                        location={event.location}
                        timestamp={event.timestamp}
                        certifications={certs}
                        notes={event.notes}
                    />
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TimelineStep;
