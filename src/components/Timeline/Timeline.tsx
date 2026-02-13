import React from 'react';
import TimelineStep from './TimelineStep';
import { TimelineEvent } from './types';

interface TimelineProps {
  events: TimelineEvent[];
  globalCertifications?: string;
}

const Timeline: React.FC<TimelineProps> = ({ events, globalCertifications }) => {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-8 pb-8">
        {events.map((event, index) => (
          <TimelineStep
            key={index}
            event={event}
            index={index}
            globalCertifications={globalCertifications}
          />
        ))}
      </div>
    </div>
  );
};

export default Timeline;
