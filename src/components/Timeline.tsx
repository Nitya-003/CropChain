import React from 'react';
import { Calendar, MapPin, User, Clock } from 'lucide-react';

interface TimelineEvent {
  stage: string;
  actor: string;
  location: string;
  timestamp: string;
  notes?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const getStageIcon = (stage: string) => {
    const icons = {
      farmer: '🌾',
      mandi: '🏪',
      transport: '🚛',
      retailer: '🏬'
    };
    return icons[stage as keyof typeof icons] || '📦';
  };

  const getStageColor = (stage: string) => {
    const colors = {
      farmer: 'bg-green-500',
      mandi: 'bg-blue-500',
      transport: 'bg-yellow-500',
      retailer: 'bg-purple-500'
    };
    return colors[stage as keyof typeof colors] || 'bg-gray-500';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
      
      <div className="space-y-8">
        {events.map((event, index) => (
          <div key={index} className="relative flex items-start space-x-6">
            {/* Timeline dot */}
            <div className={`relative z-10 w-16 h-16 ${getStageColor(event.stage)} rounded-full flex items-center justify-center text-2xl shadow-lg`}>
              {getStageIcon(event.stage)}
            </div>
            
            {/* Event card */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800 capitalize flex items-center">
                  {event.stage}
                  {index === 0 && (
                    <span className="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      Origin
                    </span>
                  )}
                  {index === events.length - 1 && (
                    <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                      Latest
                    </span>
                  )}
                </h3>
                <div className="flex items-center text-sm text-gray-500 mt-2 sm:mt-0">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDate(event.timestamp)}
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center text-gray-600">
                  <User className="h-4 w-4 mr-2 text-green-600" />
                  <span className="font-medium">{event.actor}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                  <span>{event.location}</span>
                </div>
              </div>
              
              {event.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-700 text-sm">{event.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
