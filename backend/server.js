import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (or specify your frontend URL)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100mb' })); // Increase limit for large PDF uploads
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env file');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('1. Check your username and password in MONGODB_URI');
    console.error('2. Ensure your IP is whitelisted in MongoDB Atlas Network Access');
    console.error('3. Verify the connection string format: mongodb+srv://username:password@cluster.mongodb.net/dbname');
    console.error('4. URL-encode special characters in password (e.g., @ becomes %40)');
    process.exit(1);
  });

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role_preference: String,
  skills: [String],
  tech_stack: [String],
  experience: [String],
  num_hackathons: [String],
  devpost: String,
  github: String,
  school: String,
  location: String,
  description: String,
  registered_hackathons: [String] // Array of hackathon IDs
});

const User = mongoose.model('User', UserSchema);

// Request Schema
const RequestSchema = new mongoose.Schema({
  from_user_id: String,
  to_user_id: String,
  hackathon_id: String,
  status: { type: String, default: 'pending' },
  message: String,
  createdAt: { type: Date, default: Date.now }
});

const Request = mongoose.model('Request', RequestSchema);

// Hackathon Schema - explicitly set collection name to 'hackathons'
const HackathonSchema = new mongoose.Schema({
  name: String,
  startDate: Date,
  endDate: Date,
  location: String,
  type: String,
  url: String,
  description: String,
  imageUrl: String, // Add imageUrl field to schema
  logo: String, // Also support logo field
  isActive: { type: Boolean, default: true }
}, { collection: 'hackathons' }); // Explicitly set collection name

const Hackathon = mongoose.model('Hackathon', HackathonSchema);

// Team Schema
const TeamSchema = new mongoose.Schema({
  hackathon_id: String,
  members: [{ type: String, ref: 'User' }],
  needed_roles: [String],
  is_full: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const Team = mongoose.model('Team', TeamSchema);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Verify API key is set
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables');
}

// Helper function to get model
function getModel(modelName = 'gemini-1.5-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

// Try to determine which model works by testing API call
async function getWorkingModel() {
  // First, verify API key is set
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  
  const testPrompt = 'test';
  // Try these models in order (most common first)
  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-pro', 
    'gemini-pro',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-pro',
    'models/gemini-pro'
  ];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`🔍 Trying model: ${modelName}`);
      const model = getModel(modelName);
      // Make a very short test call
      const result = await model.generateContent(testPrompt);
      const response = await result.response;
      const text = response.text();
      console.log(`✅ Model ${modelName} is available and working!`);
      return model;
    } catch (error) {
      const errorMsg = error.message || error.toString();
      console.log(`❌ Model ${modelName} failed: ${errorMsg.substring(0, 150)}`);
      // If it's a 401/403, the API key is invalid
      if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('API_KEY')) {
        throw new Error('Invalid GEMINI_API_KEY. Please check your API key in the .env file.');
      }
      // Continue to next model
      continue;
    }
  }
  
  throw new Error('No working Gemini models found. Your API key may not have access to Gemini models, or the model names have changed. Please verify your GEMINI_API_KEY at https://aistudio.google.com/apikey');
}

