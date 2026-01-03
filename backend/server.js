import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
  skills: [String],
  tech_stack: [String],
  experience: [String],
  num_hackathons: [String],
  devpost: String,
  github: String,
  school: String,
  location: String
});

const User = mongoose.model('User', UserSchema);

// Request Schema
const RequestSchema = new mongoose.Schema({
  from_user_id: String,
  to_user_id: String,
  status: { type: String, default: 'pending' },
  message: String, // Add this
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI Matchmaking Helper Functions
async function calculateMatchScore(user1, user2, teamMembers = null) {
  try {
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
      // One-on-one matching
      prompt = `You are an AI hackathon team matching system. Evaluate compatibility between two developers.

USER 1:
- Name: ${user1.name || 'Unknown'}
- Skills: ${(user1.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user1.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user1.experience || []).join(', ') || 'None listed'}
- School: ${user1.school || 'Not specified'}
- Location: ${user1.location || 'Not specified'}

USER 2:
- Name: ${user2.name || 'Unknown'}
- Skills: ${(user2.skills || []).join(', ') || 'None listed'}
- Tech Stack: ${(user2.tech_stack || []).join(', ') || 'None listed'}
- Experience: ${(user2.experience || []).join(', ') || 'None listed'}
- School: ${user2.school || 'Not specified'}
- Location: ${user2.location || 'Not specified'}

EVALUATION CRITERIA:
1. Role Complementarity: How well do their skills complement each other? (e.g., Frontend + Backend = High Score)
2. Tech Stack Alignment: Can they work together effectively?
3. Project Experience: Do their experiences align for hackathon success?

Respond with a JSON object in this exact format:
{
  "score": <number 0-100>,
  "reason": "<brief explanation of why this is a good/bad match>",
  "category": "<Strong|Good|Okay|Bad>"
}`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Try to parse JSON from response
    let matchData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        matchData = JSON.parse(jsonMatch[0]);
      } else {
        matchData = JSON.parse(text);
      }
    } catch (e) {
      console.warn('Failed to parse AI response as JSON, using fallback');
      matchData = {
        score: 50,
        reason: 'AI response parsing failed',
        category: 'Okay'
      };
    }
    
    // Validate and normalize score
    const score = Math.max(0, Math.min(100, parseInt(matchData.score) || 50));
    
    // Determine category based on score
    let category = matchData.category || 'Okay';
    if (score >= 85) {
      category = 'Strong';
    } else if (score >= 60) {
      category = 'Good';
    } else if (score >= 40) {
      category = 'Okay';
    } else {
      category = 'Bad';
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
      
      return {
        id: hackathon._id.toString(),
        name: hackathon.name || 'Hackathon Event',
        start_date: start_date,
        end_date: end_date,
        location: hackathon.location || 'Location TBD',
        url: hackathon.url || 'https://mlh.io',
        logo: null,
        description: hackathon.description || '',
        type: hackathon.type || ''
      };
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Hackathon Team Matcher API is running!' });
});

// GET all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// POST /match-score - AI Matchmaking endpoint
app.post('/match-score', async (req, res) => {
  try {
    const { user1_id, user2_id, team_member_ids, hackathon_id } = req.body;
    
    if (!user1_id || !user2_id) {
      return res.status(400).json({ error: 'user1_id and user2_id are required' });
    }
    
    const user1 = await User.findById(user1_id);
    const user2 = await User.findById(user2_id);
    
    if (!user1 || !user2) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    
    let teamMembers = null;
    if (team_member_ids && team_member_ids.length > 0) {
      // Fetch team members for team-based matching
      teamMembers = await User.find({ _id: { $in: team_member_ids } });
    }
    
    const matchResult = await calculateMatchScore(user1, user2, teamMembers);
    
    res.json(matchResult);
  } catch (error) {
    console.error('Error in match-score:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST request to send team request
app.post('/request', async (req, res) => {
  try {
    const { from_user_id, to_user_id, message } = req.body;
    
    // Check if user already sent 5 requests
    const requestCount = await Request.countDocuments({ 
      from_user_id, 
      status: 'pending' 
    });
    
    if (requestCount >= 5) {
      return res.status(400).json({ error: 'Maximum 5 requests allowed' });
    }
    
    const newRequest = await Request.create({
      from_user_id,
      to_user_id,
      message: message || '',
      status: 'pending'
    });
    
    res.json(newRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /team/:userId - Get user's team
app.get('/team/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const team = await Team.findOne({ members: userId, is_full: false });
    
    if (!team) {
      return res.json({ team: null, needed_roles: [] });
    }
    
    // Get team members details
    const members = await User.find({ _id: { $in: team.members } });
    
    res.json({
      team: {
        ...team.toObject(),
        members_details: members
      },
      needed_roles: team.needed_roles || []
    });
  } catch (error) {
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

