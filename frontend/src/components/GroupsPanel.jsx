import { useState, useEffect } from 'react';
import axios from 'axios';

const GroupsPanel = ({ currentUserId, onSelectTeam, selectedTeamId, onClose }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, [currentUserId]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3000/api/teams/${currentUserId}`);
      setTeams(response.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed left-0 top-0 h-full w-80 bg-[#0a0a0a] border-r-2 border-[#39ff14]/50 z-50 flex flex-col code-bg">
      {/* Header */}
      <div className="p-4 border-b-2 border-[#39ff14]/50 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white pixel-text code-glow">
          GROUPS
        </h3>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-[#39ff14] transition-colors text-xl font-bold pixel-text"
        >
          ×
        </button>
      </div>

      {/* Teams List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-white/50 pixel-text text-sm py-8">
            // LOADING...
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center text-white/50 pixel-text text-sm py-8">
            // NO_GROUPS_YET
            <br />
            <br />
            // ACCEPT_A_REQUEST_TO_START()
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => {
              const isSelected = selectedTeamId === team._id;
              return (
                <div
                  key={team._id}
                  onClick={() => onSelectTeam(team)}
                  className={`code-bg p-4 border-2 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-[#39ff14] bg-[#39ff14]/10 code-glow'
                      : 'border-[#39ff14]/50 hover:border-[#39ff14]/70 hover:bg-[#39ff14]/5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-white font-bold pixel-text text-sm code-glow">
                      {team.name || `Team ${team._id.slice(-4)}`}
                    </h4>
                    {isSelected && (
                      <span className="text-[#39ff14] text-xs pixel-text">→</span>
                    )}
                  </div>
                  
                  {team.hackathon && (
                    <p className="text-xs text-[#39ff14]/70 pixel-text mb-2">
                      // {team.hackathon.name}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-white/60 pixel-text">
                      MEMBERS: <span className="text-[#39ff14]">{team.members?.length || 0}/4</span>
                    </span>
                    {team.is_full && (
                      <span className="text-xs text-[#39ff14] pixel-text font-bold">
                        // FULL
                      </span>
                    )}
                  </div>
                  
                  {team.memberDetails && team.memberDetails.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {team.memberDetails.slice(0, 3).map((member, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] pixel-text"
                        >
                          {member.name?.split(' ')[0] || 'Member'}
                        </span>
                      ))}
                      {team.memberDetails.length > 3 && (
                        <span className="text-xs text-white/50 pixel-text">
                          +{team.memberDetails.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPanel;

