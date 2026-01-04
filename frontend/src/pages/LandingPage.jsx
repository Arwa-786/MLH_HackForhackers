import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LandingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('start'); // 'start', 'analyzing', 'review', 'saving'
  const [inputType, setInputType] = useState('github'); // 'github' or 'resume'
  const [githubUrl, setGithubUrl] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [userData, setUserData] = useState(null);
  const [hackathons, setHackathons] = useState([]);
  const [selectedHackathons, setSelectedHackathons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch hackathons on component mount
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

    // Check file size (limit to 10MB to avoid 413 errors)
    if (inputType === 'resume' && resumeFile) {
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
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
        // Convert file to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1];
          try {
            const response = await axios.post('http://localhost:3000/api/onboarding/analyze', {
              resumeBase64: base64
            }, {
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 60000 // 60 second timeout for large files
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
        timeout: 30000 // 30 second timeout
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
      // Hardcoded user ID for demo
      const userId = '6958c084d6d4ea1f109dad70';
      
      // Use PUT request to update the user profile
      const response = await axios.put(`http://localhost:3000/api/users/${userId}`, {
        userData,
        selectedHackathons
      });

      if (response.data.success || response.status === 200) {
        // Navigate to hackathons page
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
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateArrayField = (field, index, value) => {
    setUserData(prev => {
      const newArray = [...(prev[field] || [])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayItem = (field) => {
    setUserData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), '']
    }));
  };

  const removeArrayItem = (field, index) => {
    setUserData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Find Your Perfect Hackathon Team
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            AI-powered teammate matching for hackathons. Connect with developers who complement your skills.
          </p>
        </div>

        {/* AI Profiler Section */}
        {step === 'start' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-3xl font-bold mb-6 text-center">AI Profiler</h2>
              <p className="text-white/70 mb-8 text-center">
                Let our AI analyze your GitHub profile or resume to auto-fill your profile
              </p>

              {/* Input Type Selection */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setInputType('github')}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    inputType === 'github'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  GitHub Profile
                </button>
                <button
                  onClick={() => setInputType('resume')}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    inputType === 'resume'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  Upload Resume
                </button>
              </div>

              {/* GitHub Input */}
              {inputType === 'github' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2 text-white/90">
                    GitHub URL
                  </label>
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                  />
                </div>
              )}

              {/* Resume Upload */}
              {inputType === 'resume' && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2 text-white/90">
                    Upload Resume (PDF)
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setResumeFile(e.target.files[0])}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#3b82f6] file:text-white hover:file:bg-blue-600"
                  />
                  {resumeFile && (
                    <p className="mt-2 text-sm text-white/60">Selected: {resumeFile.name}</p>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#3b82f6] to-blue-600 text-white py-4 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-[#3b82f6]/50 text-lg"
              >
                {loading ? 'Analyzing...' : 'Analyze Profile'}
              </button>
            </div>
          </div>
        )}

        {/* Analyzing State */}
        {step === 'analyzing' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-12 shadow-2xl">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-[#3b82f6] mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold mb-4">Analyzing Your Profile...</h2>
              <p className="text-white/70">Our AI is extracting your skills, experience, and tech stack</p>
            </div>
          </div>
        )}

        {/* Review & Edit Form */}
        {step === 'review' && userData && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl mb-8">
              <h2 className="text-3xl font-bold mb-6 text-center">Review Your Profile</h2>
              <p className="text-white/70 mb-8 text-center">
                Review and edit the information our AI extracted. Make sure everything is accurate!
              </p>

              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Name *</label>
                  <input
                    type="text"
                    value={userData.name || ''}
                    onChange={(e) => updateUserData('name', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Email</label>
                  <input
                    type="email"
                    value={userData.email || ''}
                    onChange={(e) => updateUserData('email', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                  />
                </div>

                {/* Role Preference */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Role Preference</label>
                  <select
                    value={userData.role_preference || ''}
                    onChange={(e) => updateUserData('role_preference', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                  >
                    <option value="">Select role...</option>
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
                  <label className="block text-sm font-semibold mb-2 text-white/90">Skills</label>
                  <div className="space-y-2">
                    {(userData.skills || []).map((skill, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={skill}
                          onChange={(e) => updateArrayField('skills', index, e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                          placeholder="Skill name"
                        />
                        <button
                          onClick={() => removeArrayItem('skills', index)}
                          className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('skills')}
                      className="text-sm text-[#3b82f6] hover:text-blue-400 font-medium"
                    >
                      + Add Skill
                    </button>
                  </div>
                </div>

                {/* Tech Stack */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Tech Stack</label>
                  <div className="space-y-2">
                    {(userData.tech_stack || []).map((tech, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={tech}
                          onChange={(e) => updateArrayField('tech_stack', index, e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                          placeholder="Technology name"
                        />
                        <button
                          onClick={() => removeArrayItem('tech_stack', index)}
                          className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('tech_stack')}
                      className="text-sm text-[#3b82f6] hover:text-blue-400 font-medium"
                    >
                      + Add Technology
                    </button>
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Experience</label>
                  <div className="space-y-2">
                    {(userData.experience || []).map((exp, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={exp}
                          onChange={(e) => updateArrayField('experience', index, e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                          placeholder="e.g., Software Engineer @ Company"
                        />
                        <button
                          onClick={() => removeArrayItem('experience', index)}
                          className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/30 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addArrayItem('experience')}
                      className="text-sm text-[#3b82f6] hover:text-blue-400 font-medium"
                    >
                      + Add Experience
                    </button>
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">School</label>
                  <input
                    type="text"
                    value={userData.school || ''}
                    onChange={(e) => updateUserData('school', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                    placeholder="University name"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Location</label>
                  <input
                    type="text"
                    value={userData.location || ''}
                    onChange={(e) => updateUserData('location', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                    placeholder="City, State or City, Country"
                  />
                </div>

                {/* GitHub */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">GitHub Username</label>
                  <input
                    type="text"
                    value={userData.github || ''}
                    onChange={(e) => updateUserData('github', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                    placeholder="username (no URL)"
                  />
                </div>

                {/* Devpost */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Devpost</label>
                  <input
                    type="text"
                    value={userData.devpost || ''}
                    onChange={(e) => updateUserData('devpost', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                    placeholder="Devpost username"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Bio</label>
                  <textarea
                    value={userData.description || ''}
                    onChange={(e) => updateUserData('description', e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 resize-none"
                    placeholder="Short bio about yourself"
                  />
                </div>

                {/* Number of Hackathons */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">Number of Hackathons</label>
                  <input
                    type="text"
                    value={userData.num_hackathons || ''}
                    onChange={(e) => updateUserData('num_hackathons', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200"
                    placeholder="e.g., 5"
                  />
                </div>

                {/* Hackathon Selection */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white/90">
                    Which hackathons are you attending? *
                  </label>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {hackathons.length === 0 ? (
                      <p className="text-white/60 text-sm">Loading hackathons...</p>
                    ) : (
                      <div className="space-y-2">
                        {hackathons.map((hackathon) => (
                          <label key={hackathon.id} className="flex items-center cursor-pointer group">
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
                              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/50 cursor-pointer"
                            />
                            <span className="ml-3 text-sm text-white/70 group-hover:text-white transition-colors">
                              {hackathon.name} - {hackathon.location}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedHackathons.length > 0 && (
                    <p className="mt-2 text-sm text-white/60">
                      Selected: {selectedHackathons.length} hackathon{selectedHackathons.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
                    {error}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setStep('start')}
                    className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all duration-200 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || !userData.name || selectedHackathons.length === 0}
                    className="flex-1 bg-gradient-to-r from-[#3b82f6] to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-[#3b82f6]/50"
                  >
                    {loading ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saving State */}
        {step === 'saving' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-12 shadow-2xl">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-[#3b82f6] mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold mb-4">Saving Your Profile...</h2>
              <p className="text-white/70">Almost there!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

