<div align="center">

<img src="https://img.shields.io/badge/INTELLMEET-AI%20MEETINGS-06B6D4?style=for-the-badge&labelColor=020617" alt="IntellMeet" />

# 🎥 IntellMeet

### Smarter video meetings. Clearer decisions. Actionable outcomes.

An AI-assisted video meeting and real-time collaboration platform combining browser-based meetings, live transcription, AI-generated summaries, and task tracking.

<br />

<img src="https://img.shields.io/badge/STATUS-Work%20in%20Progress-F59E0B?style=for-the-badge" alt="Work in progress" />

<br /><br />

<img src="https://img.shields.io/badge/React-TypeScript-3178C6?style=flat-square&logo=react&logoColor=white" alt="React and TypeScript" />
<img src="https://img.shields.io/badge/Build-Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
<img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js and Express" />
<img src="https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
<img src="https://img.shields.io/badge/Real--Time-Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO" />
<img src="https://img.shields.io/badge/Video-WebRTC-6D28D9?style=flat-square" alt="WebRTC" />

<br /><br />

<a href="https://github.com/Krishnendu1910/intellmeet">
  <img src="https://img.shields.io/badge/EXPLORE%20SOURCE-View%20on%20GitHub-24292e?style=for-the-badge&logo=github&logoColor=white" alt="Explore source code" />
</a>

<p><em>Built incrementally with a focus on real-time communication, collaboration, and AI-assisted meeting workflows.</em></p>

</div>

---

## 🌟 About the Project

**IntellMeet** is an ongoing full-stack project that explores how video meetings can become more productive before, during, and after a call.

The application combines a modern meeting interface with real-time collaboration, transcription, AI-assisted summaries, and task management. The repository contains a React and TypeScript frontend alongside a Node.js and Express backend.

> 🚧 **Development status:** IntellMeet is still in progress. The screenshots represent the current interface, not a guarantee that every feature is complete or production-ready.

## 🖼️ Website Preview

### 🏠 Landing Page

<p align="center">
  <img src="docs/images/landing-page.png" alt="IntellMeet landing page with AI meeting features and video meeting preview" width="100%" />
</p>

### 🔐 Sign In

<p align="center">
  <img src="docs/images/sign-in.png" alt="IntellMeet sign-in page with email and password fields and Google sign-in option" width="88%" />
</p>

### ✨ Create an Account

<p align="center">
  <img src="docs/images/sign-up.png" alt="IntellMeet registration page with account details and workspace role selection" width="88%" />
</p>

### 🎬 Website Walkthrough

<p align="center">
  <img src="docs/images/intellmeet-demo.gif" alt="Animated walkthrough of the IntellMeet website" width="100%" />
</p>

<p align="center"><em>A preview of the current website interface.</em></p>

> **Preview setup:** Upload your three screenshots and a compressed GIF of your screen recording to `docs/images/` using the exact filenames shown above. GitHub will display the images after the files are committed.

## ✨ Features

The following feature areas are represented in the current source code:

- 🎥 **Meeting room interface** — camera, microphone, participant tiles, screen-sharing controls, and meeting actions.
- 🔗 **Meeting creation and joining** — meeting flows and room identifiers.
- 👥 **Participant collaboration** — real-time events for join requests, waiting-room approval, roles, and participant actions.
- 💬 **In-meeting chat** — message exchange and typing indicators.
- 📝 **Shared notes** — meeting notes and a summary page with note-download functionality.
- 🛡️ **Meeting controls** — host/co-host roles, participant approval, permissions, and removal events.
- 🎙️ **Browser transcription** — speech capture using browser speech-recognition capabilities where supported.
- 🤖 **AI-assisted summaries** — integration with the configured Groq chat-completions API.
- ✅ **Action-item extraction** — logic for extracting task-like items from meeting summaries.
- 📊 **Meeting summaries and task progress** — task counts and visualizations using Recharts.
- 🔐 **Authentication** — registration, login, email verification, password recovery, and password reset.
- 👤 **Profile management** — profile updates and avatar-upload handling.
- 📅 **Dashboard areas** — meetings, tasks, analytics, and profile-related functionality.

*The presence of code for a feature does not guarantee that the entire user journey is complete. Verify functionality in your environment.*

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| ⚛️ React + TypeScript | Frontend UI and application logic |
| ⚡ Vite | Development server and build tooling |
| 🎨 Tailwind CSS | Styling and responsive layouts |
| 🧭 React Router | Frontend navigation |
| 🗃️ Zustand | Client-side authentication state |
| 📈 Recharts | Charts and task visualizations |
| 📡 Axios / Fetch | HTTP communication |
| 🟢 Node.js + Express | Backend API and application logic |
| 🍃 MongoDB + Mongoose | Data storage and modelling |
| 🔌 Socket.IO | Real-time events and signaling |
| 📹 WebRTC | Browser-based audio/video communication |
| 🎬 MediaRecorder API | In-browser media recording |
| 🤖 Groq API | AI-assisted meeting summaries |
| ☁️ Cloudinary | Media and avatar storage integration |
| ✉️ Nodemailer | Email delivery integration |
| 🛡️ JWT, bcrypt, Helmet | Authentication and security foundations |

## 🗺️ Architecture Overview

```mermaid
flowchart TB
    User[User Browser]
    UI[React + TypeScript + Vite]
    API[Express REST API]
    Socket[Socket.IO]
    DB[(MongoDB)]
    AI[Groq AI API]
    Media[Cloudinary]
    Email[Email Provider]
    RTC[WebRTC Connections]

    User --> UI
    UI -->|HTTP| API
    UI <-->|Real-time events| Socket
    API <--> DB
    API -->|Meeting text| AI
    API --> Media
    API --> Email
    Socket <-->|Signaling| RTC
    RTC <-->|Audio, video, screen| RTC

intellmeet/
├── README.md
│
├── intellmeet-ui/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── App.css
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── MeetingRoom.tsx
│       │   ├── MeetingSummary.tsx
│       │   ├── ForgotPassword.tsx
│       │   ├── ResetPassword.tsx
│       │   └── VerifyEmail.tsx
│       └── store/
│           └── authStore.ts
│
├── intellmeet-backend/
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── config/
│       │   └── db.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── meetingController.js
│       │   └── aiController.js
│       ├── middlewares/
│       │   └── authMiddleware.js
│       ├── models/
│       │   ├── User.js
│       │   └── meeting.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   └── meetingRoutes.js
│       └── utils/
│           └── sendEmail.js
│
└── docs/
    └── images/
        ├── landing-page.png
        ├── sign-in.png
        ├── sign-up.png
        └── intellmeet-demo.gif
