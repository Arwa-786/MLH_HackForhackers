import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

export default function MatchingPage() {
  const { hackathonId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filters, setFilters] = useState({
    location: '',
    school: '',
    skills: '',
  });
  const [activeFilter, setActiveFilter] = useState('All');
  const [requestsSent, setRequestsSent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requestMessage, setRequestMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, users]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:3000/users');
      setUsers(response.data);
      setFilteredUsers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = users;

    if (filters.location) {
      filtered = filtered.filter(user => 
        user.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    if (filters.school) {
      filtered = filtered.filter(user => 
        user.school?.toLowerCase().includes(filters.school.toLowerCase())
      );
    }

    if (filters.skills) {
      filtered = filtered.filter(user => 
        user.skills?.some(skill => 
          skill.toLowerCase().includes(filters.skills.toLowerCase())
        )
      );
    }

    setFilteredUsers(filtered);
  };

  const handleRequestClick = (userId) => {
    if (requestsSent >= 5) {
      alert('Maximum 5 requests allowed');
      return;
    }
    setSelectedUserId(userId);
    setShowMessageModal(true);
  };

  const sendRequest = async () => {
    if (!selectedUserId) return;

    try {
      await axios.post('http://localhost:3000/request', {
        from_user_id: 'current-user-id',
        to_user_id: selectedUserId,
        message: requestMessage || 'Hello, I would like to team up with you for the hackathon!'
      });
      setRequestsSent(prev => prev + 1);
      setShowMessageModal(false);
      setRequestMessage('');
      setSelectedUserId(null);
      alert('Request sent successfully!');
    } catch (error) {
      alert('Error sending request: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/20 border-t-[#3b82f6] mb-4"></div>
          <p className="text-white/60 font-medium">Loading teammates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-8 flex items-center text-white/80 hover:text-[#3b82f6] font-medium transition-colors duration-200 group"
        >
          <span className="mr-2 group-hover:-translate-x-1 transition-transform duration-200">←</span>
          Back to Hackathons
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 text-white tracking-tight">Find Teammates</h1>
          <div className="flex items-center gap-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg px-4 py-2">
              <p className="text-white/80 text-sm font-medium">
                Requests sent: <span className="text-[#3b82f6] font-semibold">{requestsSent}/5</span>
              </p>
            </div>
          </div>
        </div>

        {/* LinkedIn-style Filter Pills with MLH Colors */}
        <div className="mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {/* Hide scrollbar but keep functionality */}
            <style>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
              .scrollbar-hide {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            
            {['All', 'Frontend', 'Backend', 'Full Stack', 'Mobile', 'AI/ML', 'DevOps', 'Design'].map((filter, index) => {
              // MLH color cycle: Red, Blue, Yellow
              const mlhColors = [
                { bg: 'bg-red-500', hover: 'hover:bg-red-600', shadow: 'shadow-red-500/30', text: 'text-white' },
                { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', shadow: 'shadow-blue-500/30', text: 'text-white' },
                { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', shadow: 'shadow-yellow-500/30', text: 'text-gray-900' }
              ];
              const colorIndex = index % 3;
              const mlhColor = mlhColors[colorIndex];
              
              return (
                <button
                  key={filter}
                  onClick={() => {
                    setActiveFilter(filter);
                    if (filter === 'All') {
                      setFilters({ location: '', school: '', skills: '' });
                    } else {
                      setFilters({ ...filters, skills: filter });
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    activeFilter === filter
                      ? `${mlhColor.bg} ${mlhColor.text} shadow-lg ${mlhColor.shadow} scale-105`
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {filter}
                </button>
              );
            })}
            
            {/* Separator */}
            <div className="h-6 w-px bg-white/20 mx-2"></div>
            
            {/* All Filters Button */}
            <button className="px-4 py-2 rounded-full text-sm font-medium text-white/70 hover:bg-white/10 border border-white/10 transition-all duration-200 whitespace-nowrap">
              All filters
            </button>
          </div>
        </div>

        {/* Search Filters - Glassmorphism Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 mb-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-4 text-white">Search Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Location (e.g., Orlando, FL)"
              value={filters.location}
              onChange={(e) => {
                setFilters({...filters, location: e.target.value});
                setActiveFilter('All');
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
            />
            <input
              type="text"
              placeholder="School (e.g., UCF)"
              value={filters.school}
              onChange={(e) => {
                setFilters({...filters, school: e.target.value});
                setActiveFilter('All');
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
            />
            <input
              type="text"
              placeholder="Skills (e.g., React)"
              value={filters.skills}
              onChange={(e) => {
                setFilters({...filters, skills: e.target.value});
                setActiveFilter('All');
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
            />
          </div>
        </div>

        {/* User Cards - Glassmorphism Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-white/60 text-lg font-medium">No teammates found matching your filters</p>
            </div>
          ) : (
            filteredUsers.map(user => (
              <div 
                key={user._id} 
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-xl hover:shadow-2xl group"
              >
                <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#3b82f6] transition-colors duration-200">
                  {user.name}
                </h3>
                
                <div className="space-y-2 mb-4">
                  {user.school && (
                    <p className="text-white/70 text-sm flex items-center">
                      <span className="mr-2">🏫</span>
                      {user.school}
                    </p>
                  )}
                  {user.location && (
                    <p className="text-white/70 text-sm flex items-center">
                      <span className="mr-2">📍</span>
                      {user.location}
                    </p>
                  )}
                </div>
                
                {user.skills && user.skills.length > 0 && (
                  <div className="mb-6">
                    <p className="font-semibold text-sm mb-3 text-white/90">Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {user.skills.map((skill, i) => (
                        <span 
                          key={i} 
                          className="bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#3b82f6] px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {user.tech_stack && user.tech_stack.length > 0 && (
                  <div className="mb-6">
                    <p className="font-semibold text-sm mb-3 text-white/90">Tech Stack:</p>
                    <div className="flex flex-wrap gap-2">
                      {user.tech_stack.map((tech, i) => (
                        <span 
                          key={i} 
                          className="bg-purple-500/20 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleRequestClick(user._id)}
                  disabled={requestsSent >= 5}
                  className="w-full bg-gradient-to-r from-[#3b82f6] to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-[#3b82f6]/50 disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {requestsSent >= 5 ? 'Request Limit Reached' : 'Send Request'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Message Modal */}
        {showMessageModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Send Team Request</h3>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Enter your message (optional)..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 mb-4 min-h-[100px] resize-none"
                rows={4}
              />
              <div className="flex gap-3">
                <button
                  onClick={sendRequest}
                  className="flex-1 bg-gradient-to-r from-[#3b82f6] to-blue-600 text-white py-2 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-700 transition-all duration-200"
                >
                  Send Request
                </button>
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setRequestMessage('');
                    setSelectedUserId(null);
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
