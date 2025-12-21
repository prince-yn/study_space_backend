# StudySpace Backend

RESTful API for StudySpace - AI-powered study materials management.

## Stack

Node.js • Express • MongoDB • Firebase • Gemini AI • Cloudinary

## Setup

```bash
npm install
cp .env.example .env  # Fill credentials
npm run dev
```

## Deploy to Railway

1. Push to GitHub
2. New Railway project from repo
3. Add env vars from `.env.example`
4. Generate domain

## API Endpoints

**Auth**: `/api/auth/*`  
**Spaces**: `/api/spaces/*`  
**Subjects**: `/api/subjects/*`  
**Materials**: `/api/materials/*`  
**Chat**: `/api/chat`

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for details.