// AI Matchmaking Helper Functions
async function calculateMatchScore(user1, user2, teamMembers = null) {
  try {
    // Use gemini-1.5-flash which is available in v1beta API
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt;

    if (teamMembers && teamMembers.length > 0) {
      // Team-based matching
      const teamSkills = teamMembers.map(m => m.skills || []).flat();
      const teamTechStack = teamMembers.map(m => m.tech_stack || []).flat();
      const teamExperience = teamMembers.map(m => m.experience || []).flat();

      prompt = `You are an AI team matchmaking system for hackathons. Evaluate how well a candidate user would complement an existing team.

EXISTING TEAM:
- Combined Skills: ${[...new Set(teamSkills)].join(', ') || 'None'}
- Tech Stack: ${[...new Set(teamTechStack)].join(', ') || 'None'}
- Experience: ${[...new Set(teamExperience)].join(', ') || 'None'}
- Team Size: ${teamMembers.length} members

CANDIDATE USER:
- Name: ${user2.name || 'Unknown'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}
- School: ${user2.school || 'Not specified'}
- Location: ${user2.location || 'Not specified'}

EVALUATION CRITERIA:
1. Role Complementarity: Does this candidate fill gaps in the team? (e.g., if team has 2 coders, prioritize a Designer)
2. Tech Stack Alignment: Can they work with the team's existing tech stack?
3. Skill Diversity: Do they add unique value without too much overlap?
4. Team Balance: Will they help create a well-rounded 4-person team?

Respond with a JSON object in this exact format:
{
  "score": <number 0-100>,
  "reason": "<brief explanation of why this is a good/bad match>",
  "category": "<Strong|Good|Okay|Bad>",
  "needed_roles": ["<role1>", "<role2>"] (what roles the team needs)
}`;
    } else {
      // One-on-one matching with Current User logic
      const CURRENT_USER_ID = '6958c084d6d4ea1f109dad70';
      const isCurrentUser = user1._id.toString() === CURRENT_USER_ID;

      if (isCurrentUser) {
        // Current User: Full Stack, VR, AI Engineering (Unity, Swift, Python)
        // High scores for: Backend (Node.js/Go), 3D Modeling, Design
        // Low scores for: Only Swift/Unity (skill overlap)
        prompt = `You are a HARSH hackathon judge. Do NOT give neutral scores. Be aggressive in your scoring.

CURRENT USER (Me):
- Name: ${user1.name || 'Unknown'}
- Skills: ${(user1.skills || []).join(', ') || 'Full Stack, VR, AI Engineering'}
- Tech Stack: ${(user1.tech_stack || []).join(', ') || 'Unity, Swift, Python'}
- Experience: ${(user1.experience || []).join(', ') || 'VR development, Mobile apps, AI/ML'}
- Bio: ${user1.description || 'Full Stack developer specializing in VR and AI'}
- Role: ${user1.role_preference || 'Full Stack'}

TARGET USER:
- Name: ${user2.name || 'Unknown'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}
- Bio: ${user2.description || 'No bio provided'}
- Role: ${user2.role_preference || 'Not specified'}

SCORING RULES (BE STRICT):
1. Score ABOVE 90%: Skills are PERFECTLY complementary (e.g., Unity/VR vs. Go/Backend, Swift/Mobile vs. Node.js/Backend, Python/AI vs. 3D Modeling/Design)
2. Score 60-85%: Skills are somewhat complementary but not perfect
3. Score BELOW 40%: Skills are nearly IDENTICAL (e.g., both know Swift/Unity, both know Python/AI with same focus)
4. DO NOT give scores around 50% - be decisive!

Examples:
- Unity + Swift (current) vs. Go + Node.js (target) = 95% (perfect complement)
- Unity + Swift (current) vs. Swift + Unity (target) = 30% (too similar)
- Unity + Swift (current) vs. React + Frontend (target) = 70% (somewhat complementary)

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "reason": "<brief 1-sentence explanation why this is a good/bad match>",
  "category": "<Strong Match|Good Match|Okay Match>"
}`;
      } else {
        // Generic matching
        prompt = `You are a HARSH hackathon judge. Do NOT give neutral scores. Be aggressive in your scoring.

USER 1:
- Name: ${user1.name || 'Unknown'}
- Skills: ${(user1.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user1.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user1.experience || []).join(', ') || 'None listed'}
- Bio: ${user1.description || 'No bio provided'}
- Role: ${user1.role_preference || 'Not specified'}

USER 2:
- Name: ${user2.name || 'Unknown'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}
- Bio: ${user2.description || 'No bio provided'}
- Role: ${user2.role_preference || 'Not specified'}

SCORING RULES (BE STRICT):
1. Score ABOVE 90%: Skills are PERFECTLY complementary (e.g., Frontend + Backend, Designer + Developer)
2. Score 60-85%: Skills are somewhat complementary but not perfect
3. Score BELOW 40%: Skills are nearly IDENTICAL (avoid duplication)
4. DO NOT give scores around 50% - be decisive!

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "reason": "<brief explanation>",
  "category": "<Strong Match|Good Match|Okay Match>"
}`;
      }
    }

    console.log(`🤖 Calling Gemini API for match: ${user1.name || user1._id} vs ${user2.name || user2._id}`);

    let result;
    let response;
    let text;

    try {
      result = await model.generateContent(prompt);
      response = await result.response;
      text = response.text().trim();

      console.log(`✅ Gemini API response received (length: ${text.length})`);
      console.log(`📝 Raw response preview: ${text.substring(0, 200)}...`);
    } catch (apiError) {
      console.error('❌ Gemini API call failed:', apiError);
      throw new Error(`Gemini API error: ${apiError.message}`);
    }

    // Try to parse JSON from response
    let matchData;
    try {
      // Remove markdown code blocks if present
      let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Extract JSON from text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        matchData = JSON.parse(jsonMatch[0]);
      } else {
        matchData = JSON.parse(cleanedText);
      }

      console.log(`✅ Parsed match data:`, matchData);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError.message);
      console.error('📝 Raw response:', text);
      // Don't default to 50 - throw error instead
      throw new Error(`Failed to parse Gemini response: ${parseError.message}. Raw response: ${text.substring(0, 500)}`);
    }

    // Validate score exists and is a number
    if (typeof matchData.score !== 'number' && typeof matchData.score !== 'string') {
      console.error('❌ Invalid score in response:', matchData);
      throw new Error(`Invalid score format in Gemini response: ${JSON.stringify(matchData)}`);
    }

    // Validate and normalize score
    const score = Math.max(0, Math.min(100, parseInt(matchData.score) || 0));

    if (score === 0 && !matchData.score) {
      console.error('❌ Score is 0 or missing:', matchData);
      throw new Error(`Score is missing or invalid in response: ${JSON.stringify(matchData)}`);
    }

    console.log(`📊 Final match score: ${score}%`);

    // Normalize category to match expected format
    let category = matchData.category || 'Okay Match';
    if (score >= 90) {
      category = 'Strong Match';
    } else if (score >= 60) {
      category = 'Good Match';
    } else {
      category = 'Okay Match';
    }
    
    return {
      score: score,
      reason: matchData.reason || 'Match evaluation completed',
      category: category,
      needed_roles: matchData.needed_roles || []
    };
  } catch (error) {
    console.error('Error calculating match score:', error);
    return {
      score: 50,
      reason: 'Error calculating match score',
      category: 'Okay',
      needed_roles: []
    };
  }
}

