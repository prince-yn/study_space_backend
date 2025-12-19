const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import configuration
require('./config/firebase'); // Initialize Firebase
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const subjectsRoutes = require('./routes/subjects');
const materialsRoutes = require('./routes/materials');
const chatRoutes = require('./routes/chat');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'StudySpace API is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Connect to database
connectDB();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});