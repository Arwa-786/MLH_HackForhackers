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
  status: { type: String, default: 'pending' }
});

const Request = mongoose.model('Request', RequestSchema);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to calculate match score using Gemini AI
async function calculateMatchScore(currentUser, otherUser) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `You are a hackathon team matching AI. Rate the compatibility between two developers on a scale of 1-10 based on their complementary skills.

Current User:
- Skills: ${currentUser.skills.join(', ') || 'None listed'}
- School: ${currentUser.school || 'Not specified'}

Other User:
- Skills: ${otherUser.skills.join(', ') || 'None listed'}
- School: ${otherUser.school || 'Not specified'}

Consider:
1. How well their skills complement each other (e.g., frontend + backend, designer + developer)
2. Diversity of skill sets (avoid too much overlap)
3. Potential for a well-rounded team

Respond with ONLY a number from 1-10 (no explanation, just the number).`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const score = parseInt(response.text().trim());
    
    // Validate and clamp score
    const validScore = Math.max(1, Math.min(10, isNaN(score) ? 5 : score));
    
    // Convert score to category
    let matchCategory;
    if (validScore >= 8) {
      matchCategory = 'strong';
    } else if (validScore >= 6) {
      matchCategory = 'good';
    } else if (validScore >= 4) {
      matchCategory = 'okay';
    } else {
      matchCategory = 'bad';
    }
    
    return {
      matchScore: validScore,
      matchCategory: matchCategory
    };
  } catch (error) {
    console.error('Error calculating match score:', error);
    // Fallback to default score
    return {
      matchScore: 5,
      matchCategory: 'okay'
    };
  }
}

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

// POST request to send team request
app.post('/request', async (req, res) => {
  try {
    const { from_user_id, to_user_id } = req.body;
    
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
      status: 'pending'
    });
    
    res.json(newRequest);
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

