import React from 'react';
import { Check, Loader2, Circle, MapPin, Calendar } from 'lucide-react';

interface TimelineEvent {
  title: string;
  date: string;
  location: string;
  description?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  currentStep: number; // 0 = First step, 1 = Second step, etc.
}

const Timeline: React.FC<TimelineProps> = ({ events, currentStep }) => {
  return (
    <div className="relative pl-4">
      {events.map((event, index) => {
        // Determine the status of this specific step
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep;

        return (
          <div key={index} className="mb-8 relative pl-8">
            {/* 1. The Vertical Connecting Line */}
            {index !== events.length - 1 && (
              <div
                className={`absolute left-[11px] top-8 h-full w-0.5 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700 border-l-2 border-dotted border-gray-300'
                }`}
                style={{ height: 'calc(100% + 16px)' }} // Connect to next item
              />
            )}

            {/* 2. The Status Circle/Icon */}
            <div
              className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                isCompleted
                  ? 'border-green-500 bg-green-500'
                  : isCurrent
                  ? 'border-green-500 bg-white dark:bg-gray-800 animate-pulse'
                  : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600'
              }`}
            >
              {isCompleted ? (
                <Check className="h-3 w-3 text-white" />
              ) : isCurrent ? (
                <Loader2 className="h-3 w-3 text-green-500 animate-spin" />
              ) : (
                <Circle className="h-3 w-3 text-gray-300" />
              )}
            </div>

            {/* 3. The Content Card */}
            <div
              className={`rounded-lg border p-4 shadow-sm transition-all duration-200 ${
                isCurrent
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/10 scale-105'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <h3
                className={`font-bold text-lg ${
                  isCurrent ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-white'
                }`}
              >
                {event.title}
              </h3>
              
              <div className="mt-2 flex flex-col space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                  <span>{event.location}</span>
                </div>
                {event.description && (
                  <p className="mt-2 text-gray-500 italic border-l-2 border-gray-200 pl-3">
                    "{event.description}"
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Timeline;