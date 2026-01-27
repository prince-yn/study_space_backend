# StudySpace Backend (Node/Express)

**Related Repositories:**
- [Frontend Repository](https://github.com/sea-deep/StudySpace)
- [Backend Repository](https://github.com/prince-yn/study_space_backend) (this repo)

## Overview
Supports StudySpace by providing auth sync, space/subject/material APIs, media handling, and AI-powered note digitisation.

## Tech Stack
- Node.js, Express
- MongoDB via Mongoose
- Firebase Admin for auth/user sync
- Google Gemini (`@google/generative-ai`) for AI workflows
- Cloudinary + multer + sharp for uploads and transformations
- PDF/image handling with pdf-to-img
- Axios for outbound requests
- dotenv for configuration

## Prerequisites
- **Node.js** (18 or later) – [Install Node.js](https://nodejs.org/)
- **npm** (comes with Node.js)
- **MongoDB** (local instance or cloud URI) – [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or [Local Setup](https://docs.mongodb.com/manual/installation/)
- **Git**
- **Firebase project** with Admin SDK access
- **Cloudinary account** for image/media hosting
- **Google Gemini API key**

## Installation

### Step 1: Clone the repository
```bash
git clone https://github.com/prince-yn/study_space_backend.git
cd study_space_backend
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Configure environment variables
1. Create a `.env` file in the root directory (copy from `.env.example` if available):
   ```bash
   cp .env.example .env
   ```

2. Set the following environment variables:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/studyspace
   NODE_ENV=development
   
   # Firebase
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY=your-private-key
   FIREBASE_CLIENT_EMAIL=your-client-email
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   
   # Google Gemini
   GEMINI_API_KEY=your-gemini-api-key
   ```

### Step 4: Add Firebase service account
1. Download the service account JSON from your [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts
2. Save it as `service-account.json` in the root directory (or update the path in your config)

### Step 5: Start the server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT)

## Project Structure
```
study_space_backend/
├── config/               # Configuration files
│   ├── database.js      # MongoDB connection setup
│   ├── firebase.js      # Firebase Admin SDK initialization
│   ├── cloudinary.js    # Cloudinary configuration
│   ├── gemini.js        # Google Gemini API setup
│   └── multer.js        # File upload middleware
├── models/              # Mongoose database models
│   ├── User.js
│   ├── Space.js
│   ├── Subject.js
│   └── Material.js
├── routes/              # Express route handlers
│   ├── auth.js         # Authentication endpoints
│   ├── spaces.js       # Spaces CRUD operations
│   ├── subjects.js     # Subjects CRUD operations
│   ├── materials.js    # Materials upload/retrieval
│   └── chat.js         # AI chat endpoints
├── utils/              # Utility functions
│   ├── helpers.js      # Helper functions
│   ├── imageSearch.js  # Image search utilities
│   ├── kroki.js        # Diagram generation
│   └── pdfToImages.js  # PDF conversion utilities
├── auth_middleware.js  # Authentication middleware
├── index.js            # Express app initialization and server setup
├── package.json        # Project dependencies
├── .env                # Environment variables (create from .env.example)
├── service-account.json # Firebase service account credentials
└── README.md           # This file
```

## API Endpoints

### Authentication
- `POST /auth/sync` - Sync Firebase user with MongoDB
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login

### Spaces
- `GET /spaces` - List all spaces
- `POST /spaces` - Create a new space
- `GET /spaces/:id` - Get space details
- `PUT /spaces/:id` - Update space
- `DELETE /spaces/:id` - Delete space

### Subjects
- `GET /subjects` - List all subjects
- `POST /subjects` - Create a new subject
- `GET /subjects/:id` - Get subject details
- `PUT /subjects/:id` - Update subject
- `DELETE /subjects/:id` - Delete subject

### Materials
- `POST /materials/upload` - Upload study material
- `GET /materials` - List materials
- `GET /materials/:id` - Get material details
- `DELETE /materials/:id` - Delete material

### Chat/AI
- `POST /chat/digitize-notes` - AI-powered note digitization
- `POST /chat/generate-content` - Content generation using Gemini

## Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection error | Check if MongoDB is running locally or if `MONGODB_URI` in `.env` is correct |
| Firebase authentication fails | Verify `service-account.json` exists and `FIREBASE_*` environment variables are set correctly |
| Cloudinary upload fails | Check `CLOUDINARY_*` credentials in `.env` |
| Gemini API errors | Ensure `GEMINI_API_KEY` is valid and has appropriate permissions |
| Port already in use | Change the `PORT` in `.env` to an available port |
| Module not found errors | Run `npm install` again to ensure all dependencies are installed |

## Development Tips
- Use `npm run dev` during development for auto-reload with nodemon
- Use `npm test` to run tests (if available)
- Monitor logs for debugging: Enable `NODE_DEBUG` if needed
- Check the API endpoints using tools like Postman or curl
- Keep MongoDB, Firebase, and Cloudinary credentials secure (never commit `.env`)

## Frontend Integration
The Flutter frontend expects the backend to be accessible at the base URL configured in the frontend's `lib/config.dart`. Ensure:
- Backend server is running
- CORS is properly configured if frontend and backend are on different origins
- API endpoints match the frontend's expectations

## Security Notes
- **Never commit `.env`, `service-account.json`, or Firebase keys** to version control
- Use environment variables for all sensitive data
- Validate file size/type limits in `config/multer.js` to prevent abuse
- Implement rate limiting for API endpoints in production
- Ensure MongoDB and Firebase security rules are properly configured

## Contributing
1. Create a new branch for your feature: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a Pull Request

## License
See LICENSE file for details.
