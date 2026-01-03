import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserCard from '../components/UserCard';

const MatchingPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [requestCount, setRequestCount] = useState(0);
  const MAX_REQUESTS = 5;

  const API_BASE_URL = 'http://localhost:3000';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/users`);
      setUsers(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load user profiles. Please make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId) => {
    if (requestCount >= MAX_REQUESTS) {
      alert(`You've reached the maximum limit of ${MAX_REQUESTS} requests.`);
      return;
    }

    if (sentRequests.has(userId)) {
      return;
    }

    try {
      // For now, using a placeholder user ID - in production, get from auth
      const from_user_id = 'current_user_id_placeholder';
      
      await axios.post(`${API_BASE_URL}/request`, {
        from_user_id: from_user_id,
        to_user_id: userId
      });

      // Update local state
      const newSentRequests = new Set(sentRequests);
      newSentRequests.add(userId);
      setSentRequests(newSentRequests);
      setRequestCount(requestCount + 1);
    } catch (err) {
      console.error('Error sending request:', err);
      const errorMessage = err.response?.data?.error || 'Failed to send request. Please try again.';
      alert(errorMessage);
    }
  };

  const canSendRequest = requestCount < MAX_REQUESTS;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Hackathon Team
          </h1>
          <p className="text-gray-600 mb-4">
            Discover teammates with complementary skills
          </p>
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                Requests Sent: {requestCount} / {MAX_REQUESTS}
              </span>
            </div>
            {requestCount >= MAX_REQUESTS && (
              <span className="text-sm text-red-600 font-medium">
                Maximum requests reached
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Loading profiles...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Users Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                matchScore={user.matchCategory || 'okay'}
                onSendRequest={handleSendRequest}
                isRequestSent={sentRequests.has(user._id)}
                canSendRequest={canSendRequest}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && users.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingPage;

