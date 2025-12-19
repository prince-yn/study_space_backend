# StudySpace API Documentation

## 📚 Overview

This document describes the complete API implementation for the StudySpace application.

---

## ✅ Implementation Status

### **Backend - Completed Features**

#### 1. **Space Management** ✅
- Create study spaces with join codes
- Join spaces using codes
- Owner and admin role system
- Permission management (make admin, remove admin)
- Delete space (owner only)
- Leave space (members)

#### 2. **Material Creation with AI** ✅
- **Multiple input types:**
  - Images (JPG, PNG, GIF, WEBP)
  - PDFs (text extraction)
  - Text prompts
  - Multiple files at once (up to 10)
  
- **AI Processing:**
  - Gemini AI integration
  - Automatic title generation
  - Structured markdown notes
  - LaTeX support for math formulas
  - Image placeholder system
  - Google Image Search integration

#### 3. **Database Models** ✅
- User model with Firebase UID
- Space model with permissions
- Subject model
- Material model with images and metadata

#### 4. **Context-Aware Chat** ✅
- Material-specific chat (doubts about specific notes)
- Subject-level chat
- General study assistant
- Multi-turn conversations
- LaTeX support in responses

---

## 🔐 Authentication

All endpoints (except `/api/auth/login`) require Firebase JWT token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

---

## 📍 API Endpoints

### **Authentication**

#### `POST /api/auth/login`
Login or register user with Firebase token.

**Request:**
```json
{
  "token": "firebase_id_token"
}
```

**Response:**
```json
{
  "status": "success",
  "user": {
    "_id": "user_id",
    "uid": "firebase_uid",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "profile_url"
  }
}
```

---

### **Spaces**

#### `POST /api/spaces/create`
Create a new study space.

**Request:**
```json
{
  "name": "Physics 101",
  "description": "Study space for physics"
}
```

**Response:**
```json
{
  "status": "success",
  "space": {
    "_id": "space_id",
    "name": "Physics 101",
    "joinCode": "ABC123",
    "owner": "user_id",
    "members": ["user_id"],
    "admins": []
  }
}
```

#### `GET /api/spaces/my-spaces`
Get all spaces where user is a member.

**Response:**
```json
{
  "status": "success",
  "spaces": [...]
}
```

#### `POST /api/spaces/join`
Join a space using join code.

**Request:**
```json
{
  "joinCode": "ABC123"
}
```

#### `POST /api/spaces/:spaceId/make-admin`
Make a user admin (owner/admin only).

**Request:**
```json
{
  "userId": "user_id_to_promote"
}
```

#### `POST /api/spaces/:spaceId/remove-admin`
Remove admin privileges (owner only).

**Request:**
```json
{
  "userId": "user_id_to_demote"
}
```

#### `DELETE /api/spaces/:spaceId`
Delete a space (owner only).

#### `POST /api/spaces/:spaceId/leave`
Leave a space (members, not owner).

---

### **Subjects**

#### `POST /api/subjects/create`
Create a subject in a space.

**Request:**
```json
{
  "spaceId": "space_id",
  "name": "Thermodynamics"
}
```

#### `GET /api/subjects/:spaceId`
Get all subjects in a space.

---

### **Materials (AI-Powered Notes)**

#### `POST /api/materials/create`
Upload files and generate study notes with AI.

**Content-Type:** `multipart/form-data`

**Fields:**
- `files` (File[]) - Up to 10 files (images, PDFs)
- `subjectId` (string) - Required
- `prompt` (string) - Optional text prompt

**Process:**
1. Uploads files (images/PDFs)
2. Sends to Gemini AI
3. Generates structured notes with LaTeX
4. Detects image placeholders: `{{IMAGE: description}}`
5. Searches Google Images for diagrams
6. Replaces placeholders with actual images
7. Saves to database

**Response:**
```json
{
  "status": "success",
  "material": {
    "id": "material_id",
    "title": "Thermodynamics Basics",
    "content": "# Introduction\n\nHeat transfer...",
    "images": [
      {
        "placeholder": "heat transfer diagram",
        "url": "https://...",
        "position": 150
      }
    ]
  }
}
```

#### `GET /api/materials/:subjectId`
Get all materials for a subject.

#### `GET /api/materials/material/:id`
Get a specific material by ID.

---

### **Chat (AI Doubt Solving)**

#### `POST /api/chat/ask`
Ask a question with context awareness.

**Request:**
```json
{
  "question": "Explain the first law of thermodynamics",
  "contextType": "material", // or "subject" or null
  "contextId": "material_id" // or subject_id or null
}
```

**Context Types:**
- `"material"` - Chat knows about specific material content
- `"subject"` - General subject-level chat
- `null` - General study assistant

**Response:**
```json
{
  "status": "success",
  "answer": "The first law of thermodynamics states..."
}
```

#### `POST /api/chat/conversation`
Multi-turn conversation with context.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "What is entropy?"},
    {"role": "assistant", "content": "Entropy is..."},
    {"role": "user", "content": "Can you give an example?"}
  ],
  "contextType": "material",
  "contextId": "material_id"
}
```

---

## 🎯 Key Features Implemented

### 1. **Permission System**
- **Owner**: Full control, can delete space
- **Admins**: Can manage content, make other admins (except delete space)
- **Members**: Can view and create content

### 2. **AI Material Generation**
- **Input flexibility**: Images, PDFs, voice (ready for integration), text prompts
- **Smart processing**: Gemini analyzes all inputs
- **Automatic formatting**: Markdown with LaTeX
- **Image integration**: Auto-searches and embeds diagrams
- **Database storage**: All materials saved with metadata

### 3. **Context-Aware Chat**
- **Material context**: Floating chat button feeds note content to AI
- **Smart assistance**: Knows what student is studying
- **LaTeX support**: Mathematical formulas in responses

---

## 📋 Environment Variables Required

```env
PORT=3000
MONGO_URI=mongodb://...
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
NODE_ENV=development
```

---

## 🚀 Next Steps for Frontend

The backend is fully implemented. Frontend needs:

1. **Space Management UI**
   - Join space modal
   - Admin management interface
   - Member list with roles

2. **Material Creation UI**
   - Multi-file upload
   - PDF picker
   - Preview generated notes
   - Markdown/LaTeX renderer

3. **Material Viewing**
   - Rich markdown viewer with LaTeX
   - Image rendering
   - Material list per subject

4. **Floating Chat Button**
   - FAB on material pages
   - Chat dialog with context
   - Material context auto-feed
   - Multi-turn conversation support

---

## 🎨 Recommended Frontend Libraries

- **Markdown + LaTeX**: `flutter_markdown` + `flutter_math_fork`
- **File Picker**: Already added (`file_picker`)
- **PDF**: `syncfusion_flutter_pdfviewer` or `pdf`
- **Voice**: `record` or `flutter_sound`

---

## ✨ What's Working Right Now

✅ Create spaces with join codes
✅ Join spaces
✅ Permission management
✅ Create subjects
✅ Upload images/PDFs
✅ AI generates structured notes with LaTeX
✅ Auto-embeds diagrams from Google Images
✅ Save materials to database
✅ Context-aware chat with material awareness
✅ Multi-turn conversations

---

## 🔧 Ready for Production

The backend architecture is production-ready with:
- Modular design
- Error handling
- File cleanup
- Security (JWT verification)
- Scalable structure
- RESTful API design
