import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import HackathonCard from '../components/HackathonCard';
import GroupsPanel from '../components/GroupsPanel';
import ChatPanel from '../components/ChatPanel';
import AIMentorPanel from '../components/AIMentorPanel';

const HackathonList = () => {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [selectedHackathon, setSelectedHackathon] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showAIMentor, setShowAIMentor] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const navigate = useNavigate();
  const CURRENT_USER_ID = '6958c084d6d4ea1f109dad70'; // Hardcoded current user ID

  useEffect(() => {
    fetchHackathons();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/users/${CURRENT_USER_ID}`);
      setCurrentUser(response.data);
      setCurrentUserName(response.data?.name || 'User');
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const handleSelectTeam = (team) => {
    setSelectedTeam(team);
    setShowChat(true);
    setShowGroupsPanel(false);
  };

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

  const handleCardClick = async (hackathon) => {
    const hackathonId = hackathon.id || hackathon._id;
    
    // Check if user is registered for this hackathon
    const isRegistered = currentUser?.registered_hackathons?.includes(hackathonId);
    
    if (!isRegistered) {
      // Show registration modal
      setSelectedHackathon(hackathon);
      setShowRegistrationModal(true);
    } else {
      // User is registered, navigate to matching page
      navigate(`/matching/${hackathonId}`);
    }
  };

  const handleRegisterConfirm = async () => {
    if (!selectedHackathon) return;
    
    // Open MLH events page in new tab
    window.open('https://mlh.io/seasons/2026/events', '_blank');
    
    const hackathonId = selectedHackathon.id || selectedHackathon._id;
    
    try {
      // Add hackathon to user's registered_hackathons
      const updatedHackathons = [...(currentUser?.registered_hackathons || []), hackathonId];
      
      await axios.put(`http://localhost:3000/api/users/${CURRENT_USER_ID}`, {
        userData: currentUser,
        selectedHackathons: updatedHackathons
      });
      
      // Update local state
      setCurrentUser(prev => ({
        ...prev,
        registered_hackathons: updatedHackathons
      }));
      setShowRegistrationModal(false);
      setSelectedHackathon(null);
      
      // Navigate to matching page
      navigate(`/matching/${hackathonId}`);
    } catch (err) {
      console.error('Error registering for hackathon:', err);
      alert('Failed to register for hackathon. Please try again.');
    }
  };

  const handleAlreadyRegistered = () => {
    if (!selectedHackathon) return;
    const hackathonId = selectedHackathon.id || selectedHackathon._id;
    setShowRegistrationModal(false);
    setSelectedHackathon(null);
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
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Green glow effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#39ff14]/5 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#39ff14]/5 rounded-full blur-3xl"></div>
      </div>

      {/* Groups Button - Top left, disappears when panel is open */}
      {!showGroupsPanel && (
        <button
          onClick={() => setShowGroupsPanel(true)}
          className="fixed left-4 top-4 z-40 code-bg p-3 border-2 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all pixel-text font-bold text-sm rounded-lg shadow-lg"
          title="View Groups"
        >
          <div className="flex flex-col items-center gap-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span className="text-xs">GROUPS</span>
          </div>
        </button>
      )}
      
      {/* Profile Menu - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="code-bg px-4 py-2 flex items-center gap-2 hover:bg-black/70 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-[#39ff14] flex items-center justify-center text-black font-bold pixel-text">
              {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-[#39ff14] pixel-text text-xs font-bold">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[#39ff14]">▼</span>
          </button>
          
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 code-bg min-w-[200px] border-2 border-[#39ff14]/50">
              <button
                onClick={() => {
                  navigate('/');
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-[#39ff14]/20 hover:text-[#39ff14] transition-all pixel-text text-xs"
              >
                UPDATE_PROFILE()
              </button>
              <button
                onClick={() => {
                  // Logout logic - for now just navigate to landing
                  navigate('/');
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-white hover:bg-[#39ff14]/20 hover:text-[#39ff14] transition-all pixel-text text-xs border-t-2 border-[#39ff14]/30"
              >
                LOGOUT()
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className={`max-w-7xl mx-auto py-12 px-4 relative z-10 transition-all duration-300 ${showGroupsPanel ? 'ml-80' : ''} ${showAIMentor ? 'mr-96' : ''} ${showChat ? 'opacity-0 pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-left mb-4 text-[#39ff14] text-sm pixel-text">
            BROWSE_HACKATHONS()
          </div>
          <h1 className="text-6xl font-bold mb-6 text-white pixel-text code-glow">
            MLH HACKATHONS
            <br />
            2026
          </h1>
          <p className="text-lg text-white/80 mb-4 pixel-text">
            FROM EVENTS TO TEAMMATES.
            <br />
            EVERYTHING YOU NEED TO BUILD
            <br />
            YOUR NEXT HACKATHON TEAM.
          </p>
          {!loading && !error && (
            <div className="inline-flex items-center gap-2 code-bg px-4 py-2 border-2 border-[#39ff14]/50">
              <span className="text-sm font-bold text-[#39ff14] pixel-text">
                EVENTS: {hackathons.length}
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center code-bg p-12">
              <div className="text-[#39ff14] text-sm mb-4 pixel-text">LOADING...</div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#39ff14]/20 border-t-[#39ff14] mb-4 code-glow"></div>
              <span className="text-white/80 font-bold pixel-text">LOADING_HACKATHONS()</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/30 border-2 border-red-500 text-red-400 px-6 py-4 mb-6 text-center max-w-2xl mx-auto pixel-text">
            <p className="font-bold mb-1">ERROR: LOADING_FAILED</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Hackathons Grid */}
        {!loading && !error && (
          <>
            {hackathons.length === 0 ? (
              <div className="text-center py-20 code-bg">
                <p className="text-white/80 text-lg font-bold pixel-text">NO_HACKATHONS_FOUND</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {hackathons.map((hackathon) => {
                  const hackathonId = hackathon.id || hackathon._id;
                  const isRegistered = currentUser?.registered_hackathons?.includes(hackathonId);
                  
                  return (
                    <HackathonCard
                      key={hackathonId}
                      hackathon={hackathon}
                      onClick={() => handleCardClick(hackathon)}
                      isRegistered={isRegistered}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Registration Modal */}
      {showRegistrationModal && selectedHackathon && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="code-bg p-8 max-w-md w-full border-2 border-[#39ff14]">
            <div className="text-[#39ff14] text-sm mb-4 pixel-text">REGISTRATION_REQUIRED</div>
            <h2 className="text-2xl font-bold text-white mb-4 pixel-text code-glow">
              REGISTER FOR HACKATHON
            </h2>
            <p className="text-white/80 mb-6 pixel-text text-sm">
              You haven't registered for <span className="text-[#39ff14] font-bold">{selectedHackathon.name}</span>.
              <br />
              <br />
              Would you like to register now, or have you already registered?
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRegisterConfirm}
                className="w-full bg-[#39ff14] text-black py-3 border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 pixel-text"
              >
                REGISTER_NOW()
              </button>
              <button
                onClick={handleAlreadyRegistered}
                className="w-full bg-transparent border-2 border-[#39ff14]/50 text-white hover:border-[#39ff14] hover:text-[#39ff14] py-3 font-bold transition-all duration-200 pixel-text"
              >
                I_ALREADY_REGISTERED()
              </button>
              <button
                onClick={() => {
                  setShowRegistrationModal(false);
                  setSelectedHackathon(null);
                }}
                className="w-full bg-transparent border-2 border-[#39ff14]/30 text-white/70 hover:border-[#39ff14]/50 hover:text-white py-2 font-bold transition-all duration-200 pixel-text text-xs"
              >
                BACK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups Panel */}
      {showGroupsPanel && (
        <GroupsPanel
          currentUserId={CURRENT_USER_ID}
          onSelectTeam={handleSelectTeam}
          selectedTeamId={selectedTeam?._id}
          onClose={() => setShowGroupsPanel(false)}
        />
      )}

      {/* Chat Panel */}
      {showChat && selectedTeam && (
        <ChatPanel
          team={selectedTeam}
          currentUserId={CURRENT_USER_ID}
          currentUserName={currentUserName}
          onClose={() => {
            setShowChat(false);
            setSelectedTeam(null);
          }}
        />
      )}
    </div>
  );
};

export default HackathonList;
