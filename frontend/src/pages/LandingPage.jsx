import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LandingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('start');
  const [inputType, setInputType] = useState('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [userData, setUserData] = useState(null);
  const [hackathons, setHackathons] = useState([]);
  const [selectedHackathons, setSelectedHackathons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      const response = await axios.get('http://localhost:3000/hackathons');
      setHackathons(response.data || []);
    } catch (error) {
      console.error('Error fetching hackathons:', error);
    }
  };

  const handleAnalyze = async () => {
    if (inputType === 'github' && !githubUrl) {
      setError('Please enter a GitHub URL');
      return;
    }
    if (inputType === 'resume' && !resumeFile) {
      setError('Please upload a resume');
      return;
    }

    if (inputType === 'resume' && resumeFile) {
      const maxSize = 10 * 1024 * 1024;
      if (resumeFile.size > maxSize) {
        setError('File size too large. Please upload a PDF smaller than 10MB.');
        return;
      }
    }

    setLoading(true);
    setError('');
    setStep('analyzing');

    try {
      let requestData = {};
      
      if (inputType === 'github') {
        requestData.githubUrl = githubUrl;
      } else {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          try {
            const response = await axios.post('http://localhost:3000/api/onboarding/analyze', {
              resumeBase64: base64
            }, {
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 60000
            });
            setUserData(response.data);
            setStep('review');
            setLoading(false);
          } catch (err) {
            console.error('Error analyzing resume:', err);
            if (err.response?.status === 413) {
              setError('File too large. Please use a smaller PDF file (max 10MB).');
            } else if (err.response?.status === 404) {
              setError('Server route not found. Please restart the backend server.');
            } else {
              setError(err.response?.data?.error || 'Failed to analyze resume');
            }
            setLoading(false);
            setStep('start');
          }
        };
        reader.onerror = () => {
          setError('Failed to read file');
          setLoading(false);
          setStep('start');
        };
        reader.readAsDataURL(resumeFile);
        return;
      }

      const response = await axios.post('http://localhost:3000/api/onboarding/analyze', requestData, {
        timeout: 30000
      });
      setUserData(response.data);
      setStep('review');
    } catch (err) {
      console.error('Error analyzing profile:', err);
      if (err.response?.status === 404) {
        setError('Server route not found. Please restart the backend server.');
      } else {
        setError(err.response?.data?.error || 'Failed to analyze profile');
      }
      setStep('start');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userData || !userData.name) {
      setError('Please fill in at least your name');
      return;
    }

    if (selectedHackathons.length === 0) {
      setError('Please select at least one hackathon');
      return;
    }

    setLoading(true);
    setError('');
    setStep('saving');

    try {
      const userId = '6958c084d6d4ea1f109dad70';
      const response = await axios.put(`http://localhost:3000/api/users/${userId}`, {
        userData,
        selectedHackathons
      });

      if (response.data.success || response.status === 200) {
        navigate('/hackathons');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err.response?.data?.error || 'Failed to save profile');
      setStep('review');
    } finally {
      setLoading(false);
    }
  };

  const updateUserData = (field, value) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const updateArrayField = (field, index, value) => {
    setUserData(prev => {
      const newArray = [...(prev[field] || [])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayItem = (field) => {
    setUserData(prev => ({ ...prev, [field]: [...(prev[field] || []), ''] }));
  };

  const removeArrayItem = (field, index) => {
    setUserData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Green glow effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#39ff14]/5 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#39ff14]/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="text-left mb-4 text-[#39ff14] text-sm pixel-text">
            // INIT_PROFILE()
          </div>
          <div className="text-4xl font-bold mb-4 text-[#39ff14] pixel-text code-glow">
            HackConnect
          </div>
          <h1 className="text-6xl font-bold mb-6 text-white pixel-text code-glow">
            FIND YOUR
            <br />
            <span className="text-[#39ff14]">PERFECT TEAM</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto pixel-text">
            FROM SKILL MATCHING TO TEAM FORMATION.
            <br />
            EVERYTHING YOU NEED TO BUILD
            <br />
            HACKATHON TEAMS THAT WIN.
          </p>
        </div>

        {/* AI Profiler Section */}
        {step === 'start' && (
          <div className="max-w-2xl mx-auto">
            <div className="code-bg p-8 border-2 border-[#39ff14]/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white pixel-text code-glow">AI_PROFILER()</h2>
                <span className="text-white/50 text-sm pixel-text">INTERFACE PROFILEACCESS {'{'}</span>
              </div>
              <p className="text-white/70 mb-8 text-center pixel-text text-sm">
                // LET AI ANALYZE GITHUB OR RESUME
              </p>

              {/* Input Type Selection */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setInputType('github')}
                  className={`flex-1 py-3 border-2 font-bold transition-all duration-200 pixel-text ${
                    inputType === 'github'
                      ? 'bg-[#39ff14] text-black border-[#39ff14] code-glow'
                      : 'bg-black/50 text-[#39ff14]/70 hover:bg-[#39ff14]/10 border-[#39ff14]/50 hover:border-[#39ff14]'
                  }`}
                >
                  GITHUB_PROFILE()
                </button>
                <button
                  onClick={() => setInputType('resume')}
                  className={`flex-1 py-3 border-2 font-bold transition-all duration-200 pixel-text ${
                    inputType === 'resume'
                      ? 'bg-[#39ff14] text-black border-[#39ff14] code-glow'
                      : 'bg-black/50 text-[#39ff14]/70 hover:bg-[#39ff14]/10 border-[#39ff14]/50 hover:border-[#39ff14]'
                  }`}
                >
                  UPLOAD_RESUME()
                </button>
              </div>

              {/* GitHub Input */}
              {inputType === 'github' && (
                <div className="mb-6">
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">
                    // GITHUB_URL: STRING
                  </label>
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                  />
                </div>
              )}

              {/* Resume Upload */}
              {inputType === 'resume' && (
                <div className="mb-6">
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">
                    // UPLOAD_RESUME: PDF
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setResumeFile(e.target.files[0])}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:border-2 file:border-[#39ff14] file:bg-[#39ff14] file:text-black file:text-xs file:font-semibold file:pixel-text hover:file:bg-[#39ff14]/80 pixel-text"
                  />
                  {resumeFile && (
                    <p className="mt-2 text-xs text-[#39ff14] pixel-text">// SELECTED: {resumeFile.name}</p>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-900/30 border-2 border-red-500 text-red-400 pixel-text">
                  // ERROR: {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full bg-[#39ff14] text-black py-4 border-2 border-[#39ff14] font-bold disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200 code-glow hover:bg-[#39ff14]/90 pixel-text text-lg"
              >
                {loading ? '// ANALYZING...' : 'START_ANALYZING()'}
              </button>
              
              <div className="mt-4 text-right text-xs text-white/50 pixel-text">
                {'}'} // PROFILEACCESS
              </div>
            </div>
          </div>
        )}

        {/* Analyzing State */}
        {step === 'analyzing' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="code-bg p-12 border-2 border-[#39ff14]/50">
              <div className="text-[#39ff14] text-sm mb-4 pixel-text">// PROCESSING...</div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#39ff14]/20 border-t-[#39ff14] mx-auto mb-6 code-glow"></div>
              <h2 className="text-2xl font-bold mb-4 pixel-text code-glow">ANALYZING_PROFILE()</h2>
              <p className="text-white/80 pixel-text">// EXTRACTING: SKILLS, EXPERIENCE, TECH_STACK</p>
            </div>
          </div>
        )}

        {/* Review & Edit Form */}
        {step === 'review' && userData && (
          <div className="max-w-4xl mx-auto">
            <div className="code-bg p-8 border-2 border-[#39ff14]/50 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[#39ff14] text-sm pixel-text">// REVIEW_PROFILE()</div>
                <div className="text-white/50 text-sm pixel-text">INTERFACE PROFILEEDIT {'{'}</div>
              </div>
              
              <h2 className="text-4xl font-bold mb-4 text-white pixel-text code-glow">
                REVIEW YOUR
                <br />
                PROFILE DATA
              </h2>
              <p className="text-white/80 mb-8 pixel-text text-sm">
                // VERIFY EXTRACTED DATA
                <br />
                // EDIT FIELDS AS NEEDED
              </p>

              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// NAME: STRING *</label>
                  <input
                    type="text"
                    value={userData.name || ''}
                    onChange={(e) => updateUserData('name', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// EMAIL: STRING</label>
                  <input
                    type="email"
                    value={userData.email || ''}
                    onChange={(e) => updateUserData('email', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                  />
                </div>

                {/* Role Preference */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// ROLE_PREFERENCE: STRING</label>
                  <select
                    value={userData.role_preference || ''}
                    onChange={(e) => updateUserData('role_preference', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                  >
                    <option value="">SELECT_ROLE()...</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Backend">Backend</option>
                    <option value="Full Stack">Full Stack</option>
                    <option value="Mobile">Mobile</option>
                    <option value="AI/ML">AI/ML</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Design">Design</option>
                  </select>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// SKILLS: ARRAY&lt;STRING&gt;</label>
                  <div className="space-y-2">
                    {(userData.skills || []).map((skill, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={skill}
                          onChange={(e) => updateArrayField('skills', index, e.target.value)}
                          className="flex-1 bg-black/50 border-2 border-[#39ff14]/50 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                          placeholder="SKILL_NAME()..."
                        />
                        <button
                          onClick={() => removeArrayItem('skills', index)}
                          className="px-4 py-2 bg-red-900/30 border-2 border-red-500 text-red-400 hover:bg-red-900/50 transition-all pixel-text text-sm"
                        >
                          // REMOVE
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('skills')}
                      className="text-sm text-[#39ff14] hover:text-[#39ff14]/80 font-bold pixel-text"
                    >
                      + ADD_SKILL()
                    </button>
                  </div>
                </div>

                {/* Tech Stack */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// TECH_STACK: ARRAY&lt;STRING&gt;</label>
                  <div className="space-y-2">
                    {(userData.tech_stack || []).map((tech, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={tech}
                          onChange={(e) => updateArrayField('tech_stack', index, e.target.value)}
                          className="flex-1 bg-black/50 border-2 border-[#39ff14]/50 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                          placeholder="TECHNOLOGY_NAME()..."
                        />
                        <button
                          onClick={() => removeArrayItem('tech_stack', index)}
                          className="px-4 py-2 bg-red-900/30 border-2 border-red-500 text-red-400 hover:bg-red-900/50 transition-all pixel-text text-sm"
                        >
                          // REMOVE
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('tech_stack')}
                      className="text-sm text-[#39ff14] hover:text-[#39ff14]/80 font-bold pixel-text"
                    >
                      + ADD_TECHNOLOGY()
                    </button>
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// EXPERIENCE: ARRAY&lt;STRING&gt;</label>
                  <div className="space-y-2">
                    {(userData.experience || []).map((exp, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={exp}
                          onChange={(e) => updateArrayField('experience', index, e.target.value)}
                          className="flex-1 bg-black/50 border-2 border-[#39ff14]/50 px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                          placeholder="E.G._SOFTWARE_ENGINEER_@_COMPANY()..."
                        />
                        <button
                          onClick={() => removeArrayItem('experience', index)}
                          className="px-4 py-2 bg-red-900/30 border-2 border-red-500 text-red-400 hover:bg-red-900/50 transition-all pixel-text text-sm"
                        >
                          // REMOVE
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('experience')}
                      className="text-sm text-[#39ff14] hover:text-[#39ff14]/80 font-bold pixel-text"
                    >
                      + ADD_EXPERIENCE()
                    </button>
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// SCHOOL: STRING</label>
                  <input
                    type="text"
                    value={userData.school || ''}
                    onChange={(e) => updateUserData('school', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                    placeholder="UNIVERSITY_NAME()..."
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// LOCATION: STRING</label>
                  <input
                    type="text"
                    value={userData.location || ''}
                    onChange={(e) => updateUserData('location', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                    placeholder="CITY,_STATE_OR_CITY,_COUNTRY()..."
                  />
                </div>

                {/* GitHub */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// GITHUB_USERNAME: STRING</label>
                  <input
                    type="text"
                    value={userData.github || ''}
                    onChange={(e) => updateUserData('github', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                    placeholder="USERNAME_(NO_URL)()..."
                  />
                </div>

                {/* Devpost */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// DEVPOST_USERNAME: STRING</label>
                  <input
                    type="text"
                    value={userData.devpost || ''}
                    onChange={(e) => updateUserData('devpost', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                    placeholder="DEVPOST_USERNAME()..."
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// BIO: STRING</label>
                  <textarea
                    value={userData.description || ''}
                    onChange={(e) => updateUserData('description', e.target.value)}
                    rows={3}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 resize-none pixel-text"
                    placeholder="SHORT_BIO_ABOUT_YOURSELF()..."
                  />
                </div>

                {/* Number of Hackathons */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// NUM_HACKATHONS: NUMBER</label>
                  <input
                    type="text"
                    value={userData.num_hackathons || ''}
                    onChange={(e) => updateUserData('num_hackathons', e.target.value)}
                    className="w-full bg-black/50 border-2 border-[#39ff14]/50 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#39ff14] focus:bg-black/70 transition-all duration-200 pixel-text"
                    placeholder="E.G._5()..."
                  />
                </div>

                {/* Hackathon Selection */}
                <div>
                  <label className="block text-xs text-[#39ff14] mb-2 pixel-text">// REGISTERED_HACKATHONS: ARRAY&lt;STRING&gt; *</label>
                  <div className="code-bg border-2 border-[#39ff14]/50 p-4 max-h-64 overflow-y-auto">
                    {hackathons.length === 0 ? (
                      <p className="text-white/60 pixel-text text-sm">// NO_HACKATHONS_AVAILABLE</p>
                    ) : (
                      hackathons.map((hackathon) => (
                        <label key={hackathon.id} className="flex items-center text-white/80 hover:text-[#39ff14] cursor-pointer py-1 pixel-text text-sm">
                          <input
                            type="checkbox"
                            checked={selectedHackathons.includes(hackathon.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHackathons([...selectedHackathons, hackathon.id]);
                              } else {
                                setSelectedHackathons(selectedHackathons.filter(id => id !== hackathon.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-[#39ff14]/50 bg-black/50 text-[#39ff14] focus:ring-2 focus:ring-[#39ff14]/50 cursor-pointer"
                          />
                          <span className="ml-3">{hackathon.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-white/60 pixel-text">
                    // SELECTED: {selectedHackathons.length} HACKATHONS
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-900/30 border-2 border-red-500 text-red-400 pixel-text mt-6">
                  // ERROR: {error}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep('start')}
                  className="flex-1 px-6 py-3 bg-black/50 border-2 border-[#39ff14]/50 text-white/70 rounded-lg hover:bg-[#39ff14]/10 hover:border-[#39ff14] transition-all duration-200 font-bold pixel-text"
                >
                  // BACK
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !userData.name || selectedHackathons.length === 0}
                  className="flex-1 bg-[#39ff14] text-black py-3 border-2 border-[#39ff14] font-bold transition-all duration-200 code-glow hover:bg-[#39ff14]/90 disabled:bg-gray-600 disabled:border-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed pixel-text"
                >
                  {loading ? '// SAVING...' : 'SAVE_PROFILE()'}
                </button>
              </div>
              <div className="mt-4 text-right text-xs text-white/50 pixel-text">
                {'}'} // PROFILEEDIT
              </div>
            </div>
          </div>
        )}

        {/* Saving State */}
        {step === 'saving' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="code-bg p-12 border-2 border-[#39ff14]/50">
              <div className="text-[#39ff14] text-sm mb-4 pixel-text">// PROCESSING...</div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#39ff14]/20 border-t-[#39ff14] mx-auto mb-6 code-glow"></div>
              <h2 className="text-2xl font-bold mb-4 pixel-text code-glow">SAVING_PROFILE()</h2>
              <p className="text-white/80 pixel-text">// UPDATING_DATABASE</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
