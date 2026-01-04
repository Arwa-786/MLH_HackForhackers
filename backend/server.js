import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Octokit for GitHub API
let octokit = null;
if (process.env.GITHUB_TOKEN) {
  octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });
  console.log('✅ GitHub integration enabled');
} else {
  console.log('⚠️ GITHUB_TOKEN not set - GitHub features disabled');
}

// Note: genAI is initialized later in the file (around line 280)

// Tool: Create GitHub Repository
// This function will be registered with Gemini as a callable tool
async function createGitHubRepo(teamId, repoName, description = null) {
  try {
    if (!octokit) {
      throw new Error('GitHub integration not configured. GITHUB_TOKEN not set in .env');
    }
    
    if (!teamId) {
      throw new Error('teamId is required');
    }
    
    // Get team info
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!team) {
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    if (!team) {
      throw new Error('Team not found');
    }
    
    // Get team members with GitHub usernames
    const members = await User.find({ _id: { $in: team.members.map(id => id.toString()) } });
    const githubUsernames = members
      .map(m => m.github)
      .filter(github => github && github.trim())
      .map(github => github.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '').trim());
    
    if (githubUsernames.length === 0) {
      throw new Error('No team members have GitHub usernames configured in their profiles');
    }
    
    // Generate repository name
    const finalRepoName = repoName 
      ? repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 100)
      : `hackathon-${team.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'project'}-${Date.now()}`;
    
    // Get the authenticated user (token owner) to create the repo
    const { data: authUser } = await octokit.users.getAuthenticated();
    const repoOwner = authUser.login;
    
    console.log(`📦 Creating repository: ${repoOwner}/${finalRepoName}`);
    
    // Create repository
    const repo = await octokit.repos.createForAuthenticatedUser({
      name: finalRepoName,
      description: description || `Hackathon project: ${team.name || 'Team Project'}`,
      private: false,
      auto_init: true // Initialize with README
    });
    
    console.log(`✅ Repository created: ${repo.data.full_name}`);
    
    const repoFullName = repo.data.full_name;
    const [owner, name] = repoFullName.split('/');
    
    // Invite team members to the repository
    const inviteResults = [];
    for (const username of githubUsernames) {
      // Skip if it's the repo owner
      if (username === repoOwner) {
        inviteResults.push({ username, status: 'owner' });
        continue;
      }
      
      try {
        await octokit.repos.addCollaborator({
          owner,
          repo: name,
          username,
          permission: 'push'
        });
        inviteResults.push({ username, status: 'invited' });
        console.log(`✅ Invited ${username} to repository`);
      } catch (inviteError) {
        console.log(`⚠️ Could not invite ${username}:`, inviteError.message);
        inviteResults.push({ username, status: 'failed', error: inviteError.message });
      }
    }
    
    // Generate Replit import URL
    const replitUrl = `https://replit.com/github/${owner}/${name}`;
    
    // Update team with repository info
    await Team.findByIdAndUpdate(
      team._id,
      { 
        $set: { 
          github_repo: repoFullName,
          github_repo_url: repo.data.html_url,
          replit_url: replitUrl
        } 
      }
    );
    
    // Post a new message in the chat with the GitHub link
    const githubMessage = {
      senderId: 'ai_bot',
      text: `✅ GitHub repository created successfully!\n\n🔗 Repository: ${repoFullName}\n📦 URL: ${repo.data.html_url}\n\nYou can now start pushing code to your repository. The Replit import URL is: ${replitUrl}`,
      timestamp: new Date()
    };
    
    await Team.findByIdAndUpdate(
      team._id,
      { $push: { messages: githubMessage } },
      { new: true }
    );
    
    return {
      success: true,
      repository: {
        name: repoFullName,
        url: repo.data.html_url,
        clone_url: repo.data.clone_url
      },
      replit_url: replitUrl,
      invites: inviteResults
    };
  } catch (error) {
    console.error('❌ Error in createGitHubRepo tool:', error);
    throw error;
  }
}

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

// Enable Mongoose debug mode to see queries (optional, can disable in production)
// mongoose.set('debug', true);

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
// Note: _id is explicitly defined as String since MongoDB stores IDs as strings in this database
const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true },
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
  bio: String, // Support both description and bio fields
  registered_hackathons: [String] // Array of hackathon IDs
}, { _id: true }); // Explicitly enable _id field

const User = mongoose.model('User', UserSchema);

// Request Schema
const RequestSchema = new mongoose.Schema({
  from_user_id: String,
  fromUserId: String, // Support camelCase
  to_user_id: String,
  toUserId: String, // Support camelCase
  hackathon_id: String,
  hackathonId: String, // Support camelCase
  status: { type: String, default: 'pending' },
  message: String,
  createdAt: { type: Date, default: Date.now }
}, { strict: false }); // Allow fields not in schema (for flexibility)

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
// Support both hackathon_id (snake_case) and hackathonId (camelCase) for manually created teams
const TeamSchema = new mongoose.Schema({
  hackathon_id: String,
  hackathonId: String, // Support camelCase for manually created teams
  name: String, // Team name (e.g., "Team 1", "Team 2")
  members: [{ type: String, ref: 'User' }],
  needed_roles: [String],
  is_full: { type: Boolean, default: false },
  messages: [{
    senderId: String,
    text: String,
    timestamp: { type: Date, default: Date.now },
    action: String, // Action type (e.g., 'CREATE_REPO')
    actionType: String, // Action type (e.g., 'GITHUB_INIT')
    github_action: { type: Boolean, default: false }, // Flag for GitHub action buttons (backward compatibility)
    project_name: String, // Project name for GitHub repo
    repoName: String // Repository name for CREATE_REPO action
  }],
  github_repo: String, // Full repo name (owner/repo)
  github_repo_url: String, // GitHub repository URL
  replit_url: String, // Replit import URL
  created_at: { type: Date, default: Date.now }
}, { strict: false }); // Allow additional fields like hackathonId

const Team = mongoose.model('Team', TeamSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
  team_id: String,
  user_id: String,
  user_name: String, // Store name for quick access
  message: String,
  is_ai: { type: Boolean, default: false }, // True if message is from AI bot
  created_at: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', MessageSchema);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Verify API key is set
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables');
}

