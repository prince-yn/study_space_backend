const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./config/firebase');
const connectDB = require('./config/database');

const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const subjectsRoutes = require('./routes/subjects');
const materialsRoutes = require('./routes/materials');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

const server = require('http').createServer(app);
server.timeout = 300000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/chat', chatRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'StudySpace API is running' });
});

app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found' });
});

connectDB();

server.listen(PORT);