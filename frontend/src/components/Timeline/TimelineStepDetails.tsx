import React from 'react';
import { Clock, User, MapPin, Award } from 'lucide-react';

interface TimelineStepDetailsProps {
  actor: string;
  location: string;
  timestamp: string;
  certifications?: string;
  notes?: string;
}

const TimelineStepDetails: React.FC<TimelineStepDetailsProps> = ({
  actor,
  location,
  timestamp,
  certifications,
  notes,
}) => {
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="mt-4 space-y-3 text-sm text-gray-600 border-t pt-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400" />
        <span className="font-medium">Timestamp:</span>
        <span>{formatDate(timestamp)}</span>
      </div>

      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-green-600" />
        <span className="font-medium">Actor:</span>
        <span>{actor}</span>
      </div>

      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-blue-600" />
        <span className="font-medium">Location:</span>
        <span>{location}</span>
      </div>

      {certifications && (
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-yellow-600" />
          <span className="font-medium">Certifications:</span>
          <span>{certifications}</span>
        </div>
      )}

      {notes && (
        <div className="bg-gray-50 rounded-lg p-3 text-gray-700 mt-2">
          {notes}
        </div>
      )}
    </div>
  );
};

export default TimelineStepDetails;
