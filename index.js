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

// Increase server timeout to 5 minutes for large file processing
const server = require('http').createServer(app);
server.timeout = 300000; // 5 minutes

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for base64-encoded files
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global request logger (for debugging)
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path} from ${req.ip}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/chat', chatRoutes);

// Health check 
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
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});