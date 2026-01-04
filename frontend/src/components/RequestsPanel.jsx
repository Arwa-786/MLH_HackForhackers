import React from 'react';

const RequestsPanel = ({ 
  incomingRequests, 
  onAccept, 
  onDecline, 
  onClose,
  hackathons = [],
  onViewProfile
}) => {
  console.log('🎨 [RequestsPanel] Component rendering');
  console.log('🎨 [RequestsPanel] incomingRequests:', incomingRequests);
  console.log('🎨 [RequestsPanel] incomingRequests.length:', incomingRequests?.length || 0);
  console.log('🎨 [RequestsPanel] hackathons:', hackathons);

  const getHackathonName = (hackathonId) => {
    const hackathon = hackathons.find(h => (h._id || h.id) === hackathonId);
    return hackathon?.name || 'Unknown Hackathon';
  };

  return (
    <div className="fixed left-0 top-0 h-full bg-[#0a0a0a] z-40 flex flex-col border-r-2 border-[#39ff14]/50 shadow-2xl" style={{ width: '300px' }}>
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col code-bg">
        {/* Header */}
        <div className="p-4 border-b-2 border-[#39ff14]/50 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white pixel-text code-glow">
              INCOMING_REQUESTS()
            </h2>
            <p className="text-xs text-[#39ff14]/70 pixel-text mt-1">
              // PENDING: {incomingRequests.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-[#39ff14] transition-colors text-xl font-bold pixel-text ml-4 z-50 relative"
            style={{ minWidth: '32px', minHeight: '32px' }}
          >
            ×
          </button>
        </div>

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {incomingRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60 pixel-text text-sm">
                NO_PENDING_REQUESTS()
              </p>
              <p className="text-white/40 pixel-text text-xs mt-2">
                // Waiting for teammates...
              </p>
            </div>
          ) : (
            incomingRequests.map((request) => {
              // Backend returns user object under from_user_id
              const sender = request.from_user_id || request.fromUserId;
              console.log('👤 [RequestsPanel] Raw sender data:', sender);
              console.log('👤 [RequestsPanel] Sender type:', typeof sender);
              console.log('👤 [RequestsPanel] Full request:', request);
              
              // Check if sender is an object (from backend) or just an ID
              const senderData = typeof sender === 'object' && sender !== null ? sender : null;
              const senderId = senderData?._id || (typeof sender === 'string' ? sender : null);
              const senderName = senderData?.name || 'Unknown User';
              const senderSkills = senderData?.skills || [];
              const senderTechStack = senderData?.tech_stack || [];
              const senderSchool = senderData?.school || '';
              const senderLocation = senderData?.location || '';
              const senderGithub = senderData?.github || '';
              const senderDevpost = senderData?.devpost || '';
              const senderBio = senderData?.bio || '';
              const senderExperience = senderData?.experience || [];
              const hackathonId = request.hackathon_id || request.hackathonId;
              const hackathonName = getHackathonName(hackathonId);
              
              console.log('👤 [RequestsPanel] Processed sender data:', {
                requestId: request._id,
                sender,
                senderData,
                senderName,
                senderId,
                hasName: !!senderData?.name
              });
              
              return (
                <div
                  key={request._id}
                  className="code-bg p-4 border-2 border-[#39ff14]/30 hover:border-[#39ff14]/60 transition-all duration-200"
                >
                  {/* Sender Info */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-white font-bold pixel-text text-sm mb-1 code-glow hover:text-[#39ff14] transition-colors cursor-pointer"
                            onClick={() => onViewProfile && senderData && onViewProfile(senderData)}
                        >
                          {senderName}
                        </h3>
                        <p className="text-[#39ff14]/70 pixel-text text-xs mb-1">
                          // {hackathonName}
                        </p>
                        {senderSchool && (
                          <p className="text-white/60 pixel-text text-xs">
                            🏫 {senderSchool}
                          </p>
                        )}
                        {senderLocation && (
                          <p className="text-white/60 pixel-text text-xs">
                            📍 {senderLocation}
                          </p>
                        )}
                      </div>
                      {/* View Profile Button */}
                      {onViewProfile && senderData && (
                        <button
                          onClick={() => onViewProfile(senderData)}
                          className="px-2 py-1 bg-black/50 border border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all duration-200 pixel-text text-xs font-bold"
                        >
                          VIEW
                        </button>
                      )}
                    </div>
                    
                    {/* Skills Preview */}
                    {senderSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {senderSkills.slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14] text-xs pixel-text"
                          >
                            {skill}
                          </span>
                        ))}
                        {senderSkills.length > 3 && (
                          <span className="px-2 py-0.5 text-white/40 text-xs pixel-text">
                            +{senderSkills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  {request.message && (
                    <div className="mb-4 p-2 bg-black/50 border border-[#39ff14]/20">
                      <p className="text-white/80 text-xs pixel-text italic">
                        "{request.message}"
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        console.log('🎯 [RequestsPanel] ACCEPT button clicked for request:', request._id);
                        try {
                          await onAccept(request._id);
                        } catch (error) {
                          console.error('❌ [RequestsPanel] Error in onAccept:', error);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-[#39ff14]/20 border-2 border-[#39ff14] text-[#39ff14] hover:bg-[#39ff14]/30 hover:border-[#39ff14] transition-all duration-200 pixel-text text-xs font-bold relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="relative z-10">ACCEPT()</span>
                      <div className="absolute inset-0 bg-[#39ff14]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                    <button
                      onClick={() => onDecline(request._id)}
                      className="flex-1 px-3 py-2 bg-black/50 border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-all duration-200 pixel-text text-xs font-bold relative overflow-hidden group"
                    >
                      <span className="relative z-10">DECLINE()</span>
                      <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestsPanel;

