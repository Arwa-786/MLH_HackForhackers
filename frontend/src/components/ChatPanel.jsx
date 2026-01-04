import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ChatPanel = ({ team, currentUserId, currentUserName, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [teamName, setTeamName] = useState(team?.name || 'Team Chat');
  const [isEditingName, setIsEditingName] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (team?._id) {
      fetchMessages();
      // Poll for new messages every 2 seconds
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [team?._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!team?._id) return;
    
    try {
      const response = await axios.get(`http://localhost:3000/chat/${team._id}/messages`);
      setMessages(response.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !team?._id) return;
    
    setLoading(true);
    try {
      await axios.post(`http://localhost:3000/chat/${team._id}/messages`, {
        user_id: currentUserId,
        user_name: currentUserName,
        message: newMessage.trim()
      });
      setNewMessage('');
      fetchMessages(); // Refresh messages
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const askAI = async () => {
    if (!team?._id) return;
    
    setAiLoading(true);
    try {
      await axios.post(`http://localhost:3000/chat/${team._id}/ai-advice`, {
        prompt: newMessage.trim() || undefined
      });
      setNewMessage('');
      fetchMessages(); // Refresh messages to show AI response
    } catch (error) {
      console.error('Error getting AI advice:', error);
      alert('Failed to get AI advice');
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#0a0a0a] border-l-2 border-[#39ff14]/50 z-50 flex flex-col code-bg">
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
            // MEMBERS: {team?.members?.length || 0}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-[#39ff14] transition-colors text-xl font-bold pixel-text"
        >
          ×
        </button>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-white/50 pixel-text text-sm py-8">
            // NO_MESSAGES_YET
            <br />
            // START_CHATTING()
          </div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = msg.user_id === currentUserId;
            const isAI = msg.is_ai;
            
            return (
              <div
                key={msg._id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg pixel-text text-sm ${
                    isAI
                      ? 'bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14] code-glow'
                      : isCurrentUser
                      ? 'bg-[#39ff14]/30 text-white border border-[#39ff14]/50'
                      : 'bg-black/50 text-white/80 border border-[#39ff14]/30'
                  }`}
                >
                  {!isCurrentUser && !isAI && (
                    <div className="text-xs text-[#39ff14]/70 mb-1 font-bold">
                      {msg.user_name || 'User'}
                    </div>
                  )}
                  {isAI && (
                    <div className="text-xs text-[#39ff14] mb-1 font-bold code-glow">
                      // AI_MENTOR
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                  <div className="text-xs text-white/30 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t-2 border-[#39ff14]/50 bg-black/50">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="TYPE_MESSAGE()..."
          rows={2}
          className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] resize-none pixel-text text-sm mb-2"
        />
        <div className="flex gap-2">
          <button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim()}
            className="flex-1 bg-[#39ff14] text-black py-2 border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed pixel-text text-xs"
          >
            {loading ? '// SENDING...' : 'SEND()'}
          </button>
          <button
            onClick={askAI}
            disabled={aiLoading}
            className="flex-1 bg-[#39ff14]/50 text-[#39ff14] py-2 border-2 border-[#39ff14]/50 font-bold transition-all duration-200 hover:bg-[#39ff14]/30 hover:border-[#39ff14] disabled:opacity-50 disabled:cursor-not-allowed pixel-text text-xs"
          >
            {aiLoading ? '// AI_THINKING...' : 'ASK_AI()'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;