// GET /hackathons - Fetch all hackathons from MongoDB
app.get('/hackathons', async (req, res) => {
  try {
    console.log('Fetching hackathons from MongoDB...');
    const hackathons = await Hackathon.find();
    console.log(`Found ${hackathons.length} hackathons in database`);

    // Map to frontend format
    const formatted = hackathons.map(hackathon => {
      let start_date = null;
      let end_date = null;

      if (hackathon.startDate) {
        try {
          start_date = new Date(hackathon.startDate).toISOString().split('T')[0];
        } catch (e) {
          console.warn('Invalid startDate format:', hackathon.startDate);
        }
      }

      if (hackathon.endDate) {
        try {
          end_date = new Date(hackathon.endDate).toISOString().split('T')[0];
        } catch (e) {
          console.warn('Invalid endDate format:', hackathon.endDate);
        }
      }

      const result = {
        id: hackathon._id.toString(),
        name: hackathon.name || 'Hackathon Event',
        start_date: start_date,
        end_date: end_date,
        location: hackathon.location || 'Location TBD',
        url: hackathon.url || 'https://mlh.io',
        logo: hackathon.logo || null,
        imageUrl: hackathon.imageUrl || null, // Include imageUrl field from MongoDB
        description: hackathon.description || '',
        type: hackathon.type || ''
      };
      
      // Debug: Log if imageUrl exists
      if (hackathon.imageUrl) {
        console.log(`✅ Backend: Found imageUrl for ${result.name}:`, hackathon.imageUrl);
      }
      
      return result;
    }).sort((a, b) => {
      // Sort by start date, with null dates at the end
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date) - new Date(b.start_date);
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching hackathons:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /hackathons/mlh - Deprecated: All hackathons come from MongoDB via /hackathons
app.get('/hackathons/mlh', async (req, res) => {
  res.status(200).json({ 
    message: 'This endpoint is deprecated. All hackathon data comes from MongoDB. Use GET /hackathons instead.',
    redirect: '/hackathons'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Hackathon Team Matcher API is running!' });
});

// Health check with route list
app.get('/health', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(', ');
      routes.push(`${methods} ${middleware.route.path}`);
    }
  });
  res.json({
    status: 'ok',
    routes: routes.filter(r => r.includes('match-score') || r.includes('team') || r.includes('/users'))
  });
});

// Test endpoint to verify match-score route exists
app.get('/test-match-score', (req, res) => {
  res.json({ message: 'Match-score route is accessible', path: '/match-score' });
});

// GET all users (optionally filtered by hackathon registration)
app.get('/users', async (req, res) => {
  const { hackathonId } = req.query;
  const currentUserId = '6958c084d6d4ea1f109dad70'; // Hardcoded current user ID

  try {
    // Ensure hackathonId is treated as a string (as stored in registered_hackathons array)
    const hackathonIdString = hackathonId ? String(hackathonId) : null;

    // Build query: filter by hackathon registration if hackathonId is provided
    // registered_hackathons is an array of strings, so direct equality works
    const query = hackathonIdString
      ? {
        registered_hackathons: hackathonIdString,
        _id: { $ne: currentUserId }
      }
      : {
        _id: { $ne: currentUserId }
      };

    if (hackathonIdString) {
      console.log("🔍 Filtering users for hackathon ID (as string):", hackathonIdString);
      console.log("📋 Query:", JSON.stringify(query, null, 2));
    } else {
      console.log("⚠️ No hackathonId provided, returning all users (excluding current user)");
    }

    const users = await User.find(query);
    console.log(`✅ Found ${users.length} users${hackathonIdString ? ` registered for hackathon ${hackathonIdString}` : ' (all users)'}`);

    // Verify filtering worked by checking first few users
    if (users.length > 0 && hackathonIdString) {
      console.log("📋 Verification - First 3 users' registered_hackathons:");
      users.slice(0, 3).forEach((user, i) => {
        const hasHackathon = user.registered_hackathons?.includes(hackathonIdString);
        console.log(`   ${i + 1}. ${user.name}: [${user.registered_hackathons?.join(', ') || 'none'}] - Contains hackathonId: ${hasHackathon}`);
      });
    }

    res.json(users);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /api/users - Return all users with match scores
app.get('/api/users', async (req, res) => {
  try {
    // For now, we'll use the first user as the "current user"
    // In production, you'd get this from authentication/session
    const currentUserId = req.query.currentUserId || null;
    
    const allUsers = await User.find({});
    
    // If no current user specified, return users without match scores
    if (!currentUserId) {
      return res.json(allUsers.map(user => ({
        ...user.toObject(),
        matchScore: 5,
        matchCategory: 'okay'
      })));
    }
    
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }
    
    // Calculate match scores for each user
    const usersWithScores = await Promise.all(
      allUsers
        .filter(user => user._id.toString() !== currentUserId)
        .map(async (user) => {
          const matchData = await calculateMatchScore(currentUser, user);
          return {
            ...user.toObject(),
            matchScore: matchData.matchScore,
            matchCategory: matchData.matchCategory
          };
        })
    );
    
    res.json(usersWithScores);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Helper function to fetch GitHub data
async function fetchGithubData(username) {
  try {
    console.log('📋 Fetching GitHub repos for:', username);
    const response = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`);
    const repos = response.data.map(repo => ({
      name: repo.name,
      description: repo.description || '',
      language: repo.language || 'N/A',
      topics: repo.topics || []
    }));
    return JSON.stringify(repos);
  } catch (error) {
    console.error('❌ GitHub API error:', error.message);
    throw new Error('GitHub profile not found or private.');
  }
}

// POST /api/onboarding/analyze - AI Profiler for GitHub/Resume
app.post('/api/onboarding/analyze', async (req, res) => {
  try {
    console.log('🔍 POST /api/onboarding/analyze - Request received');
    console.log('📋 Request body keys:', Object.keys(req.body));
    
    // Check if API key is set
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'AI service is not configured. Please set GEMINI_API_KEY in .env file.' });
    }
    
    const { githubUrl, resumeText, resumeBase64 } = req.body;
    
    if (!githubUrl && !resumeText && !resumeBase64) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ error: 'Either githubUrl, resumeText, or resumeBase64 is required' });
    }
    
    // Try to get a working model
    let model;
    try {
      model = await getWorkingModel();
      console.log('✅ Gemini model initialized successfully');
    } catch (modelError) {
      console.error('❌ Error finding working Gemini model:', modelError);
      return res.status(500).json({ 
        error: 'No working Gemini models found. Please check your GEMINI_API_KEY and ensure you have access to Gemini models.', 
        details: modelError.message 
      });
    }
    let dataToAnalyze = '';
    
    // Handle GitHub URL
    if (githubUrl) {
      try {
        // Extract username from GitHub URL
        const username = githubUrl.replace(/https?:\/\/(www\.)?github\.com\//, '').split('/')[0].split('?')[0];
        console.log('📋 Extracted username:', username);
        
        dataToAnalyze = await fetchGithubData(username);
        console.log('✅ GitHub data fetched successfully');
      } catch (githubError) {
        console.error('❌ Error fetching GitHub data:', githubError);
        return res.status(400).json({ error: githubError.message || 'Failed to fetch GitHub data. Check the URL.' });
      }
    }
    
    // Handle Resume (text or base64 PDF)
    if (resumeText || resumeBase64) {
      if (resumeBase64) {
        try {
          // Try to use pdf-parse if available, otherwise fallback to text extraction
          let pdfParse;
          try {
            pdfParse = (await import('pdf-parse')).default;
          } catch (e) {
            console.log('⚠️ pdf-parse not available, using text fallback');
            pdfParse = null;
          }
          
          if (pdfParse) {
            // Decode base64 and parse PDF
            const pdfBuffer = Buffer.from(resumeBase64, 'base64');
            const pdfData = await pdfParse(pdfBuffer);
            dataToAnalyze = pdfData.text;
            console.log('✅ PDF parsed successfully (length:', dataToAnalyze.length, ')');
          } else {
            // Fallback: try to extract text from base64
            dataToAnalyze = resumeText || Buffer.from(resumeBase64, 'base64').toString('utf-8');
            console.log('⚠️ Using text fallback for resume (length:', dataToAnalyze.length, ')');
          }
        } catch (pdfError) {
          console.error('❌ Error parsing PDF:', pdfError);
          // Fallback to text if PDF parsing fails
          dataToAnalyze = resumeText || Buffer.from(resumeBase64, 'base64').toString('utf-8');
        }
      } else {
        dataToAnalyze = resumeText;
      }
      console.log('📋 Analyzing resume text (length:', dataToAnalyze.length, ')');
    }
    
    // Improved Gemini prompt
    const prompt = `Analyze the following data: ${dataToAnalyze}

Extract the following into a JSON object:
- name: (String, full name if available)
- email: (String, email if available, otherwise empty string)
- role_preference: (String, one of: Frontend, Backend, Full Stack, Mobile, AI/ML, DevOps, Design)
- skills: (Array of Strings, e.g., ["React", "Node.js", "Python"])
- tech_stack: (Array of Strings, top 5-10 languages/frameworks/tools)
- experience: (Array of Strings, job titles and companies, e.g., ["Software Engineer @ Company"])
- school: (String, university/school name)
- location: (String, city, state or city, country)
- github: (String, GitHub username only, no URL)
- devpost: (String, Devpost username if available, otherwise empty)
- description: (String, short 2-sentence professional bio about their interests/goals)
- num_hackathons: (String, number as string, e.g., "5", infer from projects/hackathon mentions)

Return ONLY raw JSON, no markdown code blocks.`;

    console.log('🤖 Calling Gemini API...');
    console.log('📝 Prompt length:', prompt.length);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log('✅ Gemini API response received (length:', text.length, ')');
    console.log('📝 Raw response preview:', text.substring(0, 200));
    
    // Parse JSON from response
    let userData;
    try {
      // Remove markdown code blocks
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        userData = JSON.parse(jsonMatch[0]);
      } else {
        userData = JSON.parse(cleanedText);
      }
      
      console.log('✅ AI profile analysis complete');
      console.log('📋 Extracted data:', JSON.stringify(userData, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw response:', text);
      return res.status(500).json({ 
        error: 'AI Analysis failed. Could not parse response.', 
        details: text.substring(0, 500),
        parseError: parseError.message
      });
    }
    
    res.json(userData);
  } catch (error) {
    console.error('❌ Error in /api/onboarding/analyze:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'AI Analysis failed.';
    if (error.message && error.message.includes('API_KEY')) {
      errorMessage = 'Invalid or missing GEMINI_API_KEY. Please check your .env file.';
    } else if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
      errorMessage = 'Gemini model not found. The API may have changed.';
    } else if (error.message && (error.message.includes('quota') || error.message.includes('limit'))) {
      errorMessage = 'API quota exceeded. Please check your Google Cloud billing.';
    } else {
      errorMessage = error.message || 'AI Analysis failed. Check your API Key or Input.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      name: error.name
    });
  }
});

// PUT /api/users/:id - Update user profile (for onboarding save)
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userData, selectedHackathons } = req.body;
    
    console.log('💾 Updating user profile for ID:', id);
    console.log('📋 User data:', userData);
    console.log('📋 Selected hackathons:', selectedHackathons);
    
    if (!userData || !userData.name) {
      return res.status(400).json({ error: 'User data with name is required' });
    }
    
    // Prepare update data
    const updateData = {
      ...userData,
      registered_hackathons: selectedHackathons || []
    };
    
    // Use findByIdAndUpdate to save the form data into the user document
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ User profile updated successfully:', updatedUser._id);
    res.status(200).json({
      success: true,
      user: updatedUser,
      message: 'Profile saved successfully'
    });
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    res.status(500).json({ error: error.message || 'Update failed' });
  }
});

// POST /api/onboarding/save - Save user profile (backward compatibility)
app.post('/api/onboarding/save', async (req, res) => {
  try {
    const { userData, selectedHackathons } = req.body;
    
    // Hardcoded user ID for demo
    const userId = '6958c084d6d4ea1f109dad70';
    
    console.log('💾 Saving user profile (POST /api/onboarding/save)...');
    console.log('📋 User data:', userData);
    console.log('📋 Selected hackathons:', selectedHackathons);
    
    if (!userData || !userData.name) {
      return res.status(400).json({ error: 'User data with name is required' });
    }
    
    // Prepare update data
    const updateData = {
      ...userData,
      registered_hackathons: selectedHackathons || []
    };
    
    // Use findByIdAndUpdate to save the form data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ User profile saved successfully:', updatedUser._id);
    res.json({ 
      success: true, 
      userId: updatedUser._id,
      message: 'Profile saved successfully'
    });
  } catch (error) {
    console.error('❌ Error saving user profile:', error);
    res.status(500).json({ error: error.message || 'Update failed' });
  }
});

// POST /match-score - AI Matchmaking endpoint
app.post('/match-score', async (req, res) => {
  try {
    let { currentUser, targetUser, user1_id, user2_id, team_member_ids } = req.body;

    console.log(`🔍 POST /match-score request received`);

    // 1. Resolve Users: Handle both Direct Objects (from Prompt) and IDs (from Frontend)
    if (!currentUser && user1_id) {
      currentUser = await User.findById(user1_id) || await User.findOne({ _id: user1_id });
    }
    if (!targetUser && user2_id) {
      targetUser = await User.findById(user2_id) || await User.findOne({ _id: user2_id });
    }

    // Validation
    if (!currentUser || !targetUser) {
      console.error('❌ Missing users for matchmaking');
      return res.status(404).json({ error: 'Users not found', details: 'Provide currentUser/targetUser objects OR user1_id/user2_id' });
    }

    console.log(`✅ Matchmaking for: ${currentUser.name} vs ${targetUser.name}`);

    // 2. Prepare Matchmaking Logic
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Construct the requested System Prompt
    const prompt = `You are a hackathon matchmaking agent. Compare the skills and roles of User A and User B. 
    
    User A (Current User):
    - Role: ${currentUser.role_preference || 'Unspecified'}
    - Skills: ${Array.isArray(currentUser.skills) ? currentUser.skills.join(', ') : currentUser.skills || 'None'}
    - Tech Stack: ${Array.isArray(currentUser.tech_stack) ? currentUser.tech_stack.join(', ') : currentUser.tech_stack || 'None'}
    
    User B (Target User):
    - Role: ${targetUser.role_preference || 'Unspecified'}
    - Skills: ${Array.isArray(targetUser.skills) ? targetUser.skills.join(', ') : targetUser.skills || 'None'}
    - Tech Stack: ${Array.isArray(targetUser.tech_stack) ? targetUser.tech_stack.join(', ') : targetUser.tech_stack || 'None'}

    If User A is a VR/Mobile dev (Unity/Swift) and User B is a Backend/Cloud dev (Go/Node/Kubernetes), give a score > 90%. 
    If they overlap (both Unity), give a score < 40%. 
    
    Return ONLY JSON: {"score": number, "reason": "string", "category": "Strong Match|Good Match|Okay Match"}`;

    // 3. Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    console.log(`🤖 Gemini JSON Response: ${text}`);

    // 4. Parse JSON Securely
    let matchData;
    try {
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      matchData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response:', text);
      // Fallback if AI fails to return valid JSON
      return res.json({ score: 50, reason: "AI response error, defaulting score.", category: "Okay Match" });
    }

    res.json(matchData);

  } catch (error) {
    console.error('❌ Error in POST /match-score:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST request to send team request
app.post('/request', async (req, res) => {
  try {
    const { from_user_id, to_user_id, message, hackathon_id } = req.body;

    // Check if user already sent 5 requests for this hackathon
    const requestCount = await Request.countDocuments({
      from_user_id,
      hackathon_id: hackathon_id || null,
      status: 'pending'
    });

    if (requestCount >= 5) {
      return res.status(400).json({ error: 'Maximum 5 requests allowed' });
    }

    const newRequest = await Request.create({
      from_user_id,
      to_user_id,
      hackathon_id: hackathon_id || null,
      message: message || '',
      status: 'pending'
    });

    res.json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /team/:userId - Get user's team
// GET /team/:userId - Get user's team
app.get('/team/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🔍 GET /team/:userId - userId: ${userId}`);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Find team where user is a member (check both string and ObjectId)
    const team = await Team.findOne({
      members: { $in: [userId, new mongoose.Types.ObjectId(userId)] },
      is_full: false
    });

    console.log(`📋 Team found: ${!!team}`);

    if (!team) {
      console.log(`✅ User ${userId} is not in any team`);
      return res.status(200).json({ team: null, needed_roles: [] });
    }

    // Get team members details
    const members = await User.find({ _id: { $in: team.members } });

    console.log(`✅ Team found with ${members.length} members`);

    res.status(200).json({
      team: {
        ...team.toObject(),
        members_details: members
      },
      needed_roles: team.needed_roles || []
    });
  } catch (error) {
    console.error('❌ Error in GET /team/:userId:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /team - Create or join team
app.post('/team', async (req, res) => {
  try {
    const { hackathon_id, user_id } = req.body;

    if (!hackathon_id || !user_id) {
      return res.status(400).json({ error: 'hackathon_id and user_id are required' });
    }

    // Check if user is already in a team
    const existingTeam = await Team.findOne({
      members: user_id,
      is_full: false
    });

    if (existingTeam) {
      return res.json(existingTeam);
    }

    // Create new team or join existing
    let team = await Team.findOne({
      hackathon_id,
      is_full: false
    });

    if (!team) {
      team = await Team.create({
        hackathon_id,
        members: [user_id],
        needed_roles: [],
        is_full: false
      });
    } else {
      if (team.members.length >= 4) {
        return res.status(400).json({ error: 'Team is full' });
      }
      team.members.push(user_id);
      await team.save();
    }

    // Check if team is now full (4 members)
    if (team.members.length === 4) {
      team.is_full = true;
      await team.save();

      // Auto-cancel all pending requests for these 4 users
      await Request.updateMany(
        {
          $or: [
            { from_user_id: { $in: team.members }, status: 'pending' },
            { to_user_id: { $in: team.members }, status: 'pending' }
          ]
        },
        { status: 'cancelled' }
      );
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/request - Create a team request
app.post('/api/request', async (req, res) => {
  try {
    const { from_user_id, to_user_id } = req.body;
    
    if (!from_user_id || !to_user_id) {
      return res.status(400).json({ error: 'from_user_id and to_user_id are required' });
    }
    
    // Check if request already exists
    const existingRequest = await Request.findOne({
      from_user_id,
      to_user_id
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Request already sent' });
    }
    
    // Check request limit (5 per user)
    const requestCount = await Request.countDocuments({
      from_user_id,
      status: 'pending'
    });
    
    if (requestCount >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 pending requests allowed' });
    }
    
    // Create new request
    const newRequest = new Request({
      from_user_id,
      to_user_id,
      status: 'pending'
    });
    
    await newRequest.save();
    
    res.status(201).json({
      message: 'Request sent successfully',
      request: newRequest
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// GET /api/requests/:userId - Get user's sent requests count
app.get('/api/requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const requestCount = await Request.countDocuments({
      from_user_id: userId,
      status: 'pending'
    });
    
    res.json({
      userId,
      requestCount,
      maxRequests: 5
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint - Get all users
app.get('/test', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Test endpoint - Test Gemini API key and models
app.get('/test-gemini', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY not set',
        help: 'Add GEMINI_API_KEY to your .env file. Get one at https://aistudio.google.com/apikey'
      });
    }
    
    console.log('🔍 Testing Gemini API key...');
    const testPrompt = 'Say "Hello"';
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-pro', 
      'gemini-pro'
    ];
    
    const results = [];
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        const text = response.text();
        results.push({ model: modelName, status: '✅ Working', response: text.substring(0, 50) });
        console.log(`✅ ${modelName} works!`);
      } catch (error) {
        const errorMsg = error.message || error.toString();
        results.push({ 
          model: modelName, 
          status: '❌ Failed', 
          error: errorMsg.substring(0, 200) 
        });
        console.log(`❌ ${modelName} failed: ${errorMsg.substring(0, 100)}`);
      }
    }
    
    const workingModels = results.filter(r => r.status === '✅ Working');
    if (workingModels.length === 0) {
      return res.status(500).json({
        error: 'No working models found',
        results: results,
        help: 'Your API key may be invalid or not have access to Gemini models. Get a new key at https://aistudio.google.com/apikey'
      });
    }
    
    res.json({
      success: true,
      workingModels: workingModels.map(m => m.model),
      allResults: results,
      message: `Found ${workingModels.length} working model(s)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler for undefined routes (must be after all routes)
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📋 Available routes:`);
  console.log(`   GET  /users?hackathonId=...`);
  console.log(`   GET  /team/:userId`);
  console.log(`   POST /match-score`);
  console.log(`   POST /request`);
  console.log(`   POST /api/onboarding/analyze`);
  console.log(`   PUT  /api/users/:id`);
  console.log(`   GET  /hackathons`);
  console.log(`   POST /team`);
  console.log(`\n✅ All routes registered successfully!`);
});

