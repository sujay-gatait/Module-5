const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: String, required: true },
  image: { type: String, default: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80' },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 }
});
const Post = mongoose.model('Post', postSchema);

// Auth Middleware (Protects Private Routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const verifiedUser = jwt.verify(token, JWT_SECRET);
    req.user = verifiedUser;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

// ==================== AUTH APIs ====================

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword });
    const token = jwt.sign({ id: newUser._id, name: newUser.name, email: newUser.email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// 2. User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ==================== BLOG POST APIs ====================

// 3. Read All Public Posts (Home Feed)
app.get('/api/posts', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category !== 'All') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }

    const posts = await Post.find(query).sort({ _id: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching posts.' });
  }
});

// 4. Read Logged-In User's Posts ONLY (Protected Dashboard Endpoint)
app.get('/api/posts/user/me', authenticateToken, async (req, res) => {
  try {
    const userPosts = await Post.find({ author: req.user.name }).sort({ _id: -1 });
    res.json(userPosts);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user dashboard posts.' });
  }
});

// 5. Read Individual Post Details
app.get('/api/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });

    post.views += 1;
    await post.save();
    
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving post details.' });
  }
});

// 6. Create Post (Protected)
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { title, category, excerpt, content, image } = req.body;
    if (!title || !category || !excerpt || !content) {
      return res.status(400).json({ message: 'Missing required article fields.' });
    }

    const newPost = await Post.create({
      title,
      category,
      excerpt,
      content,
      author: req.user.name,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      image: image || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80'
    });

    res.status(201).json({ message: 'Article created successfully', post: newPost });
  } catch (err) {
    res.status(500).json({ message: 'Server error creating post.' });
  }
});

// 7. Update Post (Protected)
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { title, category, excerpt, content, image } = req.body;
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { title, category, excerpt, content, image },
      { new: true, runValidators: true }
    );

    if (!updatedPost) return res.status(404).json({ message: 'Post not found.' });
    res.json({ message: 'Post updated successfully', post: updatedPost });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating post.' });
  }
});

// 8. Delete Post (Protected)
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);
    if (!deletedPost) return res.status(404).json({ message: 'Post not found.' });
    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting post.' });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));