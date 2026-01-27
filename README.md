# StudySpace Backend (Node/Express)

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

## Setup
1) Install Node.js (18+ recommended).
2) Run `npm install`.
3) Copy `.env.example` to `.env` and set:
   - `PORT`, `MONGODB_URI`
   - Firebase service account path/JSON
   - Cloudinary credentials
   - Gemini API key
4) Ensure `service-account.json` matches your Firebase project.

## Run
- Development: `npm run dev`
- Production: `npm start`

## API
- Auth sync endpoints
- Spaces and subjects CRUD
- Materials upload/retrieval
- Chat/AI routes for note digitisation

## Notes
- Keep MongoDB, Firebase, and Cloudinary credentials secure.
- Validate file size/type limits in multer config as needed.
