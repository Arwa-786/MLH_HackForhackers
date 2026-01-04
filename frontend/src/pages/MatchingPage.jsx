import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import ChatPanel from '../components/ChatPanel';
import GroupsPanel from '../components/GroupsPanel';
import AIMentorPanel from '../components/AIMentorPanel';
import RequestsPanel from '../components/RequestsPanel';

export default function MatchingPage() {
  const { hackathonId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filters, setFilters] = useState({
    location: '',
    school: '',
    skills: '',
    roles: [],
    techStack: [],
  });
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedTechStack, setSelectedTechStack] = useState([]);
  const [requestsSent, setRequestsSent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requestMessage, setRequestMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const CURRENT_USER_ID = '6958c084d6d4ea1f109dad70'; // Hardcoded current user ID
  const [team, setTeam] = useState(null);
  const [neededRoles, setNeededRoles] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [calculatingScores, setCalculatingScores] = useState(new Set());
  const [showChat, setShowChat] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showAIMentor, setShowAIMentor] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [hackathons, setHackathons] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchTeam();
    fetchCurrentUser();
    fetchIncomingRequests();
    fetchHackathons();
  }, [hackathonId]); // Re-fetch when hackathonId changes

  const fetchIncomingRequests = async () => {
    try {
      console.log('📥 [REQUESTS] Fetching incoming requests for user:', CURRENT_USER_ID);
      const response = await axios.get(`http://localhost:3000/api/requests/incoming/${CURRENT_USER_ID}`);
      console.log('✅ [REQUESTS] Incoming requests response:', response.data);
      console.log('✅ [REQUESTS] Response length:', response.data?.length || 0);
      setIncomingRequests(response.data || []);
      console.log('📊 [REQUESTS] Set incomingRequests state:', response.data?.length || 0, 'requests');
    } catch (error) {
      console.error('❌ [REQUESTS] Error fetching incoming requests:', error);
      console.error('❌ [REQUESTS] Error response:', error.response?.data);
      console.error('❌ [REQUESTS] Error message:', error.message);
      setIncomingRequests([]);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      console.log('🎉 [ACCEPT] Accepting request:', requestId);
      const response = await axios.post(`http://localhost:3000/requests/${requestId}/accept`, {
        current_user_id: CURRENT_USER_ID
      });
      
      console.log('✅ [ACCEPT] Request accepted, response:', response.data);
      
      // Trigger confetti effect immediately
      const triggerConfetti = () => {
        if (typeof window !== 'undefined' && window.confetti) {
          window.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } else {
          // Fallback: Create simple confetti effect
          const colors = ['#39ff14', '#00ff00', '#00ff88'];
          for (let i = 0; i < 50; i++) {
            setTimeout(() => {
              const confetti = document.createElement('div');
              confetti.style.position = 'fixed';
              confetti.style.left = Math.random() * 100 + '%';
              confetti.style.top = '-10px';
              confetti.style.width = '10px';
              confetti.style.height = '10px';
              confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
              confetti.style.zIndex = '9999';
              confetti.style.pointerEvents = 'none';
              confetti.style.borderRadius = '50%';
              document.body.appendChild(confetti);
              
              const animation = confetti.animate([
                { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                { transform: `translateY(${window.innerHeight + 100}px) rotate(720deg)`, opacity: 0 }
              ], {
                duration: 3000,
                easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
              });
              
              animation.onfinish = () => confetti.remove();
            }, i * 20);
          }
        }
      };
      
      // Trigger confetti immediately
      triggerConfetti();
      
      // Close requests panel first
      setShowRequestsPanel(false);
      setShowRequestsModal(false);
      
      // Refresh team and requests
      try {
        await fetchTeam();
        await fetchIncomingRequests();
      } catch (fetchError) {
        console.error('⚠️ [ACCEPT] Error refreshing data:', fetchError);
        // Don't block the flow if refresh fails
      }
      
      // Open groups panel and select the new team
      if (response.data && response.data.team) {
        console.log('🎉 [ACCEPT] Opening team chat for team:', response.data.team);
        setSelectedTeam(response.data.team);
        setShowGroupsPanel(true);
        setShowChat(true);
      } else {
        // If team not in response, fetch it
        console.log('⚠️ [ACCEPT] Team not in response, fetching...');
        await fetchTeam();
        if (team) {
          setSelectedTeam(team);
          setShowGroupsPanel(true);
          setShowChat(true);
        }
      }
      
    } catch (error) {
      console.error('❌ [ACCEPT] Error accepting request:', error);
      console.error('❌ [ACCEPT] Error response:', error.response?.data);
      console.error('❌ [ACCEPT] Error message:', error.message);
      
      // Show user-friendly error message
      const errorMessage = error.response?.data?.error || error.message || 'Failed to accept request';
      alert(`Error accepting request: ${errorMessage}`);
      
      // Still refresh to show updated state
      try {
        await fetchIncomingRequests();
        await fetchTeam();
      } catch (refreshError) {
        console.error('⚠️ [ACCEPT] Error refreshing after failure:', refreshError);
      }
    }
  };

  const handleSelectTeam = (team) => {
    setSelectedTeam(team);
    setShowChat(true);
    setShowGroupsPanel(false);
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/users/${CURRENT_USER_ID}`);
      setCurrentUserName(response.data?.name || 'User');
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const fetchHackathons = async () => {
    try {
      const response = await axios.get('http://localhost:3000/hackathons');
      setHackathons(response.data || []);
    } catch (err) {
      console.error('Error fetching hackathons:', err);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      // TODO: Implement decline endpoint if needed
      // For now, just refresh the requests
      await fetchIncomingRequests();
    } catch (error) {
      console.error('Error declining request:', error);
      alert('Error declining request: ' + (error.response?.data?.error || error.message));
    }
  };

  useEffect(() => {
    if (users.length > 0) {
      applyFilters();
    }
  }, [filters, users, selectedRoles, selectedTechStack]);

  useEffect(() => {
    if (users.length > 0) {
      calculateMatchScores();
    }
  }, [users.length, team]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching users for hackathon:', hackathonId);
      
      // Fetch users registered for this hackathon, excluding current user
      const response = await axios.get('http://localhost:3000/users', {
        params: { hackathonId: hackathonId || undefined }
      });
      
      const fetchedUsers = response.data || [];
      console.log(`✅ Fetched ${fetchedUsers.length} users`);
      
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      console.error('Error details:', error.response?.data || error.message);
      setUsers([]);
      setFilteredUsers([]);
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/team/${CURRENT_USER_ID}`);
      if (response.data.team) {
        setTeam(response.data.team);
        setNeededRoles(response.data.needed_roles || []);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const calculateMatchScores = async () => {
    if (users.length === 0) return;

    const teamMemberIds = team?.members || [];
    const calculating = new Set();

    // Calculate scores for all users (current user is hardcoded)
    const scorePromises = users
      .filter(user => user._id !== CURRENT_USER_ID)
      .map(async (user) => {
        calculating.add(user._id);
        setCalculatingScores(new Set(calculating));

        try {
          const response = await axios.post('http://localhost:3000/match-score', {
            user1_id: CURRENT_USER_ID,
            user2_id: user._id,
            team_member_ids: teamMemberIds,
            hackathon_id: hackathonId
          });

          const matchData = response.data;
          setMatchScores(prev => ({ ...prev, [user._id]: matchData }));
          return { userId: user._id, data: matchData };
        } catch (error) {
          console.error(`Error calculating score for ${user._id}:`, error);
          const fallbackData = {
            score: 50,
            reason: 'Score calculation failed',
            category: 'Good Match'
          };
          setMatchScores(prev => ({ ...prev, [user._id]: fallbackData }));
          return { userId: user._id, data: fallbackData };
        } finally {
          calculating.delete(user._id);
          setCalculatingScores(new Set(calculating));
        }
      });

    await Promise.all(scorePromises);
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

    if (selectedRoles.length > 0) {
      filtered = filtered.filter(user => 
        selectedRoles.some(role => 
          user.role_preference?.toLowerCase().includes(role.toLowerCase()) ||
          user.skills?.some(skill => skill.toLowerCase().includes(role.toLowerCase()))
        )
      );
    }

    if (selectedTechStack.length > 0) {
      filtered = filtered.filter(user => 
        selectedTechStack.some(tech => 
          user.tech_stack?.some(stack => 
            stack.toLowerCase().includes(tech.toLowerCase())
          )
        )
      );
    }

    setFilteredUsers(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedRoles, selectedTechStack, filters, users]);

  const handleCardClick = (user) => {
    setSelectedUser(user);
    setShowProfileModal(true);
  };

  const handleSendRequestFromModal = () => {
    if (!selectedUser) return;
    if (requestsSent >= 5) {
      alert('Maximum 5 requests allowed');
      return;
    }
    setSelectedUserId(selectedUser._id);
    setShowMessageModal(true);
    setShowProfileModal(false);
  };

  const sendRequest = async () => {
    if (!selectedUserId) return;

    try {
      await axios.post('http://localhost:3000/request', {
        from_user_id: CURRENT_USER_ID,
        to_user_id: selectedUserId,
        message: requestMessage || 'Hello, I would like to team up with you for the hackathon!',
        hackathon_id: hackathonId
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

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase().replace(' match', '')) {
      case 'strong':
        return 'bg-[#39ff14] text-black border-2 border-[#39ff14] code-glow';
      case 'good':
        return 'bg-[#39ff14]/50 text-[#39ff14] border-2 border-[#39ff14]/50';
      default:
        return 'bg-[#39ff14]/50 text-[#39ff14] border-2 border-[#39ff14]/50';
    }
  };

  const ScoreRing = ({ score, size = 80, isStrongMatch = false }) => {
    const circumference = 2 * Math.PI * (size / 2 - 6);
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 6}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="5"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 6}
            stroke="url(#gradient)"
            strokeWidth="5"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`transition-all duration-500 ${isStrongMatch ? 'code-glow' : ''}`}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#39ff14" />
              <stop offset="100%" stopColor="#39ff14" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold pixel-text ${isStrongMatch ? 'text-[#39ff14] code-glow' : 'text-white'}`}>
            {score}%
          </span>
        </div>
      </div>
    );
  };

  const Avatar = ({ name, size = 60 }) => {
    const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    return (
      <div 
        className="rounded-full bg-[#39ff14] flex items-center justify-center text-black font-bold pixel-text"
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    );
  };

  const ScoreSkeleton = () => (
    <div className="relative" style={{ width: 80, height: 80 }}>
      <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-pulse"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-4 bg-white/10 rounded animate-pulse"></div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex justify-center items-center">
        <div className="flex flex-col items-center code-bg p-12">
          <div className="text-[#39ff14] text-sm mb-4 pixel-text">// LOADING...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#39ff14]/20 border-t-[#39ff14] mb-4 code-glow"></div>
          <p className="text-white/80 font-bold pixel-text">LOADING_TEAMMATES()</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8 relative overflow-hidden">
      {/* Green glow effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#39ff14]/5 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#39ff14]/5 rounded-full blur-3xl"></div>
      </div>

      {/* Groups Button and Requests Button - Top left, disappears when panels are open */}
      {!showGroupsPanel && !showRequestsPanel && (
        <div className="fixed left-4 top-4 z-40 flex flex-col gap-3">
          <button
            onClick={() => setShowGroupsPanel(true)}
            className="code-bg p-3 border-2 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all pixel-text font-bold text-sm rounded-lg shadow-lg"
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
          
          {/* Requests Button - Below Groups */}
          <button
            onClick={() => {
              console.log('🔔 [REQUESTS] Button clicked!');
              console.log('📊 [REQUESTS] Current incomingRequests state:', incomingRequests);
              console.log('📊 [REQUESTS] incomingRequests.length:', incomingRequests.length);
              console.log('📊 [REQUESTS] Setting showRequestsPanel to true');
              setShowRequestsPanel(true);
              console.log('📊 [REQUESTS] Panel should now be visible');
            }}
            className="code-bg p-3 border-2 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all pixel-text font-bold text-sm rounded-lg shadow-lg relative"
            title="View Requests"
          >
            <div className="flex flex-col items-center gap-1 relative">
              {/* UserPlus Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              <span className="text-xs">REQUESTS</span>
              {/* Notification Badge - Red dot when there are pending requests */}
              {incomingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a0a0a] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Profile Menu - Top Right (only visible when chat is closed) */}
      {!showChat && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="code-bg px-4 py-2 border-2 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 transition-all pixel-text font-bold text-sm flex items-center gap-2"
          >
            <span>{currentUserName || 'USER'}</span>
            <span className="text-[#39ff14]">▼</span>
          </button>
          
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 code-bg min-w-[200px] border-2 border-[#39ff14]/50 z-50">
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
      )}

      <div className={`max-w-6xl mx-auto relative z-10 transition-all duration-300 ${showGroupsPanel || showRequestsPanel ? 'ml-[300px]' : ''} ${showAIMentor ? 'mr-96' : ''} ${showChat ? 'opacity-0 pointer-events-none' : ''}`}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/hackathons')}
          className="mb-8 flex items-center text-[#39ff14]/80 hover:text-[#39ff14] font-bold transition-colors duration-200 group pixel-text"
        >
          <span className="mr-2 group-hover:-translate-x-1 transition-transform duration-200">←</span>
          // BACK_TO_HACKATHONS()
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="text-[#39ff14] text-sm mb-4 pixel-text">// FIND_TEAMMATES()</div>
          <h1 className="text-5xl font-bold mb-6 text-white pixel-text code-glow">
            FIND YOUR
            <br />
            PERFECT TEAM
          </h1>
          <div className="flex items-center gap-4">
            <div className="code-bg px-4 py-2 border-2 border-[#39ff14]/50">
              <p className="text-white/80 text-sm font-bold pixel-text">
                // REQUESTS: <span className="text-[#39ff14]">{requestsSent}/5</span>
              </p>
            </div>
            <button
              onClick={() => {
                console.log('🔔 INCOMING_REQUESTS button clicked');
                console.log('📊 Current incomingRequests state:', incomingRequests);
                setShowRequestsModal(true);
              }}
              className="code-bg px-4 py-2 border-2 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 transition-all pixel-text font-bold text-sm relative"
            >
              INCOMING_REQUESTS()
              <span className={`absolute -top-1 -right-1 text-black text-xs px-2 py-0.5 rounded-full font-bold ${
                incomingRequests.length > 0 ? 'bg-[#39ff14]' : 'bg-white/20 text-white/60'
              }`}>
                {incomingRequests.length}
              </span>
            </button>
            {team && (
              <div className="code-bg px-4 py-2 border-2 border-[#39ff14]/50">
                <p className="text-white/80 text-sm font-bold pixel-text">
                  // TEAM_MEMBERS: <span className="text-[#39ff14]">{team.members.length}/4</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Your Team Needs Section */}
        {neededRoles.length > 0 && (
          <div className="mb-8 code-bg p-6 border-2 border-[#39ff14]/50">
            <h2 className="text-xl font-bold text-white mb-3 pixel-text code-glow">// TEAM_NEEDS:</h2>
            <div className="flex flex-wrap gap-2">
              {neededRoles.map((role, i) => (
                <span
                  key={i}
                  className="px-4 py-2 bg-[#39ff14]/20 border border-[#39ff14]/30 text-[#39ff14] rounded-full text-sm font-bold pixel-text"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Left Sidebar - Filters */}
          <div className="w-80 flex-shrink-0">
            <div className="code-bg p-6 border-2 border-[#39ff14]/50 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white pixel-text code-glow">// FILTERS()</h2>
              </div>
              
              {/* Role Filters */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#39ff14] mb-3 pixel-text">// ROLE:</h3>
                <div className="space-y-2">
                  {['Frontend', 'Backend', 'Full Stack', 'Mobile', 'AI/ML', 'DevOps', 'Design'].map((role) => (
                    <label
                      key={role}
                      className="flex items-center cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles([...selectedRoles, role]);
                          } else {
                            setSelectedRoles(selectedRoles.filter(r => r !== role));
                          }
                        }}
                        className="w-4 h-4 rounded border-[#39ff14]/50 bg-black/50 text-[#39ff14] focus:ring-2 focus:ring-[#39ff14]/50 cursor-pointer"
                      />
                      <span className="ml-3 text-sm text-white/70 group-hover:text-[#39ff14] transition-colors pixel-text">
                        {role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tech Stack Filters */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#39ff14] mb-3 pixel-text">// TECH_STACK:</h3>
                <div className="flex flex-wrap gap-2">
                  {['React', 'Node.js', 'Python', 'JavaScript', 'TypeScript', 'Vue', 'Angular', 'Flutter', 'Swift', 'Kotlin'].map((tech) => (
                    <button
                      key={tech}
                      onClick={() => {
                        if (selectedTechStack.includes(tech)) {
                          setSelectedTechStack(selectedTechStack.filter(t => t !== tech));
                        } else {
                          setSelectedTechStack([...selectedTechStack, tech]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 pixel-text ${
                        selectedTechStack.includes(tech)
                          ? 'bg-[#39ff14] text-black shadow-lg shadow-[#39ff14]/30'
                          : 'bg-black/50 text-[#39ff14]/70 hover:bg-[#39ff14]/10 border border-[#39ff14]/50'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              {/* School Filter */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#39ff14] mb-3 pixel-text">// SCHOOL:</h3>
                <input
                  type="text"
                  placeholder="SEARCH_SCHOOL()..."
                  value={filters.school}
                  onChange={(e) => setFilters({...filters, school: e.target.value})}
                  className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 text-sm pixel-text"
                />
              </div>

              {/* Location Filter */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#39ff14] mb-3 pixel-text">// LOCATION:</h3>
                <input
                  type="text"
                  placeholder="SEARCH_LOCATION()..."
                  value={filters.location}
                  onChange={(e) => setFilters({...filters, location: e.target.value})}
                  className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 text-sm pixel-text"
                />
              </div>

              {/* Skills Filter */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#39ff14] mb-3 pixel-text">// SKILLS:</h3>
                <input
                  type="text"
                  placeholder="SEARCH_SKILLS()..."
                  value={filters.skills}
                  onChange={(e) => setFilters({...filters, skills: e.target.value})}
                  className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 text-sm pixel-text"
                />
              </div>

              {/* Clear Filters */}
              {(selectedRoles.length > 0 || selectedTechStack.length > 0 || filters.school || filters.location || filters.skills) && (
                <button
                  onClick={() => {
                    setSelectedRoles([]);
                    setSelectedTechStack([]);
                    setFilters({ location: '', school: '', skills: '', roles: [], techStack: [] });
                  }}
                  className="w-full px-4 py-2 bg-black/50 border-2 border-[#39ff14]/50 text-white/70 rounded-lg hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all duration-200 text-sm font-bold pixel-text"
                >
                  CLEAR_FILTERS()
                </button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* LinkedIn-style Horizontal Cards List */}
        <div className="code-bg border-2 border-[#39ff14]/50 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60 text-lg font-bold pixel-text">// NO_TEAMMATES_FOUND</p>
            </div>
          ) : (
            filteredUsers
              .filter(user => user._id !== CURRENT_USER_ID)
              .sort((a, b) => {
                const scoreA = matchScores[a._id]?.score || 0;
                const scoreB = matchScores[b._id]?.score || 0;
                return scoreB - scoreA;
              })
              .map((user, index) => {
                const matchData = matchScores[user._id];
                const isCalculating = calculatingScores.has(user._id);
                const score = matchData?.score || 0;
                const isStrongMatch = score >= 85;
                const topTechStack = (user.tech_stack || []).slice(0, 3);
                const bio = user.description || `${user.skills?.slice(0, 3).join(', ') || 'Developer'} with experience in ${user.experience?.slice(0, 2).join(' and ') || 'hackathons'}`;
                const bioPreview = bio.length > 100 ? bio.substring(0, 100) + '...' : bio;

                return (
                  <div
                    key={user._id}
                    onClick={() => handleCardClick(user)}
                    className={`flex items-center gap-6 p-6 hover:bg-black/20 transition-all duration-200 cursor-pointer ${
                      index < filteredUsers.length - 1 ? 'border-b-2 border-[#39ff14]/30' : ''
                    }`}
                  >
                    {/* Left: Avatar and Name */}
                    <div className="flex-shrink-0">
                      <Avatar name={user.name} size={80} />
                    </div>

                    {/* Middle: Name/School/Location (top), Bio (middle), Tech Stack (bottom) */}
                    <div className="flex-1 min-w-0">
                      {/* Top: Name, School, Location */}
                      <div className="mb-3">
                        <h3 className="text-xl font-bold text-white mb-1 hover:text-[#39ff14] transition-colors pixel-text code-glow">
                          {user.name}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-white/60 pixel-text">
                          {user.school && (
                            <span className="flex items-center gap-1">
                              <span>🏫</span>
                              {user.school}
                            </span>
                          )}
                          {user.location && (
                            <span className="flex items-center gap-1">
                              <span>📍</span>
                              {user.location}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Middle: Bio Preview (2 lines) */}
                      <p className="text-white/70 text-sm mb-3 line-clamp-2 pixel-text">
                        {bioPreview}
                      </p>

                      {/* Bottom: Top 3 Tech Stack Pills */}
                      {topTechStack.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {topTechStack.map((tech, i) => (
                            <span
                              key={i}
                              className="bg-[#39ff14]/20 border border-[#39ff14]/30 text-[#39ff14] px-3 py-1 rounded-full text-xs font-bold pixel-text"
                            >
                              {tech}
                            </span>
                          ))}
                          {(user.tech_stack || []).length > 3 && (
                            <span className="text-white/50 text-xs px-2 py-1 pixel-text">...</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Score Ring and View Profile Button */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-4">
                      {isCalculating ? (
                        <ScoreSkeleton />
                      ) : (
                        <div className={isStrongMatch ? 'drop-shadow-[0_0_12px_rgba(57,255,20,0.5)]' : ''}>
                          <ScoreRing score={score} size={80} isStrongMatch={isStrongMatch} />
                        </div>
                      )}
                      
                      {matchData && (matchData.category === 'Strong Match' || matchData.category === 'Good Match') && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold pixel-text ${getCategoryColor(matchData.category)}`}>
                          {matchData.category}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(user);
                        }}
                        className="px-4 py-2 bg-black/50 border-2 border-[#39ff14]/50 text-white/70 rounded-lg hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all duration-200 text-sm font-bold pixel-text"
                      >
                        VIEW_PROFILE()
                      </button>
                    </div>
                  </div>
                );
              })
          )}
            </div>
          </div>
        </div>

        {/* Profile Modal */}
        {showProfileModal && selectedUser && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="code-bg p-8 max-w-2xl w-full border-2 border-[#39ff14] max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Avatar name={selectedUser.name} size={100} />
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1 pixel-text code-glow">{selectedUser.name}</h2>
                    {matchScores[selectedUser._id] && (matchScores[selectedUser._id].category === 'Strong Match' || matchScores[selectedUser._id].category === 'Good Match') && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold pixel-text ${getCategoryColor(matchScores[selectedUser._id].category)}`}>
                        {matchScores[selectedUser._id].category}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setSelectedUser(null);
                  }}
                  className="text-white/50 hover:text-[#39ff14] transition-colors text-xl font-bold pixel-text"
                >
                  X
                </button>
              </div>

              {/* Match Score */}
              {matchScores[selectedUser._id] && (
                <div className="mb-6 flex items-center gap-4">
                  <ScoreRing 
                    score={matchScores[selectedUser._id].score} 
                    size={100} 
                    isStrongMatch={matchScores[selectedUser._id].score >= 85}
                  />
                  <div className="flex-1">
                    <p className="text-white/80 text-sm mb-2">
                      {matchScores[selectedUser._id].reason}
                    </p>
                  </div>
                </div>
              )}

              {/* School and Location */}
              <div className="mb-6 space-y-2 pixel-text">
                {selectedUser.school && (
                  <p className="text-white/80 text-sm flex items-center">
                    <span className="text-[#39ff14] mr-2 pixel-text">// SCHOOL:</span>
                    {selectedUser.school}
                  </p>
                )}
                {selectedUser.location && (
                  <p className="text-white/80 text-sm flex items-center">
                    <span className="text-[#39ff14] mr-2 pixel-text">// LOCATION:</span>
                    {selectedUser.location}
                  </p>
                )}
              </div>

              {/* GitHub */}
              {selectedUser.github && (
                <div className="mb-6 pixel-text">
                  <p className="text-[#39ff14] font-bold mb-2 text-xs">// GITHUB:</p>
                  <a
                    href={selectedUser.github.startsWith('http') ? selectedUser.github : `https://github.com/${selectedUser.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#39ff14] hover:underline text-sm"
                  >
                    {selectedUser.github}
                  </a>
                </div>
              )}

              {/* Devpost */}
              {selectedUser.devpost && (
                <div className="mb-6 pixel-text">
                  <p className="text-[#39ff14] font-bold mb-2 text-xs">// DEVPOST:</p>
                  <a
                    href={selectedUser.devpost.startsWith('http') ? selectedUser.devpost : `https://devpost.com/${selectedUser.devpost}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#39ff14] hover:underline text-sm"
                  >
                    {selectedUser.devpost}
                  </a>
                </div>
              )}

              {/* Full Skills List */}
              {selectedUser.skills && selectedUser.skills.length > 0 && (
                <div className="mb-6">
                  <p className="text-[#39ff14] font-bold mb-2 text-xs pixel-text">// SKILLS:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="bg-[#39ff14]/20 border border-[#39ff14]/30 text-[#39ff14] px-3 py-1 rounded-full text-xs font-bold pixel-text"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Tech Stack */}
              {selectedUser.tech_stack && selectedUser.tech_stack.length > 0 && (
                <div className="mb-6">
                  <p className="text-[#39ff14] font-bold mb-2 text-xs pixel-text">// TECH_STACK:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.tech_stack.map((tech, i) => (
                      <span
                        key={i}
                        className="bg-[#39ff14]/20 border border-[#39ff14]/30 text-[#39ff14] px-3 py-1 rounded-full text-xs font-bold pixel-text"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Experience List */}
              {selectedUser.experience && selectedUser.experience.length > 0 && (
                <div className="mb-6">
                  <p className="text-[#39ff14] font-bold mb-2 text-xs pixel-text">// EXPERIENCE:</p>
                  <ul className="space-y-2">
                    {selectedUser.experience.map((exp, i) => (
                      <li key={i} className="text-white/80 text-sm flex items-start pixel-text">
                        <span className="mr-2 text-[#39ff14]">•</span>
                        <span>{exp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Personal Message and Send Request */}
              <div className="border-t-2 border-[#39ff14]/30 pt-6 mt-6">
                <label className="block text-[#39ff14] font-bold mb-2 pixel-text">// MESSAGE: STRING</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="ENTER_MESSAGE()..."
                  className="w-full bg-black/50 border-2 border-[#39ff14]/50 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 resize-none pixel-text mb-4 min-h-[120px]"
                  rows={5}
                />
                <button
                  onClick={handleSendRequestFromModal}
                  disabled={requestsSent >= 5}
                  className="w-full bg-[#39ff14] text-black py-3 border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed pixel-text"
                >
                  {requestsSent >= 5 ? '// REQUEST_LIMIT_REACHED' : 'SEND_REQUEST()'}
                </button>
              </div>
              <div className="mt-4 text-right text-xs text-white/50 pixel-text">
                {'}'} // PROFILE_VIEW
              </div>
            </div>
          </div>
        )}

        {/* Message Modal (for quick send without opening profile) */}
        {showMessageModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="code-bg p-8 max-w-md w-full border-2 border-[#39ff14]">
              <div className="text-[#39ff14] text-sm mb-4 pixel-text">// CONFIRM_REQUEST</div>
              <h3 className="text-2xl font-bold text-white mb-4 pixel-text code-glow">SEND MESSAGE</h3>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="ENTER_MESSAGE()..."
                className="w-full bg-black/50 border-2 border-[#39ff14]/50 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 mb-4 min-h-[100px] resize-none pixel-text"
                rows={4}
              />
              <div className="flex gap-3">
                <button
                  onClick={sendRequest}
                  className="flex-1 bg-[#39ff14] text-black py-2 border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 pixel-text"
                >
                  SEND_REQUEST()
                </button>
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setRequestMessage('');
                    setSelectedUserId(null);
                  }}
                  className="px-4 py-2 bg-black/50 border-2 border-[#39ff14]/50 text-white/70 rounded-lg hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all duration-200 pixel-text"
                >
                  // CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Incoming Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="code-bg p-8 max-w-2xl w-full border-2 border-[#39ff14] max-h-[90vh] overflow-y-auto">
            <div className="text-[#39ff14] text-sm mb-4 pixel-text">// INCOMING_REQUESTS</div>
            <h2 className="text-2xl font-bold text-white mb-6 pixel-text code-glow">
              TEAM REQUESTS
            </h2>
            
            {incomingRequests.length === 0 ? (
              <div className="space-y-2">
                <p className="text-white/60 pixel-text">No pending requests</p>
                <p className="text-white/40 text-xs pixel-text">
                  // DEBUG: Check console for request fetch logs
                  <br />
                  // User ID: {CURRENT_USER_ID}
                  <br />
                  // Looking for: toUserId or to_user_id = {CURRENT_USER_ID}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((request) => {
                  const sender = request.from_user_id;
                  return (
                    <div
                      key={request._id}
                      className="code-bg p-4 border-2 border-[#39ff14]/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white pixel-text code-glow">
                            {sender?.name || 'Unknown User'}
                          </h3>
                          {sender?.school && (
                            <p className="text-sm text-white/60 pixel-text">
                              {sender.school}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAcceptRequest(request._id)}
                          className="bg-[#39ff14] text-black px-4 py-2 border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 pixel-text text-sm"
                        >
                          ACCEPT()
                        </button>
                      </div>
                      {request.message && (
                        <p className="text-white/80 text-sm pixel-text mb-2">
                          {request.message}
                        </p>
                      )}
                      {sender?.skills && sender.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {sender.skills.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] text-xs font-bold pixel-text"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            <button
              onClick={() => setShowRequestsModal(false)}
              className="mt-6 w-full bg-transparent border-2 border-[#39ff14]/50 text-white hover:border-[#39ff14] hover:text-[#39ff14] py-2 font-bold transition-all duration-200 pixel-text"
            >
              CLOSE()
            </button>
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

      {/* Requests Panel */}
      {showRequestsPanel && (
        <RequestsPanel
          incomingRequests={incomingRequests}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
          onClose={() => setShowRequestsPanel(false)}
          hackathons={hackathons}
          onViewProfile={(user) => {
            setSelectedUser(user);
            setShowProfileModal(true);
            setShowRequestsPanel(false); // Close requests panel when viewing profile
          }}
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

      {/* AI Mentor Panel */}
      {selectedTeam && (
        <AIMentorPanel
          team={selectedTeam}
          currentUserId={CURRENT_USER_ID}
          isOpen={showAIMentor}
          onClose={() => setShowAIMentor(!showAIMentor)}
        />
      )}
    </div>
  );
}
