# StudySpace - Complete Application Summary

> **Purpose**: This document provides a comprehensive technical overview of StudySpace for AI models or developers to understand the full system architecture, data flow, and functionality.

## Table of Contents
1. [Application Overview](#application-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Data Models](#data-models)
5. [Authentication Flow](#authentication-flow)
6. [Core Features & Workflows](#core-features--workflows)
7. [API Reference](#api-reference)
8. [Frontend Screen Structure](#frontend-screen-structure)
9. [AI Integration](#ai-integration)
10. [File Processing Pipeline](#file-processing-pipeline)

---

## Application Overview

**StudySpace** is a collaborative study platform that enables students to:
- Digitize handwritten/rough notes using AI (Google Gemini)
- Organize study materials into hierarchical spaces and subjects
- Collaborate with peers through shared spaces
- Get AI-powered study assistance through an integrated chat

**Core Value Proposition**: Transform messy blackboard photos or rough handwritten notes into clean, structured, searchable digital notes with AI assistance.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STUDYSPACE SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│  │   Flutter Frontend  │ ◄─────► │         Node.js Backend             │   │
│  │   (Mobile/Web App)  │  REST   │        (Express Server)             │   │
│  └─────────────────────┘   API   └─────────────────────────────────────┘   │
│           │                                     │                           │
│           │                                     │                           │
│           ▼                                     ▼                           │
│  ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│  │   Firebase Auth     │         │            MongoDB                  │   │
│  │  (Google Sign-In)   │         │  (Users, Spaces, Subjects, Materials)│   │
│  └─────────────────────┘         └─────────────────────────────────────┘   │
│                                                 │                           │
│                                                 ▼                           │
│                                  ┌─────────────────────────────────────┐   │
│                                  │        External Services            │   │
│                                  │  • Google Gemini (AI Processing)    │   │
│                                  │  • Cloudinary (Image Storage)       │   │
│                                  │  • Kroki (Diagram Generation)       │   │
│                                  └─────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Communication Flow

1. **User Authentication**: Flutter → Firebase Auth → Backend sync → MongoDB
2. **Data Operations**: Flutter → REST API → Backend → MongoDB
3. **Material Creation**: Flutter → Upload files → Backend → Gemini AI → Process → MongoDB
4. **AI Chat**: Flutter → Backend → Gemini API → Response → Flutter

---

## Technology Stack

### Frontend (Flutter)
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Flutter 3.x | Cross-platform UI |
| Language | Dart | Application logic |
| Auth | Firebase Auth + Google Sign-In | User authentication |
| HTTP | http, dio | API communication |
| State | StatefulWidget + FutureBuilder | State management |
| Storage | shared_preferences | Local settings |
| UI | Material 3, Google Fonts | Modern design system |
| Content | flutter_markdown, flutter_math_fork | Markdown + LaTeX rendering |
| Media | file_picker, cached_network_image, photo_view | File handling |

### Backend (Node.js)
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 18+ | Server runtime |
| Framework | Express.js | REST API framework |
| Database | MongoDB + Mongoose | Data persistence |
| Auth | Firebase Admin SDK | Token verification |
| AI | @google/generative-ai | Gemini integration |
| Storage | Cloudinary | Image/file storage |
| Upload | multer, sharp | File processing |
| PDF | pdf-to-img | PDF conversion |
| Diagrams | Kroki API | Diagram rendering |

---

## Data Models

### User
```javascript
{
  uid: String,          // Firebase UID (unique)
  email: String,        // User email (unique)
  name: String,         // Display name
  picture: String,      // Profile picture URL
  createdAt: Date
}
```

### Space
```javascript
{
  name: String,                    // Space name
  description: String,             // Optional description
  joinCode: String,                // Unique 6-char code for joining
  owner: ObjectId → User,          // Space creator (full permissions)
  admins: [ObjectId → User],       // Admin users (elevated permissions)
  members: [ObjectId → User],      // All members including owner
  editors: [ObjectId → User],      // Users who can create materials
  createdAt: Date
}
```

### Subject
```javascript
{
  spaceId: ObjectId → Space,       // Parent space
  name: String,                    // Subject name (e.g., "Mathematics")
  createdAt: Date
}
```

### Material
```javascript
{
  title: String,                   // AI-generated or extracted title
  content: String,                 // Markdown content with LaTeX
  subjectId: ObjectId → Subject,   // Parent subject
  spaceId: ObjectId → Space,       // Parent space
  createdBy: ObjectId → User,      // Creator
  images: [{
    placeholder: String,           // Description of image
    url: String,                   // Image URL (Cloudinary/Kroki)
    position: Number,              // Position in content
    type: String                   // 'search' | 'diagram'
  }],
  sourceFiles: [{
    originalName: String,          // Original filename
    fileType: String,              // 'pdf' | 'image'
    size: Number,                  // File size in bytes
    url: String                    // Storage URL
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Entity Relationships
```
User (1) ──owns──► (N) Space
User (N) ◄──members──► (N) Space
Space (1) ──contains──► (N) Subject
Subject (1) ──contains──► (N) Material
User (1) ──creates──► (N) Material
```

---

## Authentication Flow

### Sign-In Process
```
1. User taps "Sign in with Google" in Flutter app
2. Flutter initiates Google Sign-In flow
3. Google returns OAuth tokens
4. Flutter exchanges tokens for Firebase credential
5. Firebase Auth creates/authenticates user
6. Flutter gets Firebase ID token
7. Flutter sends ID token to backend: POST /api/auth/login
8. Backend verifies token with Firebase Admin SDK
9. Backend creates/updates user in MongoDB
10. Backend returns success, Flutter stores token locally
11. User redirected to SpacesDashboard
```

### Token Management
- Firebase ID tokens are used for all API requests
- Tokens sent in `Authorization: Bearer <token>` header
- Backend middleware (`auth_middleware.js`) validates every protected request
- Token refresh handled automatically by Firebase SDK

---

## Core Features & Workflows

### 1. Space Management

**Create Space:**
```
User → Create Space Dialog → API: POST /api/spaces/create
Backend generates unique joinCode → Saves to MongoDB → Returns space
```

**Join Space:**
```
User → Enter joinCode → API: POST /api/spaces/join
Backend finds space by code → Adds user to members array → Returns space
```

**Permission Hierarchy:**
```
Owner > Admin > Editor > Member

Owner:     All permissions + delete space + manage admins
Admin:     Manage members, create subjects, toggle editors
Editor:    Create/edit materials
Member:    View only
```

### 2. Subject Management

Subjects are organizational containers within a space:
```
Space
├── Subject: Mathematics
│   ├── Material: Calculus Notes
│   └── Material: Algebra Basics
└── Subject: Physics
    └── Material: Newton's Laws
```

### 3. Material Creation (AI Digitization)

This is the **core feature** - transforming rough notes into structured content.

**Process Flow:**
```
1. User selects files (images/PDFs) in Flutter app
2. Optional: User adds text prompt for context
3. Files encoded as base64 and sent to backend
4. Backend processes files:
   a. PDFs converted to images (pdf-to-img)
   b. Images prepared for Gemini
5. System prompt + files sent to Gemini API
6. Gemini returns structured Markdown with:
   - Title extraction
   - Organized content
   - LaTeX math formulas
   - Diagram blocks (Mermaid/PlantUML)
   - Image placeholders
7. Backend post-processes:
   a. Kroki API renders diagrams to images
   b. Image placeholders replaced with search results
8. Final material saved to MongoDB
9. Flutter displays rendered Markdown + LaTeX
```

**AI System Prompt Philosophy:**
```
- "Structure > Expansion" - Organize, don't expand
- Concise bullet points, not textbook prose
- Indian English conventions (doubts, revision)
- Diagrams only when necessary
- LaTeX for all math ($E=mc^2$)
- Tables for comparisons
```

### 4. Material Viewing

**Rendering Stack:**
```
Material Content (Markdown + LaTeX)
         │
         ▼
MarkdownLatexViewer Widget
         │
         ├── markdown_widget (Markdown rendering)
         ├── flutter_math_fork (LaTeX rendering)
         └── cached_network_image (Image loading)
```

### 5. AI Chat Assistant

Context-aware study assistant powered by Gemini:

**Chat Contexts:**
- `general`: General study questions
- `subject`: Questions about a specific subject
- `material`: Questions about specific study material (includes content as context)

**Conversation Flow:**
```
User message → Backend builds context prompt → 
Includes conversation history → Gemini generates response →
Response with LaTeX support → Rendered in Flutter
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Sync Firebase user with backend |

### Spaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/spaces/create` | Create new space |
| GET | `/api/spaces/my-spaces` | Get user's spaces |
| PUT | `/api/spaces/:spaceId` | Update space details |
| DELETE | `/api/spaces/:spaceId` | Delete space (owner only) |
| POST | `/api/spaces/join` | Join space with code |
| POST | `/api/spaces/:spaceId/leave` | Leave a space |
| GET | `/api/spaces/:spaceId/members` | Get space members |
| GET | `/api/spaces/:spaceId/can-edit` | Check edit permissions |
| POST | `/api/spaces/:spaceId/make-admin` | Promote to admin |
| POST | `/api/spaces/:spaceId/remove-admin` | Demote admin |
| POST | `/api/spaces/:spaceId/toggle-editor` | Toggle editor status |
| POST | `/api/spaces/:spaceId/remove-member` | Remove member |

### Subjects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subjects/create` | Create subject in space |
| GET | `/api/subjects/:spaceId` | Get subjects in space |
| PUT | `/api/subjects/:subjectId` | Update subject |
| DELETE | `/api/subjects/:subjectId` | Delete subject |

### Materials
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/materials/create` | Create material (multipart/JSON) |
| GET | `/api/materials/:subjectId` | Get materials in subject |
| GET | `/api/materials/detail/:materialId` | Get single material |
| PUT | `/api/materials/:materialId` | Update material |
| DELETE | `/api/materials/:materialId` | Delete material |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/ask` | Single question |
| POST | `/api/chat/conversation` | Multi-turn conversation |

---

## Frontend Screen Structure

```
lib/
├── main.dart                    # App entry, theme, auth check
├── config.dart                  # Backend URL configuration
├── firebase_options.dart        # Firebase configuration
│
├── screens/
│   ├── login_screen.dart        # Google Sign-In UI
│   ├── spaces_dashboard.dart    # List of user's spaces
│   ├── space_page.dart          # Single space view (subjects list)
│   ├── subject_page.dart        # Single subject (materials list)
│   ├── material_viewer.dart     # View digitized material
│   └── chat_screen.dart         # AI chat interface
│
├── services/
│   ├── auth_service.dart        # Firebase + backend auth
│   └── space_service.dart       # All API calls (spaces, subjects, materials, chat)
│
└── widgets/
    ├── markdown_latex_viewer.dart   # Markdown + LaTeX renderer
    ├── zoomable_image_viewer.dart   # Full-screen image viewer
    └── animated_shimmer.dart        # Loading placeholder
```

### Screen Navigation Flow
```
App Launch
    │
    ▼
AuthCheck (main.dart)
    │
    ├── Not logged in ──► LoginScreen
    │                          │
    │                          ▼
    │                    Google Sign-In
    │                          │
    └── Logged in ◄────────────┘
          │
          ▼
    SpacesDashboard
          │
          ├── Create Space
          ├── Join Space
          └── Tap Space ──► SpacePage
                               │
                               ├── Manage Members
                               ├── Create Subject
                               └── Tap Subject ──► SubjectPage
                                                      │
                                                      ├── Create Material (AI)
                                                      └── Tap Material ──► MaterialViewer
                                                                               │
                                                                               └── Chat FAB ──► ChatScreen
```

---

## AI Integration

### Google Gemini Configuration

**Models Used:**
- Primary: `gemini-1.5-flash` (fast, efficient)
- Fallback: `gemini-1.5-pro` (more capable)
- Fallback: `gemini-pro` (legacy)

**Usage Patterns:**

1. **Material Digitization**: Multimodal (images + text prompt)
2. **Chat**: Text-only with context injection

### Diagram Generation (Kroki)

Supports multiple diagram syntaxes:
- **Mermaid**: Flowcharts, sequences, state diagrams
- **PlantUML**: UML diagrams, architecture
- **Graphviz**: Graph visualizations
- **ERD**: Entity-relationship diagrams

**Process:**
```
Gemini generates: ```mermaid\ngraph TD\nA-->B\n```
Backend extracts diagram blocks
Sends to Kroki API: POST https://kroki.io/{type}/svg
Returns SVG → Converts to image URL
Replaces code block with image in content
```

---

## File Processing Pipeline

### Image Upload
```
Flutter: Pick image → Encode base64 → Send to API
Backend: Receive → Send to Gemini → Process response → Save
```

### PDF Upload
```
Flutter: Pick PDF → Encode base64 → Send to API
Backend: 
  1. Decode PDF buffer
  2. Convert pages to images (pdf-to-img, max 20 pages)
  3. Encode each page as base64
  4. Send all images to Gemini
  5. Process combined response
```

### Size Limits
- Max file size: 50MB (Express limit)
- Max PDF pages: 20
- Max files per upload: 20

---

## Security Considerations

1. **Authentication**: All API routes (except health) require valid Firebase ID token
2. **Authorization**: Permission checks at space/subject/material level
3. **Data Isolation**: Users only see spaces they're members of
4. **Input Validation**: File type/size validation, MongoDB ID format checks
5. **Content Moderation**: Gemini can refuse inappropriate content

---

## Environment Configuration

### Backend (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/studyspace
NODE_ENV=development

# Firebase Admin
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

### Frontend (lib/config.dart)
```dart
class Config {
  static const String baseUrl = "https://your-backend-url.com";
}
```

---

## Deployment

**Current Production:**
- Backend: Railway (`https://studyspacebackend.up.railway.app`)
- Frontend: Flutter builds for Android/iOS/Web

**Repositories:**
- Frontend: [github.com/sea-deep/StudySpace](https://github.com/sea-deep/StudySpace)
- Backend: [github.com/prince-yn/study_space_backend](https://github.com/prince-yn/study_space_backend)

---

## Summary

StudySpace is a full-stack collaborative learning platform with:

1. **Flutter frontend** providing a modern, cross-platform UI
2. **Node.js/Express backend** handling business logic and data
3. **MongoDB** for flexible document storage
4. **Firebase Auth** for secure, hassle-free authentication
5. **Google Gemini AI** for intelligent note digitization and chat
6. **Cloudinary** for reliable media storage
7. **Kroki** for technical diagram rendering

The core innovation is the AI-powered digitization pipeline that transforms photos of handwritten notes or blackboard content into clean, structured, searchable Markdown documents with proper formatting, LaTeX math support, and auto-generated diagrams.
