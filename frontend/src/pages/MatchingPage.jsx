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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [team, setTeam] = useState(null);
  const [neededRoles, setNeededRoles] = useState([]);
  const [matchScores, setMatchScores] = useState({});
  const [calculatingScores, setCalculatingScores] = useState(new Set());

  useEffect(() => {
    fetchUsers();
    fetchTeam();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, users]);

  useEffect(() => {
    if (users.length > 0 && currentUserId) {
      calculateMatchScores();
    }
  }, [users.length, team, currentUserId]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:3000/users');
      const fetchedUsers = response.data;
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
      
      // Set first user as current user if not set
      if (!currentUserId && fetchedUsers.length > 0) {
        setCurrentUserId(fetchedUsers[0]._id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/team/${currentUserId}`);
      if (response.data.team) {
        setTeam(response.data.team);
        setNeededRoles(response.data.needed_roles || []);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const calculateMatchScores = async () => {
    // Get the first user as current user (or use a real user ID from auth)
    const currentUser = users.find(u => u._id === currentUserId) || users[0];
    if (!currentUser || users.length < 2) {
      console.log('Not enough users to calculate scores');
      return;
    }

    const teamMemberIds = team?.members || [];
    const calculating = new Set();

    // Calculate scores for all users except current user
    const scorePromises = users
      .filter(user => user._id !== currentUser._id)
      .map(async (user) => {
        calculating.add(user._id);
        setCalculatingScores(new Set(calculating));

        try {
          const response = await axios.post('http://localhost:3000/match-score', {
            user1_id: currentUser._id,
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
            category: 'Okay Match'
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
        from_user_id: currentUserId,
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

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase().replace(' match', '')) {
      case 'strong':
        return 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30';
      case 'good':
        return 'bg-blue-500 text-white shadow-lg shadow-blue-500/30';
      case 'okay':
        return 'bg-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/30';
      default:
        return 'bg-gray-500 text-white';
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
            className={`transition-all duration-500 ${isStrongMatch ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${isStrongMatch ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' : 'text-white'}`}>
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
        className="rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg"
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
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/20 border-t-[#3b82f6] mb-4"></div>
          <p className="text-white/60 font-medium">Loading teammates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-6xl mx-auto">
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
            {team && (
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg px-4 py-2">
                <p className="text-white/80 text-sm font-medium">
                  Team: <span className="text-[#3b82f6] font-semibold">{team.members.length}/4</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Your Team Needs Section */}
        {neededRoles.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-md border border-blue-500/20 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-3">Your Team Needs</h2>
            <div className="flex flex-wrap gap-2">
              {neededRoles.map((role, i) => (
                <span
                  key={i}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-full text-sm font-medium backdrop-blur-sm"
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
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl sticky top-8">
              <h2 className="text-xl font-bold text-white mb-6">Filters</h2>
              
              {/* Role Filters */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/90 mb-3 uppercase tracking-wide">Role</h3>
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
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/50 cursor-pointer"
                      />
                      <span className="ml-3 text-sm text-white/70 group-hover:text-white transition-colors">
                        {role}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tech Stack Filters */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/90 mb-3 uppercase tracking-wide">Tech Stack</h3>
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
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                        selectedTechStack.includes(tech)
                          ? 'bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/30'
                          : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              </div>

              {/* School Filter */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/90 mb-3 uppercase tracking-wide">School</h3>
                <input
                  type="text"
                  placeholder="Search school..."
                  value={filters.school}
                  onChange={(e) => setFilters({...filters, school: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 text-sm"
                />
              </div>

              {/* Location Filter */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/90 mb-3 uppercase tracking-wide">Location</h3>
                <input
                  type="text"
                  placeholder="Search location..."
                  value={filters.location}
                  onChange={(e) => setFilters({...filters, location: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 text-sm"
                />
              </div>

              {/* Skills Filter */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/90 mb-3 uppercase tracking-wide">Skills</h3>
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={filters.skills}
                  onChange={(e) => setFilters({...filters, skills: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 text-sm"
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
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all duration-200 text-sm font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* LinkedIn-style Horizontal Cards List */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60 text-lg font-medium">No teammates found matching your filters</p>
            </div>
          ) : (
            filteredUsers
              .filter(user => user._id !== currentUserId)
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
                    className={`flex items-center gap-6 p-6 hover:bg-white/10 transition-all duration-200 cursor-pointer ${
                      index < filteredUsers.length - 1 ? 'border-b border-white/10' : ''
                    }`}
                  >
                    {/* Left: Avatar and Name */}
                    <div className="flex-shrink-0">
                      <Avatar name={user.name} size={80} />
                    </div>

                    {/* Middle: Bio, Tech Stack, School, Location */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white mb-2 hover:text-[#3b82f6] transition-colors">
                        {user.name}
                      </h3>
                      
                      {/* Bio Preview */}
                      <p className="text-white/70 text-sm mb-3 line-clamp-2">
                        {bioPreview}
                      </p>

                      {/* Top 3 Tech Stack */}
                      {topTechStack.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {topTechStack.map((tech, i) => (
                            <span
                              key={i}
                              className="bg-purple-500/20 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                            >
                              {tech}
                            </span>
                          ))}
                          {(user.tech_stack || []).length > 3 && (
                            <span className="text-white/50 text-xs px-2 py-1">...</span>
                          )}
                        </div>
                      )}

                      {/* School and Location */}
                      <div className="flex items-center gap-4 text-sm text-white/60">
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

                    {/* Right: Score Ring and View Profile Button */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-4">
                      {isCalculating ? (
                        <ScoreSkeleton />
                      ) : (
                        <div className={isStrongMatch ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]' : ''}>
                          <ScoreRing score={score} size={80} isStrongMatch={isStrongMatch} />
                        </div>
                      )}
                      
                      {matchData && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(matchData.category)}`}>
                          {matchData.category}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(user);
                        }}
                        className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all duration-200 text-sm font-medium"
                      >
                        View Full Profile
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#0a0a0a] border border-white/20 rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Avatar name={selectedUser.name} size={100} />
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{selectedUser.name}</h2>
                    {matchScores[selectedUser._id] && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(matchScores[selectedUser._id].category)}`}>
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
                  className="text-white/60 hover:text-white text-2xl font-bold"
                >
                  ×
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
              <div className="mb-6 space-y-2">
                {selectedUser.school && (
                  <p className="text-white/70 text-sm flex items-center">
                    <span className="mr-2">🏫</span>
                    {selectedUser.school}
                  </p>
                )}
                {selectedUser.location && (
                  <p className="text-white/70 text-sm flex items-center">
                    <span className="mr-2">📍</span>
                    {selectedUser.location}
                  </p>
                )}
              </div>

              {/* GitHub */}
              {selectedUser.github && (
                <div className="mb-6">
                  <p className="text-white/90 font-semibold mb-2">GitHub</p>
                  <a
                    href={selectedUser.github.startsWith('http') ? selectedUser.github : `https://github.com/${selectedUser.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3b82f6] hover:text-blue-400 underline text-sm"
                  >
                    {selectedUser.github}
                  </a>
                </div>
              )}

              {/* Devpost */}
              {selectedUser.devpost && (
                <div className="mb-6">
                  <p className="text-white/90 font-semibold mb-2">Devpost</p>
                  <a
                    href={selectedUser.devpost.startsWith('http') ? selectedUser.devpost : `https://devpost.com/${selectedUser.devpost}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3b82f6] hover:text-blue-400 underline text-sm"
                  >
                    {selectedUser.devpost}
                  </a>
                </div>
              )}

              {/* Full Skills List */}
              {selectedUser.skills && selectedUser.skills.length > 0 && (
                <div className="mb-6">
                  <p className="text-white/90 font-semibold mb-3">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.skills.map((skill, i) => (
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

              {/* Full Tech Stack */}
              {selectedUser.tech_stack && selectedUser.tech_stack.length > 0 && (
                <div className="mb-6">
                  <p className="text-white/90 font-semibold mb-3">Tech Stack</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.tech_stack.map((tech, i) => (
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

              {/* Experience */}
              {selectedUser.experience && selectedUser.experience.length > 0 && (
                <div className="mb-6">
                  <p className="text-white/90 font-semibold mb-3">Experience</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.experience.map((exp, i) => (
                      <span
                        key={i}
                        className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Message and Send Request */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <label className="block text-white/90 font-semibold mb-2">Message</label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Enter your message (optional)..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 mb-4 min-h-[100px] resize-none"
                  rows={4}
                />
                <button
                  onClick={handleSendRequestFromModal}
                  disabled={requestsSent >= 5}
                  className="w-full bg-gradient-to-r from-[#3b82f6] to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-[#3b82f6]/50 disabled:shadow-none"
                >
                  {requestsSent >= 5 ? 'Request Limit Reached' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Modal (for quick send without opening profile) */}
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
