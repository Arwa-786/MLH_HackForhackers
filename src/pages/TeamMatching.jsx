import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserCard from '../components/UserCard';

const TeamMatching = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [requestCount, setRequestCount] = useState(0);
  const MAX_REQUESTS = 5;

  // API endpoint - update this to match your backend
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    fetchUsers();
    // Load sent requests from localStorage on mount
    const savedRequests = localStorage.getItem('sentRequests');
    const savedCount = localStorage.getItem('requestCount');
    if (savedRequests) {
      setSentRequests(new Set(JSON.parse(savedRequests)));
    }
    if (savedCount) {
      setRequestCount(parseInt(savedCount, 10));
    }
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Replace with your actual API endpoint
      const response = await axios.get(`${API_BASE_URL}/users`);
      
      // Generate match scores for each user (AI-generated simulation)
      const usersWithScores = response.data.map(user => ({
        ...user,
        matchScore: generateMatchScore(user)
      }));
      
      setUsers(usersWithScores);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load user profiles. Please try again later.');
      // For development: use mock data if API fails
      if (err.code === 'ERR_NETWORK' || err.message.includes('Network')) {
        setUsers(getMockUsers());
      }
    } finally {
      setLoading(false);
    }
  };

  // Simulate AI-generated match score
  // In production, this would come from your backend/AI service
  const generateMatchScore = (user) => {
    const scores = ['strong', 'good', 'okay', 'bad'];
    // Simple simulation - in production, use actual AI matching logic
    const randomScore = scores[Math.floor(Math.random() * scores.length)];
    return randomScore;
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
      // Replace with your actual API endpoint
      await axios.post(`${API_BASE_URL}/requests`, {
        targetUserId: userId
      });

      // Update local state
      const newSentRequests = new Set(sentRequests);
      newSentRequests.add(userId);
      setSentRequests(newSentRequests);
      setRequestCount(requestCount + 1);

      // Save to localStorage
      localStorage.setItem('sentRequests', JSON.stringify(Array.from(newSentRequests)));
      localStorage.setItem('requestCount', (requestCount + 1).toString());
    } catch (err) {
      console.error('Error sending request:', err);
      alert('Failed to send request. Please try again.');
    }
  };

  // Mock data for development (remove in production)
  const getMockUsers = () => {
    return [
      {
        _id: '1',
        name: 'Alex Johnson',
        school: 'MIT',
        skills: ['React', 'Node.js', 'Python', 'Machine Learning'],
        github: 'https://github.com/alexjohnson'
      },
      {
        _id: '2',
        name: 'Sarah Chen',
        school: 'Stanford University',
        skills: ['JavaScript', 'TypeScript', 'AWS', 'Docker'],
        github: 'sarahchen'
      },
      {
        _id: '3',
        name: 'Michael Rodriguez',
        school: 'UC Berkeley',
        skills: ['Python', 'Django', 'PostgreSQL', 'Redis'],
        github: 'https://github.com/mrodriguez'
      },
      {
        _id: '4',
        name: 'Emily Davis',
        school: 'Harvard University',
        skills: ['React', 'GraphQL', 'MongoDB', 'Express'],
        github: 'emilydavis'
      },
      {
        _id: '5',
        name: 'David Kim',
        school: 'Carnegie Mellon',
        skills: ['C++', 'Java', 'Kubernetes', 'Microservices'],
        github: 'https://github.com/davidkim'
      }
    ].map(user => ({
      ...user,
      matchScore: generateMatchScore(user)
    }));
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
          <p className="text-gray-600">
            Discover teammates with complementary skills
          </p>
          <div className="mt-4 flex items-center gap-4">
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
                matchScore={user.matchScore}
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

export default TeamMatching;

