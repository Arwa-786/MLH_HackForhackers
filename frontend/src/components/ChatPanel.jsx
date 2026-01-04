import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Simple markdown renderer (fallback if react-markdown is not installed)
const SimpleMarkdown = ({ text }) => {
  if (!text) return null;
  
  // Split by lines and process
  const lines = text.split('\n');
  const elements = [];
  let currentList = null;
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-sm font-bold mb-1 text-green-200 mt-3">
          {trimmed.substring(4)}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-base font-bold mb-2 text-green-200 mt-3">
          {trimmed.substring(3)}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-lg font-bold mb-2 text-green-200 mt-3">
          {trimmed.substring(2)}
        </h1>
      );
    }
    // Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentList) {
        currentList = [];
      }
      currentList.push(
        <li key={index} className="text-green-300 ml-4">
          {trimmed.substring(2)}
        </li>
      );
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      if (!currentList) {
        currentList = [];
      }
      currentList.push(
        <li key={index} className="text-green-300 ml-4">
          {trimmed.replace(/^\d+\.\s/, '')}
        </li>
      );
    }
    // Regular paragraph
    else if (trimmed) {
      if (currentList) {
        elements.push(
          <ul key={`list-${index}`} className="list-disc list-inside mb-2 space-y-1 text-green-300">
            {currentList}
          </ul>
        );
        currentList = null;
      }
      // Process bold and italic
      let processedLine = trimmed;
      processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-green-200">$1</strong>');
      processedLine = processedLine.replace(/\*(.+?)\*/g, '<em class="italic text-green-200">$1</em>');
      processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-green-900/30 px-1 py-0.5 rounded text-green-200 text-xs">$1</code>');
      
      elements.push(
        <p key={index} className="mb-2 text-green-300" dangerouslySetInnerHTML={{ __html: processedLine }} />
      );
    } else {
      // Empty line - close list if open
      if (currentList) {
        elements.push(
          <ul key={`list-${index}`} className="list-disc list-inside mb-2 space-y-1 text-green-300">
            {currentList}
          </ul>
        );
        currentList = null;
      }
    }
  });
  
  // Close any open list
  if (currentList) {
    elements.push(
      <ul key="list-final" className="list-disc list-inside mb-2 space-y-1 text-green-300">
        {currentList}
      </ul>
    );
  }
  
  return <div>{elements}</div>;
};

