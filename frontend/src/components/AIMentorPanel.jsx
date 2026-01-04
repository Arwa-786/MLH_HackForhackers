import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AIMentorPanel = ({ team, currentUserId, isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const quickActions = [
    { id: 'idea', label: 'DO_YOU_HAVE_AN_IDEA()', prompt: 'Do you have a project idea for our team?' },
    { id: 'need_idea', label: 'DO_YOU_NEED_AN_IDEA()', prompt: 'We need a project idea. Can you suggest one based on our skills?' },
    { id: 'tracks', label: 'SEND_TRACKS()', prompt: 'What are the hackathon tracks we should focus on?' },
    { id: 'theme', label: 'HACKATHON_THEME()', prompt: 'What is the theme of this hackathon and how can we align our project with it?' },
    { id: 'plan', label: 'THE_PLAN()', prompt: 'Create a detailed execution plan for our hackathon project.' },
    { id: 'organization', label: 'ORGANIZATION_WHO_DOES_WHAT()', prompt: 'Help us organize our team. Who should do what based on our skills?' },
    { id: 'tech_stack', label: 'TECH_STACK_RECOMMENDATION()', prompt: 'What tech stack should we use for our project?' },
    { id: 'timeline', label: '24_HOUR_TIMELINE()', prompt: 'Create a detailed 24-hour timeline for our hackathon project.' }
  ];

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage.trim();
    if (!messageToSend || !team?._id) return;

    const userMessage = {
      senderId: currentUserId,
      text: messageToSend,
      timestamp: new Date(),
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post(`http://localhost:3000/api/ai-mentor/${team._id}`, {
        message: messageToSend,
        teamContext: {
          members: team.members || [],
          hackathonId: team.hackathonId || team.hackathon_id,
          memberDetails: team.memberDetails || []
        }
      });

      const aiMessage = {
        senderId: 'ai_mentor',
        question: messageToSend, // Store the question with the answer
        text: response.data.response,
        timestamp: new Date(),
        isUser: false
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI mentor response:', error);
      const errorMessage = {
        senderId: 'ai_mentor',
        question: messageToSend,
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    sendMessage(action.prompt);
  };

  return (
    <>
      {/* Arrow Button - Only show when panel is closed */}
      {!isOpen && (
        <button
          onClick={onClose}
          className="fixed right-0 top-1/2 transform -translate-y-1/2 z-50 code-bg p-3 border-l-2 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all pixel-text font-bold text-sm rounded-l-lg shadow-lg"
          title="Open AI Mentor"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span className="text-xs block mt-1">AI</span>
        </button>
      )}

      {/* AI Mentor Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-96 bg-[#0a0a0a] border-l-2 border-[#39ff14]/50 z-50 flex flex-col code-bg transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b-2 border-[#39ff14]/50 flex items-center justify-between bg-black/50">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white pixel-text code-glow">
              AI_MENTOR()
            </h3>
            <p className="text-xs text-[#39ff14]/70 pixel-text">
              // TEAM_WIDE_ASSISTANT
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-[#39ff14] transition-colors text-xl font-bold pixel-text ml-4"
          >
            ×
          </button>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-b-2 border-[#39ff14]/50 bg-black/30">
          <p className="text-xs text-[#39ff14]/70 mb-3 pixel-text font-bold">QUICK_ACTIONS()</p>
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={loading}
                className="w-full text-left px-3 py-2 bg-black/50 border-2 border-[#39ff14]/30 text-white/80 hover:border-[#39ff14] hover:text-[#39ff14] hover:bg-[#39ff14]/10 transition-all duration-200 pixel-text text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Container */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ 
            maxHeight: 'calc(100vh - 400px)',
            scrollBehavior: 'smooth'
          }}
        >
          {messages.length === 0 ? (
            <div className="text-center text-white/50 pixel-text text-sm py-8">
              // AI_MENTOR_READY
              <br />
              // SELECT_AN_ACTION_OR_TYPE()
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.isUser;
              return (
                <div
                  key={index}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-lg pixel-text ${
                      isUser
                        ? 'bg-[#39ff14]/30 text-white border-2 border-[#39ff14]/50'
                        : 'bg-[#0a0a0a] border-2 border-[#39ff14] text-[#39ff14] code-glow w-full shadow-[0_0_20px_rgba(57,255,20,0.6)]'
                    }`}
                  >
                    {!isUser && (
                      <>
                        <div className="text-xs text-[#39ff14] mb-2 font-bold code-glow flex items-center gap-2">
                          <span>// AI_MENTOR</span>
                          <span className="text-[#39ff14]/50">→</span>
                        </div>
                        {msg.question && (
                          <div className="mb-3 pb-3 border-b border-[#39ff14]/30">
                            <div className="text-xs text-white/60 mb-1 font-bold">QUESTION:</div>
                            <div className="text-sm text-white/80 italic">{msg.question}</div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.text}</div>
                    <div className="text-xs text-white/30 mt-2">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-[#0a0a0a] border-2 border-[#39ff14]/50 text-[#39ff14] px-4 py-3 rounded-lg pixel-text">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse">// AI_THINKING...</div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t-2 border-[#39ff14]/50 bg-black/50">
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="ASK_AI_MENTOR()..."
              rows={2}
              className="flex-1 bg-black/50 border-2 border-[#39ff14]/50 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] resize-none pixel-text text-sm"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !inputMessage.trim()}
              className="px-4 py-2 bg-[#39ff14] text-black border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed pixel-text text-sm"
            >
              SEND()
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIMentorPanel;

