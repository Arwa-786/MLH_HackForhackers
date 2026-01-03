import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const HackathonList = () => {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/hackathons');
      console.log('Fetched hackathons:', response.data);
      console.log('Total hackathons received:', response.data.length);
      setHackathons(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching hackathons:', err);
      if (err.code === 'ERR_NETWORK' || err.message.includes('Network')) {
        setError('Cannot connect to backend server. Make sure the backend is running on port 3000.');
      } else if (err.response) {
        setError(`Error: ${err.response.data?.error || err.response.statusText || 'Failed to load hackathons'}`);
      } else {
        setError('Failed to load hackathons. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Date TBD';
    if (!startDate) return `Until ${formatDate(endDate)}`;
    if (!endDate) return `From ${formatDate(startDate)}`;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same month, show: "Jan 15-17, 2026"
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
    }
    
    // Different months: "Jan 15 - Feb 2, 2026"
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const handleCardClick = (hackathonId) => {
    navigate(`/matching/${hackathonId}`);
  };

  const getTypeColor = (type) => {
    if (!type) return 'bg-gray-100 text-gray-700';
    if (type.toLowerCase().includes('digital') || type.toLowerCase().includes('online') || type.toLowerCase().includes('virtual')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    return 'bg-green-100 text-green-700 border-green-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            MLH Hackathons 2026
          </h1>
          <p className="text-xl text-gray-600 mb-3">
            Find your perfect hackathon and connect with teammates
          </p>
          {!loading && !error && (
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 shadow-sm">
              <span className="text-sm font-semibold text-gray-700">
                {hackathons.length} Upcoming Event{hackathons.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
              <span className="text-gray-600 font-medium">Loading hackathons...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 text-center max-w-2xl mx-auto">
            <p className="font-semibold mb-1">Error Loading Hackathons</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Hackathons Grid */}
        {!loading && !error && (
          <>
            {hackathons.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg font-medium">No hackathons found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {hackathons.map((hackathon) => (
                  <div
                    key={hackathon.id}
                    onClick={() => handleCardClick(hackathon.id)}
                    className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 border border-gray-100 overflow-hidden"
                  >
                    {/* Card Header with Gradient */}
                    <div className="h-32 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/10"></div>
                      {hackathon.logo && (
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                          <img
                            src={hackathon.logo}
                            alt={hackathon.name}
                            className="h-20 w-auto object-contain filter drop-shadow-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {!hackathon.logo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-white text-4xl font-bold opacity-30">
                            {hackathon.name?.charAt(0) || 'H'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-5">
                      {/* Name */}
                      <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors min-h-[3.5rem]">
                        {hackathon.name || 'Hackathon Event'}
                      </h3>

                      {/* Location */}
                      <div className="mb-3 flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">📍</span>
                        <span className="text-sm text-gray-600 flex-1">{hackathon.location || 'Location TBD'}</span>
                      </div>

                      {/* Dates */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Event Dates</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDateRange(hackathon.start_date, hackathon.end_date)}
                        </p>
                      </div>

                      {/* Type Badge */}
                      {hackathon.type && (
                        <div className="mb-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(hackathon.type)}`}>
                            {hackathon.type}
                          </span>
                        </div>
                      )}

                      {/* Description (if available) */}
                      {hackathon.description && (
                        <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                          {hackathon.description}
                        </p>
                      )}

                      {/* Click indicator */}
                      <div className="pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                            Find Teammates
                          </span>
                          <span className="text-blue-600 group-hover:translate-x-1 transition-transform">
                            →
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HackathonList;