// Helper function to get model
function getModel(modelName = 'gemini-2.5-flash') {
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
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro', 
    'gemini-pro',
    'models/gemini-2.5-flash',
    'models/gemini-2.5-pro',
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
    // Use gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt;

    if (teamMembers && teamMembers.length > 0) {
      // Team-based matching
      const teamSkills = teamMembers.map(m => m.skills || []).flat();
      const teamTechStack = teamMembers.map(m => m.tech_stack || []).flat();
      const teamExperience = teamMembers.map(m => m.experience || []).flat();

      prompt = `You are a STRICT TECHNICAL RECRUITER evaluating a hackathon team candidate. Be harsh and precise.

EXISTING TEAM:
- Combined Skills: ${[...new Set(teamSkills)].join(', ') || 'None'}
- Tech Stack: ${[...new Set(teamTechStack)].join(', ') || 'None'}
- Experience: ${[...new Set(teamExperience)].join(', ') || 'None'}
- Team Size: ${teamMembers.length} members
- Primary Roles: ${teamMembers.map(m => m.role_preference || 'Unspecified').join(', ')}

CANDIDATE USER:
- Name: ${user2.name || 'Unknown'}
- Primary Role: ${user2.role_preference || 'Unspecified'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}

STRICT EVALUATION RULES:

1. ROLE CHECK (CRITICAL):
   - If candidate's primary role matches ANY existing team member's role EXACTLY (e.g., both are ONLY "Frontend"), apply -30% penalty for "Skill Redundancy"
   - Only award points if candidate fills a MISSING role (e.g., team has Frontend/Backend, candidate is Designer = GOOD)

2. STACK SYNERGY (ONLY COMPLEMENTARY):
   - Award points ONLY for complementary tech stacks:
     * Node.js (Backend) + React (Frontend) = +40%
     * Python (Backend) + React (Frontend) = +40%
     * Unity (Game) + Backend API = +40%
   - DO NOT award points for overlapping stacks (e.g., both have React = -20%)
   - If candidate's tech stack perfectly complements team's gaps, award +40%

3. SCORE SCALE (BE STRICT):
   - 90-100%: "Dream Team" - Perfect full-stack coverage (Frontend + Backend + Design + DevOps/Mobile), NO role overlap, complementary tech stacks
   - 70-89%: "Strong Match" - 1-2 minor skill overlaps, but fills critical missing role
   - 40-69%: "Average Match" - Too much overlap OR missing a key role (e.g., no Backend, no Design)
   - Below 40%: "Weak Match" - Exact same skills/role OR no tech stack provided

4. REASONING FORMAT (REQUIRED):
   - List exactly ONE "Pros" (what makes this a good match)
   - List exactly ONE "Major Risk" (what could go wrong)

IMPORTANT: Only return "Strong Match" (score >= 85) or "Good Match" (score >= 60). 
If the match score is below 60, still return the score but set category to "Good Match".

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "reason": "Pros: <exactly one pro>. Major Risk: <exactly one risk>",
  "category": "<Strong Match|Good Match>",
  "needed_roles": ["<role1>", "<role2>"]
}`;
    } else {
      // One-on-one matching with Current User logic
      const CURRENT_USER_ID = '6958c084d6d4ea1f109dad70';
      const isCurrentUser = user1._id.toString() === CURRENT_USER_ID;

      if (isCurrentUser) {
        // Current User: Full Stack, VR, AI Engineering (Unity, Swift, Python)
        // High scores for: Backend (Node.js/Go), 3D Modeling, Design
        // Low scores for: Only Swift/Unity (skill overlap)
        prompt = `You are a STRICT TECHNICAL RECRUITER evaluating a hackathon teammate match. Be harsh and precise.

CURRENT USER (Me):
- Name: ${user1.name || 'Unknown'}
- Primary Role: ${user1.role_preference || 'Full Stack'}
- Skills: ${(user1.skills || []).join(', ') || 'Full Stack, VR, AI Engineering'}
- Tech Stack: ${(user1.tech_stack || []).join(', ') || 'Unity, Swift, Python'}
- Experience: ${(user1.experience || []).join(', ') || 'VR development, Mobile apps, AI/ML'}
- Bio: ${user1.description || user1.bio || 'Full Stack developer specializing in VR and AI'}

TARGET USER:
- Name: ${user2.name || 'Unknown'}
- Primary Role: ${user2.role_preference || 'Not specified'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}
- Bio: ${user2.description || user2.bio || 'No bio provided'}

STRICT EVALUATION RULES:

1. ROLE CHECK (CRITICAL):
   - If both users have the SAME primary role (e.g., both are ONLY "Frontend"), apply -30% penalty for "Skill Redundancy"
   - Only award high scores if roles are complementary (e.g., Frontend + Backend, Developer + Designer)

2. STACK SYNERGY (ONLY COMPLEMENTARY):
   - Award points ONLY for complementary tech stacks:
     * Unity/Swift (Mobile/VR) + Node.js/Go (Backend) = +40%
     * Python (Backend) + React (Frontend) = +40%
     * Unity (Game) + Backend API = +40%
   - DO NOT award points for overlapping stacks (e.g., both have Unity/Swift = -30% penalty)
   - If tech stacks perfectly complement each other, award +40%

3. SCORE SCALE (BE STRICT):
   - 90-100%: "Dream Team" - Perfect full-stack coverage, NO role overlap, complementary tech stacks (e.g., Unity/Swift + Node.js/Go + React + Design)
   - 70-89%: "Strong Match" - 1-2 minor skill overlaps, but fills critical missing role (e.g., Frontend + Backend)
   - 40-69%: "Average Match" - Too much overlap OR missing a key role (e.g., both Frontend, no Backend)
   - Below 40%: "Weak Match" - Exact same skills/role OR no tech stack provided

4. REASONING FORMAT (REQUIRED):
   - List exactly ONE "Pros" (what makes this a good match)
   - List exactly ONE "Major Risk" (what could go wrong)

IMPORTANT: Only return "Strong Match" (score >= 85) or "Good Match" (score >= 60). 
If the match score is below 60, still return the score but set category to "Good Match".

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "reason": "Pros: <exactly one pro>. Major Risk: <exactly one risk>",
  "category": "<Strong Match|Good Match>"
}`;
      } else {
        // Generic matching
        prompt = `You are a STRICT TECHNICAL RECRUITER evaluating a hackathon teammate match. Be harsh and precise.

USER 1:
- Name: ${user1.name || 'Unknown'}
- Primary Role: ${user1.role_preference || 'Not specified'}
- Skills: ${(user1.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user1.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user1.experience || []).join(', ') || 'None listed'}
- Bio: ${user1.description || user1.bio || 'No bio provided'}

USER 2:
- Name: ${user2.name || 'Unknown'}
- Primary Role: ${user2.role_preference || 'Not specified'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}
- Bio: ${user2.description || user2.bio || 'No bio provided'}

STRICT EVALUATION RULES:

1. ROLE CHECK (CRITICAL):
   - If both users have the SAME primary role (e.g., both are ONLY "Frontend"), apply -30% penalty for "Skill Redundancy"
   - Only award high scores if roles are complementary (e.g., Frontend + Backend, Developer + Designer)

2. STACK SYNERGY (ONLY COMPLEMENTARY):
   - Award points ONLY for complementary tech stacks:
     * Node.js/Go (Backend) + React/Vue (Frontend) = +40%
     * Python (Backend) + React (Frontend) = +40%
     * Unity (Game) + Backend API = +40%
   - DO NOT award points for overlapping stacks (e.g., both have React = -20%)
   - If tech stacks perfectly complement each other, award +40%

3. SCORE SCALE (BE STRICT):
   - 90-100%: "Dream Team" - Perfect full-stack coverage, NO role overlap, complementary tech stacks
   - 70-89%: "Strong Match" - 1-2 minor skill overlaps, but fills critical missing role
   - 40-69%: "Average Match" - Too much overlap OR missing a key role (e.g., both Frontend, no Backend)
   - Below 40%: "Weak Match" - Exact same skills/role OR no tech stack provided

4. REASONING FORMAT (REQUIRED):
   - List exactly ONE "Pros" (what makes this a good match)
   - List exactly ONE "Major Risk" (what could go wrong)

IMPORTANT: Only return "Strong Match" (score >= 85) or "Good Match" (score >= 60). 
If the match score is below 60, still return the score but set category to "Good Match".

Respond with ONLY a JSON object (no markdown, no code blocks):
{
  "score": <number 0-100>,
  "reason": "Pros: <exactly one pro>. Major Risk: <exactly one risk>",
  "category": "<Strong Match|Good Match>"
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

    // Normalize category to match expected format - only Strong Match or Good Match
    let category = matchData.category || 'Good Match';
    if (score >= 85) {
      category = 'Strong Match';
    } else {
      // For scores below 85, always show as "Good Match" (we only display Strong and Good)
      category = 'Good Match';
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
      category: 'Good Match',
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
        // Explicitly exclude 'day' field if it exists in MongoDB
      };
      
      // Remove 'day' field if it exists (to prevent "(day: X)" from appearing)
      if (result.day) {
        delete result.day;
      }
      
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

// GET /api/users/:userId - Get a single user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📥 GET /api/users/:userId - userId: ${userId}`);
    
    // Use EXACT same approach as incoming requests route (lines 1580-1600) that successfully finds users
    const userIdStr = String(userId);
    let user = await User.findOne({ _id: userIdStr });
    
    if (!user) {
      user = await User.findById(userIdStr);
    }
    
    if (!user) {
      user = await User.findOne({ _id: userId });
    }
    
    if (!user) {
      console.log(`❌ User not found: ${userIdStr}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✅ User found: ${user.name} (${user._id})`);
    res.json(user);
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ error: error.message });
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
    let { currentUser, targetUser, user1_id, user2_id, team_member_ids, hackathon_id } = req.body;

    console.log(`🔍 POST /match-score request received`);
    console.log(`📋 Request body:`, { user1_id, user2_id, hasCurrentUser: !!currentUser, hasTargetUser: !!targetUser });

    // 1. Resolve Users: Handle both Direct Objects (from Prompt) and IDs (from Frontend)
    // Since _id is stored as String in the database, search directly as string
    const findUser = async (id) => {
      if (!id) {
        console.log(`   ⚠️ No ID provided to findUser`);
        return null;
      }
      
      // Convert to string and search directly (no ObjectId conversion needed)
      const stringId = String(id).trim();
      console.log(`   🔍 Searching for ID as string: "${stringId}" (original type: ${typeof id}, original value: ${id})`);
      
      // Use findOne with string _id (since schema defines _id as String)
      let user = await User.findOne({ _id: stringId }).lean();
      
      // If not found, try findById as fallback (Mongoose may still handle it)
      if (!user) {
        console.log(`   🔄 Trying findById with string...`);
        user = await User.findById(stringId).lean();
      }
      
      // If still not found, try without .lean() to get Mongoose document
      if (!user) {
        console.log(`   🔄 Trying without .lean()...`);
        user = await User.findOne({ _id: stringId });
        if (user) {
          user = user.toObject();
        }
      }
      
      // If still not found, try exact match without any conversion
      if (!user) {
        console.log(`   🔄 Trying exact match...`);
        user = await User.findOne({ _id: id }).lean();
      }
      
      if (!user) {
        console.log(`   ⚠️ User not found with ID: ${stringId}`);
        // Debug: show what IDs exist in database
        const sampleUsers = await User.find({}).limit(5).select('_id name').lean();
        console.log(`   🔍 Sample user IDs in DB:`, sampleUsers.map(u => ({ 
          id: String(u._id), 
          idType: typeof u._id,
          idConstructor: u._id?.constructor?.name,
          name: u.name 
        })));
        console.log(`   🔍 Comparing: Looking for "${stringId}" vs DB has "${sampleUsers[0]?._id}" (match: ${String(sampleUsers[0]?._id) === stringId})`);
      } else {
        console.log(`   ✅ User found: ${user.name} (${user._id})`);
      }
      
      return user;
    };

    if (!currentUser && user1_id) {
      console.log(`🔍 Looking up user1_id: ${user1_id} (type: ${typeof user1_id})`);
      currentUser = await findUser(user1_id);
      console.log(`✅ User1 found: ${currentUser ? currentUser.name : 'NOT FOUND'}`);
    }
    
    if (!targetUser && user2_id) {
      console.log(`🔍 Looking up user2_id: ${user2_id} (type: ${typeof user2_id})`);
      targetUser = await findUser(user2_id);
      console.log(`✅ User2 found: ${targetUser ? targetUser.name : 'NOT FOUND'}`);
    }

    // Validation
    if (!currentUser || !targetUser) {
      console.error('❌ Missing users for matchmaking');
      console.error(`   user1_id: ${user1_id}, found: ${!!currentUser}`);
      console.error(`   user2_id: ${user2_id}, found: ${!!targetUser}`);
      return res.status(404).json({ error: 'Users not found', details: 'Provide currentUser/targetUser objects OR user1_id/user2_id' });
    }

    console.log(`✅ Matchmaking for: ${currentUser.name} vs ${targetUser.name}`);

    // 2. Get team members if team_member_ids provided
    let teamMembers = null;
    if (team_member_ids && team_member_ids.length > 0) {
      teamMembers = await User.find({ _id: { $in: team_member_ids } });
      console.log(`👥 Team members: ${teamMembers.length}`);
    }

    // 3. Use the existing calculateMatchScore function which handles team-based matching
    const matchData = await calculateMatchScore(currentUser, targetUser, teamMembers);
    
    console.log(`📊 Match result: ${matchData.score}% - ${matchData.category}`);
    res.json(matchData);

  } catch (error) {
    console.error('❌ Error in POST /match-score:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST request to send team request
app.post('/request', async (req, res) => {
  try {
    // Support both camelCase and snake_case from frontend
    const from_user_id = req.body.from_user_id || req.body.fromUserId;
    const to_user_id = req.body.to_user_id || req.body.toUserId;
    const hackathon_id = req.body.hackathon_id || req.body.hackathonId;
    const message = req.body.message || '';

    if (!from_user_id || !to_user_id) {
      return res.status(400).json({ error: 'from_user_id and to_user_id are required' });
    }

    // Validate that IDs are not placeholder values
    if (from_user_id.includes('placeholder') || to_user_id.includes('placeholder')) {
      return res.status(400).json({ error: 'Invalid user ID: placeholder values are not allowed' });
    }

    // Check if user already sent 5 requests for this hackathon
    // Support both field name formats
    const requestCount = await Request.countDocuments({
      $or: [
        { from_user_id, hackathon_id: hackathon_id || null },
        { fromUserId: from_user_id, hackathonId: hackathon_id || null }
      ],
      status: 'pending'
    });

    if (requestCount >= 5) {
      return res.status(400).json({ error: 'Maximum 5 requests allowed' });
    }

    // Create request with both snake_case and camelCase for compatibility
    const newRequest = await Request.create({
      from_user_id,
      fromUserId: from_user_id, // Also set camelCase
      to_user_id,
      toUserId: to_user_id, // Also set camelCase
      hackathon_id: hackathon_id || null,
      hackathonId: hackathon_id || null, // Also set camelCase
      message: message,
      status: 'pending'
    });

    res.json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /team/:userId - Get user's team
// GET /api/team/:teamId - Get a single team by ID (includes messages)
app.get('/api/team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    console.log(`📥 GET /api/team/:teamId - teamId: ${teamId}`);
    
    // Find team - try both ObjectId and string lookup
    let team;
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!team) {
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    if (!team) {
      console.error(`❌ Team not found: ${teamId}`);
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get member details
    const members = await User.find({ _id: { $in: team.members.map(id => id.toString()) } });
    
    // Get hackathon info
    const hackathonId = team.hackathon_id || team.hackathonId;
    const hackathon = hackathonId ? await Hackathon.findById(hackathonId) : null;
    
    const teamWithDetails = {
      ...team.toObject(),
      hackathon: hackathon ? {
        name: hackathon.name,
        location: hackathon.location
      } : null,
      memberDetails: members.map(m => ({
        _id: m._id,
        name: m.name,
        skills: m.skills,
        tech_stack: m.tech_stack
      }))
    };
    
    console.log(`✅ Team found with ${(team.messages || []).length} messages`);
    res.json(teamWithDetails);
  } catch (error) {
    console.error('❌ Error fetching team:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/teams/:userId - Get all teams user is a member of
app.get('/api/teams/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Find all teams where user is a member
    // Handle both string IDs and ObjectIds
    const teams = await Team.find({
      members: { $in: [userId.toString()] }
    }).sort({ created_at: -1 });

    // Get hackathon and member details for each team
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        // Handle both hackathon_id and hackathonId (for manually created teams)
        const hackathonId = team.hackathon_id || team.hackathonId;
        const hackathon = hackathonId ? await Hackathon.findById(hackathonId) : null;
        // Find members by string IDs
        const members = await User.find({ _id: { $in: team.members.map(id => id.toString()) } });
        
        return {
          ...team.toObject(),
          hackathon: hackathon ? {
            name: hackathon.name,
            location: hackathon.location
          } : null,
          memberDetails: members.map(m => ({
            _id: m._id,
            name: m.name,
            skills: m.skills,
            tech_stack: m.tech_stack
          }))
        };
      })
    );

    res.json(teamsWithDetails);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /team/:userId - Get user's team (for current hackathon)
app.get('/team/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { hackathonId } = req.query;

    console.log(`🔍 GET /team/:userId - userId: ${userId}, hackathonId: ${hackathonId}`);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Build query - handle string IDs
    const query = {
      members: { $in: [userId.toString()] }
    };

    // If hackathonId is provided, filter by it (handle both hackathon_id and hackathonId)
    if (hackathonId) {
      query.$or = [
        { hackathon_id: hackathonId },
        { hackathonId: hackathonId } // Support camelCase for manually created teams
      ];
    }

    // Find team where user is a member
    const team = await Team.findOne(query);

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
    // Support both camelCase and snake_case from frontend
    const from_user_id = req.body.from_user_id || req.body.fromUserId;
    const to_user_id = req.body.to_user_id || req.body.toUserId;
    const hackathon_id = req.body.hackathon_id || req.body.hackathonId;
    const message = req.body.message || '';
    
    if (!from_user_id || !to_user_id) {
      return res.status(400).json({ error: 'from_user_id and to_user_id are required' });
    }

    // Validate that IDs are not placeholder values
    if (from_user_id.includes('placeholder') || to_user_id.includes('placeholder')) {
      return res.status(400).json({ error: 'Invalid user ID: placeholder values are not allowed' });
    }
    
    // Check if request already exists (support both formats)
    const existingRequest = await Request.findOne({
      $or: [
        { from_user_id, to_user_id },
        { fromUserId: from_user_id, toUserId: to_user_id }
      ]
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Request already sent' });
    }
    
    // Check request limit (5 per user per hackathon) - support both formats
    const requestCount = await Request.countDocuments({
      $or: [
        { from_user_id, hackathon_id: hackathon_id || null },
        { fromUserId: from_user_id, hackathonId: hackathon_id || null }
      ],
      status: 'pending'
    });
    
    if (requestCount >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 pending requests allowed' });
    }
    
    // Create new request with both formats for compatibility
    const newRequest = new Request({
      from_user_id,
      fromUserId: from_user_id, // Also set camelCase
      to_user_id,
      toUserId: to_user_id, // Also set camelCase
      hackathon_id: hackathon_id || null,
      hackathonId: hackathon_id || null, // Also set camelCase
      message: message,
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

// GET /api/requests/incoming/:userId - Get incoming requests for a user
app.get('/api/requests/incoming/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`📥 GET /api/requests/incoming/:userId - userId: ${userId}`);
    console.log(`📥 userId type: ${typeof userId}, value: ${userId}`);
    
    // Support both snake_case and camelCase field names
    // Also try both string and ObjectId comparisons
    // Use .lean() to get raw MongoDB documents (not Mongoose documents)
    const incomingRequests = await Request.find({
      $and: [
        {
          $or: [
            { to_user_id: userId },
            { toUserId: userId },
            { to_user_id: userId.toString() },
            { toUserId: userId.toString() }
          ]
        },
        { status: 'pending' }
      ]
    }).lean();
    
    console.log(`✅ Found ${incomingRequests.length} incoming requests`);
    if (incomingRequests.length > 0) {
      console.log(`📋 Request details:`, incomingRequests.map(r => ({
        _id: r._id,
        fromUserId: r.from_user_id || r.fromUserId,
        toUserId: r.to_user_id || r.toUserId,
        status: r.status
      })));
    } else {
      // Debug: Check what requests exist
      const allRequests = await Request.find({});
      console.log(`🔍 Total requests in DB: ${allRequests.length}`);
      if (allRequests.length > 0) {
        console.log(`📋 Sample request:`, {
          _id: allRequests[0]._id,
          fromUserId: allRequests[0].from_user_id || allRequests[0].fromUserId,
          toUserId: allRequests[0].to_user_id || allRequests[0].toUserId,
          status: allRequests[0].status
        });
      }
    }
    
    // Fetch user data for each request
    const requestsWithUsers = await Promise.all(
      incomingRequests.map(async (request) => {
        // Support both camelCase and snake_case field names
        // request is a plain object from .lean(), so access fields directly
        // Check camelCase FIRST since that's what's in MongoDB
        const fromUserId = request.fromUserId || request.from_user_id;
        console.log(`  📋 Request from user: ${fromUserId} (type: ${typeof fromUserId})`);
        console.log(`  📋 Request.fromUserId: ${request.fromUserId}`);
        console.log(`  📋 Request.from_user_id: ${request.from_user_id}`);
        console.log(`  📋 Request object keys:`, Object.keys(request));
        
        if (!fromUserId) {
          console.log(`  ⚠️ No fromUserId found in request!`);
          console.log(`  📋 Full request object:`, JSON.stringify(request, null, 2));
          return {
            ...request,
            _id: request._id?.toString ? request._id.toString() : String(request._id),
            from_user_id: {
              _id: 'unknown',
              name: 'Unknown User',
              skills: [],
              tech_stack: []
            }
          };
        }
        
        let user = null;
        try {
          // Since User schema has _id as String, use findOne with string
          const userIdStr = String(fromUserId);
          console.log(`  🔍 Looking up user with ID: ${userIdStr}`);
          
          user = await User.findOne({ _id: userIdStr });
          
          if (!user) {
            // Try findById (Mongoose might handle string conversion)
            user = await User.findById(userIdStr);
          }
          
          if (!user) {
            // Try without String conversion
            user = await User.findOne({ _id: fromUserId });
          }
          
          console.log(`  ${user ? '✅' : '❌'} User lookup: ${user ? `${user.name} (${user._id})` : 'NOT FOUND'} for ID: ${fromUserId}`);
          
          if (!user) {
            // Debug: Check what users exist
            const sampleUsers = await User.find({}).limit(3);
            console.log(`  🔍 Sample user IDs in DB:`, sampleUsers.map(u => ({ _id: String(u._id), name: u.name })));
          }
        } catch (userError) {
          console.log(`  ⚠️ Error finding user ${fromUserId}:`, userError.message);
          console.log(`  ⚠️ Error stack:`, userError.stack);
        }
        
        // request is already a plain object from .lean(), no need for toObject()
        return {
          ...request,
          _id: request._id?.toString ? request._id.toString() : String(request._id), // Ensure _id is a string
          from_user_id: user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            skills: user.skills,
            tech_stack: user.tech_stack,
            github: user.github,
            devpost: user.devpost,
            school: user.school,
            location: user.location,
            bio: user.bio,
            experience: user.experience,
            num_hackathons: user.num_hackathons,
            role_preference: user.role_preference,
            description: user.description
          } : {
            _id: fromUserId,
            name: 'Unknown User',
            skills: [],
            tech_stack: []
          }
        };
      })
    );
    
    console.log(`✅ Returning ${requestsWithUsers.length} requests with user data`);
    res.json(requestsWithUsers);
  } catch (error) {
    console.error('Error fetching incoming requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /requests/:requestId/accept - Accept a team request and create/update team
app.post('/requests/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { current_user_id } = req.body; // User accepting the request
    
    if (!current_user_id) {
      return res.status(400).json({ error: 'current_user_id is required' });
    }
    
    // Find the request - support both ObjectId and string
    let request;
    try {
      if (mongoose.Types.ObjectId.isValid(requestId)) {
        request = await Request.findById(requestId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!request) {
      request = await Request.findOne({ _id: requestId.toString() });
    }
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' });
    }
    
    // Verify the current user is the recipient - support both field name formats
    const toUserId = request.to_user_id || request.toUserId;
    if (toUserId !== current_user_id) {
      return res.status(403).json({ error: 'You can only accept requests sent to you' });
    }
    
    const senderId = request.from_user_id || request.fromUserId;
    const hackathonId = request.hackathon_id || request.hackathonId; // Support both formats
    
    // Check if current user already has a team for this hackathon
    let team = await Team.findOne({
      $or: [
        { hackathon_id: hackathonId },
        { hackathonId: hackathonId } // Support camelCase for manually created teams
      ],
      members: current_user_id.toString()
    });
    
    if (team) {
      // Add sender to existing team (if not already a member)
      if (!team.members.includes(senderId.toString())) {
        team.members.push(senderId.toString());
        await team.save();
      }
    } else {
      // Check if sender has a team we should join
      let senderTeam = await Team.findOne({
        $or: [
          { hackathon_id: hackathonId },
          { hackathonId: hackathonId }
        ],
        members: senderId.toString()
      });
      
      if (senderTeam) {
        // Join sender's existing team
        if (!senderTeam.members.includes(current_user_id.toString())) {
          senderTeam.members.push(current_user_id.toString());
          await senderTeam.save();
        }
        team = senderTeam;
      } else {
        // Create new team with both users
        const teamCount = await Team.countDocuments({ 
          $or: [
            { hackathon_id: hackathonId },
            { hackathonId: hackathonId }
          ]
        });
        const teamName = `Team ${teamCount + 1}`;
        
        team = await Team.create({
          hackathon_id: hackathonId,
          hackathonId: hackathonId, // Also set camelCase for consistency
          name: teamName,
          members: [senderId.toString(), current_user_id.toString()],
          is_full: false
        });
      }
    }
    
    // Mark request as accepted
    request.status = 'accepted';
    await request.save();
    
    // Reject all other pending requests from the same sender for this hackathon
    // Support both field name formats
    await Request.updateMany(
      {
        $and: [
          {
            $or: [
              { from_user_id: senderId },
              { fromUserId: senderId }
            ]
          },
          {
            $or: [
              { hackathon_id: hackathonId },
              { hackathonId: hackathonId }
            ]
          },
          { status: 'pending' },
          { _id: { $ne: requestId } }
        ]
      },
      { status: 'rejected' }
    );
    
    // Get all team member names for welcome message
    const teamMembers = await User.find({ 
      _id: { $in: team.members.map(id => id.toString()) } 
    });
    const memberNames = teamMembers.map(m => m.name || 'Member').join(', ');
    
    // Post welcome message from system_bot
    const welcomeMessage = {
      senderId: 'system_bot',
      text: `🎉 Team formed! ${memberNames} are now collaborating. Let's build something amazing together!`,
      timestamp: new Date()
    };
    
    await Team.findByIdAndUpdate(
      team._id,
      { $push: { messages: welcomeMessage } },
      { new: true }
    );
    
    // Refresh team to include the welcome message
    const updatedTeam = await Team.findById(team._id);
    
    res.json({
      success: true,
      team: updatedTeam,
      message: 'Request accepted and team created/updated'
    });
  } catch (error) {
    console.error('Error accepting request:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /chat/:teamId/messages - Get all messages for a team
app.get('/chat/:teamId/messages', async (req, res) => {
  try {
    const { teamId } = req.params;
    console.log(`📥 GET /chat/:teamId/messages - teamId: ${teamId}`);
    
    // Find team and return messages array
    let team;
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!team) {
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    if (!team) {
      console.error(`❌ Team not found: ${teamId}`);
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const messages = (team.messages || []).sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
    
    console.log(`✅ Found ${messages.length} messages for team ${teamId}`);
    res.json(messages);
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /chat/:teamId/messages - Send a message
app.post('/chat/:teamId/messages', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { user_id, user_name, message } = req.body;
    
    console.log(`📨 POST /chat/:teamId/messages - teamId: ${teamId}, user_id: ${user_id}`);
    console.log(`📋 Request body:`, { user_id, user_name, message: message?.substring(0, 50) });
    
    if (!user_id || !message) {
      console.error('❌ Missing required fields:', { hasUserId: !!user_id, hasMessage: !!message });
      return res.status(400).json({ error: 'user_id and message are required' });
    }
    
    // Verify user is a member of the team - try both ObjectId and string lookup
    let team;
    // Try as ObjectId first
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    // If not found, try as string
    if (!team) {
      console.log(`⚠️ Trying string lookup for: ${teamId}`);
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    // If still not found, try without _id field (in case it's stored differently)
    if (!team) {
      console.log(`⚠️ Trying alternative lookup for: ${teamId}`);
      team = await Team.findOne({ $or: [{ _id: teamId }, { _id: teamId.toString() }] });
    }
    
    if (!team) {
      console.error(`❌ Team not found: ${teamId}`);
      // Try to find any team to debug
      const allTeams = await Team.find({}).limit(3).select('_id members');
      console.log(`📋 Sample teams in DB:`, allTeams.map(t => ({ id: t._id, type: typeof t._id, members: t.members })));
      return res.status(404).json({ error: 'Team not found' });
    }
    
    console.log(`✅ Team found: ${team._id}, members:`, team.members);
    
    // Check membership with string comparison
    const memberIds = team.members.map(id => id.toString());
    const userIdStr = user_id.toString();
    console.log(`🔍 Checking membership: ${userIdStr} in [${memberIds.join(', ')}]`);
    
    if (!memberIds.includes(userIdStr)) {
      console.error(`❌ User ${userIdStr} is not a member of team ${team._id}`);
      return res.status(403).json({ error: 'You are not a member of this team' });
    }
    
    console.log(`✅ User is a member, adding message to team...`);
    
    // Add message to team.messages array using $push
    const messageObject = {
      senderId: userIdStr,
      text: message,
      timestamp: new Date()
    };
    
    // Update team with $push
    const updatedTeam = await Team.findByIdAndUpdate(
      team._id,
      { $push: { messages: messageObject } },
      { new: true }
    );
    
    if (!updatedTeam) {
      return res.status(500).json({ error: 'Failed to update team with message' });
    }
    
    console.log(`✅ Message added to team ${team._id}`);
    res.json(messageObject);
  } catch (error) {
    console.error('❌ Error sending message:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai-mentor/:teamId - AI Mentor for team (conversational, team-wide)
app.post('/api/ai-mentor/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { message, teamContext } = req.body;
    
    console.log(`🤖 POST /api/ai-mentor/:teamId - teamId: ${teamId}`);
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get team info - try both ObjectId and string lookup
    let team;
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!team) {
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    if (!team) {
      console.error(`❌ Team not found: ${teamId}`);
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get hackathon info
    const hackathonId = team.hackathon_id || team.hackathonId;
    const hackathon = hackathonId ? await Hackathon.findById(hackathonId) : null;
    const hackathonName = hackathon?.name || 'the hackathon';
    const hackathonTheme = hackathon?.theme || hackathon?.description || 'General hackathon';
    
    // Get all team members' data
    const members = teamContext?.memberDetails || await User.find({ _id: { $in: team.members.map(id => id.toString()) } });
    
    // Build comprehensive team profile
    const memberProfiles = members.map(m => {
      const name = m.name || 'Team Member';
      const role = m.role_preference || 'Developer';
      const skills = (m.skills || []).join(', ') || 'General development';
      const tech = (m.tech_stack || []).join(', ') || 'Various technologies';
      const experience = (m.experience || []).join(', ') || 'Hackathon experience';
      return `- ${name} (${role}): Skills: ${skills} | Tech Stack: ${tech} | Experience: ${experience}`;
    }).join('\n');
    
    // Get recent conversation context
    const recentMessages = (team.messages || []).slice(-15).map(msg => {
      const sender = msg.senderId === 'ai_bot' || msg.senderId === 'ai_mentor' ? 'AI Mentor' : 
                     members.find(m => (m._id?.toString() || m._id) === msg.senderId)?.name || 'Team Member';
      return `${sender}: ${msg.text}`;
    }).join('\n');
    
    // Create comprehensive AI mentor prompt
    const mentorPrompt = `You are an expert hackathon mentor. Your role is to provide clear, actionable, and CONCISE guidance to hackathon teams.

CRITICAL RULES:
1. BE CONCISE: Maximum 3-4 short paragraphs OR a structured list. NO word salad.
2. BE SPECIFIC: Give concrete examples, not vague suggestions.
3. BE ACTIONABLE: Every piece of advice should be immediately implementable.
4. USE STRUCTURE: Bullet points, numbered lists, or clear sections. Avoid walls of text.
5. BE REALISTIC: Consider 24-hour hackathon constraints. Don't suggest overly complex solutions.

TEAM PROFILE:
${memberProfiles}

HACKATHON:
- Name: ${hackathonName}
- Theme: ${hackathonTheme}
${hackathon?.location ? `- Location: ${hackathon.location}` : ''}
${hackathon?.start_date ? `- Dates: ${hackathon.start_date}` : ''}

${recentMessages ? `RECENT CONTEXT:\n${recentMessages}\n\n` : ''}

QUESTION: ${message}

RESPOND WITH:
- Direct answer to the question
- 2-3 specific, actionable steps or recommendations
- Brief reasoning (1 sentence per point)
- If asking for ideas: 2-3 project ideas with 1-sentence descriptions
- If asking for plan: Clear phases with time estimates
- If asking for organization: Specific role assignments based on team skills

Keep it SHORT, PRACTICAL, and IMMEDIATELY USABLE.`;

    console.log(`🤖 Calling Gemini API for AI mentor...`);
    
    // Use Gemini 2.5 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(mentorPrompt);
    const response = await result.response;
    const aiResponse = response.text().trim();
    
    console.log(`✅ AI mentor response received (length: ${aiResponse.length})`);
    
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('❌ Error getting AI mentor response:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// POST /chat/:teamId/ai-advice - Get AI advice for the team
app.post('/chat/:teamId/ai-advice', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { prompt, activeAgent } = req.body; // Optional: custom prompt and activeAgent
    
    console.log(`🤖 POST /chat/:teamId/ai-advice - teamId: ${teamId}`);
    
    // Get team info - try both ObjectId and string lookup
    let team;
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!team) {
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    if (!team) {
      console.error(`❌ Team not found: ${teamId}`);
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get hackathon info - handle both hackathon_id and hackathonId
    const hackathonId = team.hackathon_id || team.hackathonId;
    const hackathon = hackathonId ? await Hackathon.findById(hackathonId) : null;
    const hackathonName = hackathon?.name || 'the hackathon';
    
    // Get all team members' data
    const members = await User.find({ _id: { $in: team.members.map(id => id.toString()) } });
    
    // Build member skills summary
    const memberSkills = members.map(m => {
      const skills = (m.skills || []).join(', ') || 'General developer';
      const tech = (m.tech_stack || []).join(', ') || 'Various technologies';
      return `${m.name || 'Member'}: ${skills} (${tech})`;
    }).join('\n');
    
    // Get recent messages for context (last 10 messages)
    const recentMessages = (team.messages || []).slice(-10).map(msg => {
      const sender = msg.senderId === 'ai_bot' ? 'AI Mentor' : 
                     members.find(m => m._id.toString() === msg.senderId)?.name || 'User';
      return `${sender}: ${msg.text}`;
    }).join('\n');
    
    // Specialists object with different System Instructions for each agent
    const specialists = {
      ARCHITECT: `You are a Technical Architect specialist focused on tech stack decisions, GitHub repository structure, and file scaffolding.

Your core expertise:
- Tech stack selection (React, Node.js, Python, etc.) based on project requirements
- GitHub repository structure and organization (folders, files, naming conventions)
- File scaffolding and project setup (package.json, config files, .gitignore)
- Architecture patterns and best practices
- Development environment configuration

TEAM MEMBERS:
${memberSkills}

HACKATHON: ${hackathonName}

${recentMessages ? `RECENT CONVERSATION:\n${recentMessages}\n\n` : ''}

CRITICAL: You are a DevOps Agent with tool access. You can CREATE repositories, not just talk about them.

If the user asks for a 'repo', 'repository', 'workspace', or wants to 'start coding':
- DO NOT give instructions or explanations
- DO NOT return JSON objects
- IMMEDIATELY call the createGitHubRepo tool with an appropriate repoName
- After the tool executes, respond with: "Repo created! [Link]. You can now launch it in Replit using the [OPEN_WORKSPACE] button."

The repoName should be lowercase, use hyphens, and be descriptive (e.g., "hackathon-vr-app" or "team-collaboration-tool").

Otherwise, provide technical architecture guidance focused on tech stack, repo structure, and file scaffolding.`,

      SCRUM_MASTER: `You are a Scrum Master specialist focused on Replit collaboration, timing, and task breaking.

Your core expertise:
- Breaking down projects into manageable tasks and sprints
- Time estimation for 24-hour hackathons
- Replit collaboration workflows and team coordination
- Task assignment and responsibility distribution
- Progress tracking and deadline management
- Stand-up facilitation and team communication

TEAM MEMBERS:
${memberSkills}

HACKATHON: ${hackathonName}

${recentMessages ? `RECENT CONVERSATION:\n${recentMessages}\n\n` : ''}

CRITICAL: You are a DevOps Agent with tool access. You can CREATE repositories, not just talk about them.

If the user asks for a 'repo', 'repository', 'workspace', or wants to 'start coding':
- DO NOT give instructions or explanations
- DO NOT return JSON objects
- IMMEDIATELY call the createGitHubRepo tool with an appropriate repoName
- After the tool executes, respond with: "Repo created! [Link]. You can now launch it in Replit using the [OPEN_WORKSPACE] button."

The repoName should be lowercase, use hyphens, and be descriptive.

Otherwise, focus on project management, task breakdown, Replit collaboration strategies, and timing.`,

      DESIGNER: `You are a UI/UX Designer specialist focused on Tailwind CSS, UI/UX design, and layout.

Your core expertise:
- Tailwind CSS utility classes and styling patterns
- UI/UX design principles and best practices
- Layout design (grid, flexbox, responsive design)
- Color schemes, typography, and design systems
- Component design and user flows
- Accessibility and responsive design patterns

TEAM MEMBERS:
${memberSkills}

HACKATHON: ${hackathonName}

${recentMessages ? `RECENT CONVERSATION:\n${recentMessages}\n\n` : ''}

CRITICAL: You are a DevOps Agent with tool access. You can CREATE repositories, not just talk about them.

If the user asks for a 'repo', 'repository', 'workspace', or wants to 'start coding':
- DO NOT give instructions or explanations
- DO NOT return JSON objects
- IMMEDIATELY call the createGitHubRepo tool with an appropriate repoName
- After the tool executes, respond with: "Repo created! [Link]. You can now launch it in Replit using the [OPEN_WORKSPACE] button."

The repoName should be lowercase, use hyphens, and be descriptive.

Otherwise, focus on Tailwind CSS, UI/UX design, layout, and visual aesthetics.`,

      DEFAULT: `You are an expert hackathon mentor helping a team plan their project.

TEAM MEMBERS:
${memberSkills}

HACKATHON: ${hackathonName}

${recentMessages ? `RECENT CONVERSATION:\n${recentMessages}\n\n` : ''}

Based on the team's combined skills and tech stack${recentMessages ? ' and the recent conversation' : ''}, provide:
1. A unique project name
2. A brief project description (2-3 sentences)
3. Three specific project ideas that leverage the team's strengths
4. A step-by-step 24-hour execution plan broken into phases

CRITICAL: You are a DevOps Agent with tool access. You can CREATE repositories, not just talk about them.

If the user asks for a 'repo', 'repository', 'workspace', or wants to 'start coding':
- DO NOT give instructions or explanations
- DO NOT return JSON objects
- IMMEDIATELY call the createGitHubRepo tool with an appropriate repoName
- After the tool executes, respond with: "Repo created! [Link]. You can now launch it in Replit using the [OPEN_WORKSPACE] button."

The repoName should be lowercase, use hyphens, and be descriptive (e.g., "hackathon-project-name" or "team-collaboration-tool").

Otherwise, format your response as a clear, actionable plan that the team can follow immediately.`
    };
    
    // Get the system prompt based on activeAgent
    const systemPrompt = specialists[activeAgent] || specialists.DEFAULT;
    
    // Create AI prompt
    const aiPrompt = prompt || systemPrompt;
    
    // Define the tool (function) for Gemini Function Calling
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'createGitHubRepo',
            description: 'Creates a new GitHub repository for the team, invites all team members, and sets up a Replit workspace. Use this when the user asks for a repo, repository, workspace, or wants to start coding.',
            parameters: {
              type: 'object',
              properties: {
                repoName: {
                  type: 'string',
                  description: 'The name for the GitHub repository. Should be lowercase, use hyphens, and be descriptive (e.g., "hackathon-vr-app" or "team-collaboration-tool")'
                },
                description: {
                  type: 'string',
                  description: 'Optional description for the repository'
                }
              },
              required: ['repoName']
            }
          }
        ]
      }
    ];
    
    console.log(`🤖 Calling Gemini API with Function Calling...`);
    
    // Use Gemini 2.5 Flash with tools
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: tools
    });
    
    // Start a chat session for function calling
    const chat = model.startChat({
      history: [],
      systemInstruction: systemPrompt
    });
    
    // Send the user's message
    const result = await chat.sendMessage(aiPrompt);
    const response = result.response;
    
    // Check if the model wants to call a function
    let aiResponse = '';
    let functionCall = null;
    
    if (response.functionCalls() && response.functionCalls().length > 0) {
      // The AI wants to call a function
      functionCall = response.functionCalls()[0];
      console.log(`🔧 AI wants to call function: ${functionCall.name}`);
      console.log(`📋 Function arguments:`, functionCall.args);
      
      if (functionCall.name === 'createGitHubRepo') {
        try {
          // Execute the function
          const repoResult = await createGitHubRepo(
            teamId,
            functionCall.args.repoName,
            functionCall.args.description || null
          );
          
          // Send the function result back to the model
          const functionResponse = await chat.sendMessage({
            functionResponse: {
              name: functionCall.name,
              response: {
                success: true,
                message: `Repository created successfully!`,
                repository: repoResult.repository,
                replit_url: repoResult.replit_url
              }
            }
          });
          
          // Get the final AI response
          aiResponse = functionResponse.response.text().trim();
          console.log(`✅ Function executed, AI response:`, aiResponse);
        } catch (error) {
          console.error('❌ Error executing function:', error);
          // Send error back to model
          const errorResponse = await chat.sendMessage({
            functionResponse: {
              name: functionCall.name,
              response: {
                success: false,
                error: error.message
              }
            }
          });
          aiResponse = errorResponse.response.text().trim();
        }
      }
    } else {
      // No function call, just get the text response
      aiResponse = response.text().trim();
    }
    
    console.log(`✅ AI response received (length: ${aiResponse.length})`);
    
    // If a function was called, the repo is already created and message posted
    // Just add the AI's response message
    const aiMessageObject = {
      senderId: 'ai_bot',
      text: aiResponse.trim(),
      timestamp: new Date(),
      // If function was called, mark it
      action: functionCall ? 'CREATE_REPO' : null,
      actionType: functionCall ? 'GITHUB_INIT' : null,
      github_action: functionCall ? true : false
    };
    
    // Update team with $push - this creates a NEW message object in the array
    const updatedTeam = await Team.findByIdAndUpdate(
      team._id,
      { $push: { messages: aiMessageObject } },
      { new: true }
    );
    
    if (!updatedTeam) {
      return res.status(500).json({ error: 'Failed to update team with AI message' });
    }
    
    // Verify the message was added as a separate object
    const lastMessage = updatedTeam.messages[updatedTeam.messages.length - 1];
    console.log(`✅ AI message added to team ${team._id} as separate object:`, {
      senderId: lastMessage.senderId,
      textLength: lastMessage.text?.length,
      timestamp: lastMessage.timestamp
    });
    
    res.json(aiMessageObject);
  } catch (error) {
    console.error('❌ Error getting AI advice:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// POST /github/init - Initialize GitHub repository for team
app.post('/github/init', async (req, res) => {
  try {
    const { teamId, projectName } = req.body;
    
    console.log(`🔧 POST /github/init - teamId: ${teamId}, projectName: ${projectName}`);
    
    if (!octokit) {
      return res.status(503).json({ error: 'GitHub integration not configured. GITHUB_TOKEN not set in .env' });
    }
    
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    
    // Get team info
    let team;
    try {
      if (mongoose.Types.ObjectId.isValid(teamId)) {
        team = await Team.findById(teamId);
      }
    } catch (idError) {
      console.log(`⚠️ ObjectId lookup failed:`, idError.message);
    }
    
    if (!team) {
      team = await Team.findOne({ _id: teamId.toString() });
    }
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get team members with GitHub usernames
    const members = await User.find({ _id: { $in: team.members.map(id => id.toString()) } });
    const githubUsernames = members
      .map(m => m.github)
      .filter(github => github && github.trim())
      .map(github => github.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '').trim());
    
    if (githubUsernames.length === 0) {
      return res.status(400).json({ error: 'No team members have GitHub usernames configured in their profiles' });
    }
    
    // Generate repository name
    const repoName = projectName 
      ? projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 100)
      : `hackathon-${team.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'project'}-${Date.now()}`;
    
    // Get the authenticated user (token owner) to create the repo
    const { data: authUser } = await octokit.users.getAuthenticated();
    const repoOwner = authUser.login;
    
    console.log(`📦 Creating repository: ${repoOwner}/${repoName}`);
    
    // Create repository
    let repo;
    try {
      repo = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: `Hackathon project: ${projectName || team.name || 'Team Project'}`,
        private: false,
        auto_init: true // Initialize with README
      });
      
      console.log(`✅ Repository created: ${repo.data.full_name}`);
    } catch (repoError) {
      console.error('❌ Error creating repository:', repoError);
      return res.status(500).json({ 
        error: 'Failed to create repository', 
        details: repoError.message 
      });
    }
    
    const repoFullName = repo.data.full_name;
    const [owner, name] = repoFullName.split('/');
    
    // Invite team members to the repository
    const inviteResults = [];
    for (const username of githubUsernames) {
      // Skip if it's the repo owner
      if (username === repoOwner) {
        inviteResults.push({ username, status: 'owner' });
        continue;
      }
      
      try {
        await octokit.repos.addCollaborator({
          owner,
          repo: name,
          username,
          permission: 'push'
        });
        inviteResults.push({ username, status: 'invited' });
        console.log(`✅ Invited ${username} to repository`);
      } catch (inviteError) {
        console.log(`⚠️ Could not invite ${username}:`, inviteError.message);
        inviteResults.push({ username, status: 'failed', error: inviteError.message });
      }
    }
    
    // Generate Replit import URL
    const replitUrl = `https://replit.com/github/${owner}/${name}`;
    
    // Update team with repository info
    await Team.findByIdAndUpdate(
      team._id,
      { 
        $set: { 
          github_repo: repoFullName,
          github_repo_url: repo.data.html_url,
          replit_url: replitUrl
        } 
      }
    );
    
    // Post a new message in the chat with the GitHub link
    const githubMessage = {
      senderId: 'ai_bot',
      text: `✅ GitHub repository initialized successfully!\n\n🔗 Repository: ${repoFullName}\n📦 URL: ${repo.data.html_url}\n\nYou can now start pushing code to your repository. The Replit import URL is: ${replitUrl}`,
      timestamp: new Date()
    };
    
    await Team.findByIdAndUpdate(
      team._id,
      { $push: { messages: githubMessage } },
      { new: true }
    );
    
    res.json({
      success: true,
      repository: {
        name: repoFullName,
        url: repo.data.html_url,
        clone_url: repo.data.clone_url
      },
      replit_url: replitUrl,
      invites: inviteResults
    });
  } catch (error) {
    console.error('❌ Error initializing GitHub repository:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message });
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
      'gemini-2.5-flash',
      'gemini-2.5-pro',
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
  console.log(`   POST /requests/:requestId/accept`);
  console.log(`   GET  /chat/:teamId/messages`);
  console.log(`   POST /chat/:teamId/messages`);
  console.log(`   POST /chat/:teamId/ai-advice`);
  console.log(`   POST /api/ai-mentor/:teamId`);
  console.log(`   POST /github/init`);
  console.log(`   GET  /api/requests/incoming/:userId`);
  console.log(`   GET  /api/team/:teamId`);
  console.log(`   GET  /api/teams/:userId`);
  console.log(`\n✅ All routes registered successfully!`);
});

