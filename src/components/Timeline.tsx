import React from "react";
import { motion } from "framer-motion";
import {
  Sprout,
  Truck,
  Store,
  MapPin,
  User,
  Clock,
} from "lucide-react";

type Stage = "farmer" | "transport" | "retailer";
type Status = "completed" | "pending" | "flagged";

interface TimelineEvent {
  stage: Stage;
  actor: string;
  location: string;
  timestamp: string;
  status: Status;
  notes?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

const stageIconMap = {
  farmer: Sprout,
  transport: Truck,
  retailer: Store,
};

const statusStyles = {
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

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300" />

      <div className="space-y-10">
        {events.map((event, index) => {
          const Icon = stageIconMap[event.stage];
          const styles = statusStyles[event.status];

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              className="relative flex items-start gap-6"
            >
              {/* Timeline dot */}
              <div
                className={`z-10 h-14 w-14 rounded-full flex items-center justify-center ${styles.dot} shadow-lg`}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>

              {/* Card */}
              <div className="flex-1 bg-white rounded-xl border p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
                  <h3 className="text-lg font-semibold capitalize">
                    {event.stage}
                  </h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full uppercase ${styles.badge}`}
                  >
                    {event.status}
                  </span>
                </div>

                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDate(event.timestamp)}
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center text-gray-700">
                    <User className="h-4 w-4 mr-2 text-green-600" />
                    {event.actor}
                  </div>
                  <div className="flex items-center text-gray-700">
                    <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                    {event.location}
                  </div>
                </div>

                {event.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                    {event.notes}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