const ChatPanel = ({ team, currentUserId, currentUserName, onClose }) => {
  const [teamData, setTeamData] = useState(team);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [teamName, setTeamName] = useState(team?.name || 'Team Chat');
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null); // ARCHITECT, SCRUM_MASTER, DESIGNER, or null
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Get messages from teamData.messages array
  const messages = teamData?.messages || [];

  useEffect(() => {
    if (team?._id) {
      fetchTeamData();
      // Poll for team data every 3 seconds
      const interval = setInterval(fetchTeamData, 3000);
      return () => clearInterval(interval);
    }
  }, [team?._id]);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const threshold = 150; // Consider "at bottom" if within 150px
    const isAtBottom = scrollHeight - scrollTop - clientHeight < threshold;
    return isAtBottom;
  };

  // Handle scroll events to track if user is at bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const atBottom = checkIfAtBottom();
      setIsUserAtBottom(atBottom);
    };

    container.addEventListener('scroll', handleScroll);
    // Check initial state
    setIsUserAtBottom(checkIfAtBottom());
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]); // Re-check when messages change

  // Track previous message count to detect new messages
  const prevMessageCountRef = useRef(messages.length);

  // Only auto-scroll if user is at bottom OR if they just sent a message
  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messages.length === 0) {
      // Always scroll to bottom if no messages
      scrollToBottom();
      return;
    }

    if (messageCountChanged) {
      // New message arrived
      if (shouldAutoScroll) {
        // User sent a message or AI responded - always scroll
        scrollToBottom();
        setShouldAutoScroll(false);
      } else {
        // Check if user is at bottom before auto-scrolling
        const atBottom = checkIfAtBottom();
        if (atBottom) {
          scrollToBottom();
        }
      }
    }
  }, [messages.length, shouldAutoScroll]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchTeamData = async () => {
    if (!team?._id) return;
    
    try {
      // Fetch team data which includes messages array
      const response = await axios.get(`http://localhost:3000/api/team/${team._id}`);
      if (response.data) {
        setTeamData(response.data);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !team?._id) {
      console.error('Cannot send: missing message or team ID', { hasMessage: !!newMessage.trim(), hasTeam: !!team?._id });
      return;
    }
    
    setLoading(true);
    setShouldAutoScroll(true); // Force scroll when user sends a message
    try {
      console.log('📤 Sending message:', { teamId: team._id, userId: currentUserId, userName: currentUserName });
      const response = await axios.post(`http://localhost:3000/chat/${team._id}/messages`, {
        user_id: currentUserId,
        user_name: currentUserName,
        message: newMessage.trim()
      });
      console.log('✅ Message sent successfully:', response.data);
      setNewMessage('');
      fetchTeamData(); // Refresh team data to get updated messages
    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('❌ Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';
      alert(`Failed to send message: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const askAI = async () => {
    if (!team?._id) return;
    
    setAiLoading(true);
    setShouldAutoScroll(true); // Force scroll when AI responds
    try {
      await axios.post(`http://localhost:3000/chat/${team._id}/ai-advice`, {
        prompt: newMessage.trim() || undefined,
        activeAgent: activeAgent // Include active agent in request
      });
      setNewMessage('');
      fetchTeamData(); // Refresh team data to show AI response
    } catch (error) {
      console.error('Error getting AI advice:', error);
      alert('Failed to get AI advice');
    } finally {
      setAiLoading(false);
    }
  };

  const initializeGitHub = async (projectName) => {
    if (!team?._id) return;
    
    try {
      setLoading(true);
      const response = await axios.post('http://localhost:3000/github/init', {
        teamId: team._id,
        projectName: projectName
      });
      
      // The backend now automatically posts a message with the GitHub link
      // Just refresh to show the new message
      fetchTeamData();
    } catch (error) {
      console.error('Error initializing GitHub:', error);
      alert('Failed to initialize GitHub repository: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const launchReplit = (replitUrl) => {
    if (replitUrl) {
      window.open(replitUrl, '_blank');
    } else {
      // Generate URL from team's GitHub repo if available
      const githubRepo = teamData?.github_repo;
      if (githubRepo) {
        const [owner, repo] = githubRepo.split('/');
        const replitUrl = `https://replit.com/github/${owner}/${repo}`;
        window.open(replitUrl, '_blank');
      } else {
        alert('GitHub repository not initialized yet. Please initialize GitHub first.');
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed left-80 top-0 right-0 bottom-0 bg-[#0a0a0a] z-40 flex flex-col border-l-2 border-[#39ff14]/50">
      <div className="w-full h-full bg-[#0a0a0a] flex flex-col code-bg">
        {/* Header */}
        <div className="p-4 border-b-2 border-[#39ff14]/50 flex items-center justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false);
                    // TODO: Update team name in backend
                  }
                }}
                className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-2 py-1 text-white text-sm pixel-text focus:outline-none focus:border-[#39ff14]"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => setIsEditingName(true)}
                className="text-lg font-bold text-white pixel-text code-glow cursor-pointer hover:text-[#39ff14]"
              >
                {teamName}
              </h3>
            )}
            <p className="text-xs text-[#39ff14]/70 pixel-text">
              // MEMBERS: {team?.members?.length || 0}/4
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-[#39ff14] transition-colors text-xl font-bold pixel-text ml-4"
          >
            ×
          </button>
        </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/50 pixel-text text-sm py-8">
            // NO_MESSAGES_YET
            <br />
            // START_CHATTING()
          </div>
        ) : (
          messages.map((msg, index) => {
            const isCurrentUser = msg.senderId === currentUserId;
            const isAI = msg.senderId === 'ai_bot';
            
            // Get sender name for non-AI messages
            let senderName = 'User';
            if (!isAI && !isCurrentUser && teamData?.memberDetails) {
              const sender = teamData.memberDetails.find(m => m._id?.toString() === msg.senderId);
              senderName = sender?.name || 'User';
            }
            
            return (
              <div
                key={`${msg.senderId}-${msg.timestamp}-${index}`}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-lg pixel-text ${
                    isAI
                      ? 'bg-green-900/20 border border-green-400 text-green-300 w-full shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                      : isCurrentUser
                      ? 'bg-[#39ff14]/30 text-white border-2 border-[#39ff14]/50'
                      : 'bg-black/50 text-white/80 border-2 border-[#39ff14]/30'
                  }`}
                >
                  {!isCurrentUser && !isAI && (
                    <div className="text-xs text-[#39ff14]/70 mb-2 font-bold">
                      {senderName}
                    </div>
                  )}
                  {isAI && (
                    <div className="text-xs text-green-400 mb-2 font-bold flex items-center gap-2">
                      <span>SYSTEM ADVISOR</span>
                    </div>
                  )}
                  <div 
                    className={`break-words text-sm leading-relaxed ${
                      isAI ? 'max-h-96 overflow-y-auto' : 'whitespace-pre-wrap'
                    }`}
                  >
                    {isAI ? (
                      <SimpleMarkdown text={msg.text} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    )}
                  </div>
                  
                  {/* GitHub Action Button */}
                  {isAI && (msg.actionType === 'GITHUB_INIT' || msg.github_action) && (
                    <div className="mt-4 pt-3 border-t border-green-400/30">
                      <button
                        onClick={() => initializeGitHub(msg.project_name)}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-black/50 border-2 border-green-400 text-green-400 hover:bg-green-400/10 hover:border-green-300 transition-all duration-200 pixel-text text-xs font-bold relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="relative z-10">EXECUTE_GIT_SCAFFOLD()</span>
                        <div className="absolute inset-0 bg-green-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      </button>
                    </div>
                  )}
                  
                  <div className="text-xs text-white/30 mt-2">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 border-t-2 border-[#39ff14]/50 bg-black/50">
        {/* Agent Switcher */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveAgent(activeAgent === 'ARCHITECT' ? null : 'ARCHITECT')}
            className={`px-3 py-1.5 text-xs border-2 font-bold transition-all duration-200 pixel-text ${
              activeAgent === 'ARCHITECT'
                ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                : 'bg-black/50 border-[#39ff14]/30 text-[#39ff14]/70 hover:border-[#39ff14]/50'
            }`}
          >
            [ARCHITECT]
          </button>
          <button
            onClick={() => setActiveAgent(activeAgent === 'SCRUM_MASTER' ? null : 'SCRUM_MASTER')}
            className={`px-3 py-1.5 text-xs border-2 font-bold transition-all duration-200 pixel-text ${
              activeAgent === 'SCRUM_MASTER'
                ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                : 'bg-black/50 border-[#39ff14]/30 text-[#39ff14]/70 hover:border-[#39ff14]/50'
            }`}
          >
            [SCRUM_MASTER]
          </button>
          <button
            onClick={() => setActiveAgent(activeAgent === 'DESIGNER' ? null : 'DESIGNER')}
            className={`px-3 py-1.5 text-xs border-2 font-bold transition-all duration-200 pixel-text ${
              activeAgent === 'DESIGNER'
                ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]'
                : 'bg-black/50 border-[#39ff14]/30 text-[#39ff14]/70 hover:border-[#39ff14]/50'
            }`}
          >
            [DESIGNER]
          </button>
          {activeAgent && (
            <div className="flex-1 text-xs text-[#39ff14]/70 pixel-text flex items-center ml-2">
              // Active: {activeAgent}
            </div>
          )}
        </div>
        <div className="flex gap-3 mb-3">
          <button
            onClick={askAI}
            disabled={aiLoading}
            className="px-4 py-2 bg-[#39ff14]/50 text-[#39ff14] border-2 border-[#39ff14]/50 font-bold transition-all duration-200 hover:bg-[#39ff14]/30 hover:border-[#39ff14] disabled:opacity-50 disabled:cursor-not-allowed pixel-text text-sm"
          >
            {aiLoading ? '// AI_THINKING...' : 'ASK_AI_MENTOR()'}
          </button>
          <div className="flex-1 text-xs text-[#39ff14]/70 pixel-text flex items-center">
            // Type your message or ask AI for project ideas, execution plans, and team advice
          </div>
        </div>
        <div className="flex gap-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="TYPE_MESSAGE() or ask AI for help..."
            rows={3}
            className="flex-1 bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] resize-none pixel-text text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim()}
            className="px-6 py-3 bg-[#39ff14] text-black border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed pixel-text text-sm"
          >
            {loading ? '// SENDING...' : 'SEND()'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ChatPanel;

