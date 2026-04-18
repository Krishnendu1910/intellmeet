# 🤖 IntellMeet – AI-Powered Enterprise Meeting & Collaboration Platform

**Production-Grade Full-Stack MERN Application with Real-Time Video, AI Meeting Intelligence & Team Collaboration**

---

## 📌 1. Project Overview

**Project Name:** IntellMeet  
**Type:** Enterprise Collaboration Platform  
**Architecture Style:** Distributed Real-Time System (Event-driven + P2P Hybrid)

### 🎯 Purpose
IntellMeet is an **AI-powered enterprise meeting platform** that transforms traditional meetings into **actionable, trackable, and intelligent workflows** by combining:

- Real-time video conferencing
- AI-generated summaries & action items
- Collaborative notes & chat
- Task management (Kanban system)
- Analytics & productivity insights

### 🚀 Deployment Architecture
- **Frontend:** Vercel (CDN-optimized global delivery)
- **Backend:** Render (Node.js server deployment)
- **Database:** MongoDB Atlas (cloud-managed NoSQL DB)

📄 Reference: Project context aligns with enterprise objectives described in the uploaded document (page 2–3) :contentReference[oaicite:0]{index=0}

---

## 🧠 2. Technology Stack

### 🖥️ Frontend
- React.js (Vite)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- React Router DOM
- Recharts (analytics visualization)

### ⚙️ Backend
- Node.js + Express.js
- MongoDB (Mongoose ODM)
- Socket.io (real-time communication)
- Nodemailer (email services)
- Cloudinary (media storage)

### 🌐 Real-Time & Networking
- WebRTC (Mesh Topology)
- Google STUN Servers
- Express TURN Server (firewall traversal)

---

## 🧩 3. Detailed Feature Breakdown

---

### 🔐 3.1 Authentication & Identity System

**Flow:**
1. User registers → Email verification via Nodemailer
2. Password securely hashed (bcrypt)
3. JWT-based authentication for session handling
4. Profile data stored in MongoDB
5. Avatar uploads via Cloudinary

**Security Features:**
- Email verification enforcement
- Password reset tokens (secure expiry)
- JWT + protected routes middleware

---

### 🎛️ 3.2 Lobby System (Pre-Meeting Setup)

- Users enter a **device testing lobby**
- Camera & microphone permissions validated
- Preview stream initialized via WebRTC
- Prevents meeting disruption due to hardware issues

---

### 📡 3.3 Real-Time Meeting Room

#### Core Capabilities:
- WebRTC-based video/audio communication
- Screen sharing via MediaDevices API
- Live chat using Socket.io
- Typing indicators (real-time events)
- Shared Notes (collaborative document)

#### Architecture:
- Peer-to-peer mesh network
- Socket.io used for signaling

---

### 👑 3.4 Host & Security Controls

**Role-Based Access:**
- Host (Creator)
- Co-Host
- Guest

**Host Capabilities:**
- Waiting room approval system
- Disable:
  - Mic
  - Camera
  - Screen sharing
  - Notes editing
- Kick users from session

---

### 🎥 3.5 In-Browser Recording

- Uses **MediaRecorder API**
- Records:
  - Video stream
  - Audio stream
- Stored locally on user device
- No server load → optimized performance

---

### 🤖 3.6 AI Meeting Intelligence

#### Pipeline:
1. Speech captured via Web Speech API
2. Real-time transcription generated
3. Post-meeting processing:
   - Summary generation
   - Key insights extraction
   - Action items identification

#### Output:
- Structured meeting summary
- Bullet-point insights
- Task suggestions

---

### 📋 3.7 Automated Kanban Board

- AI-generated tasks auto-added
- Manual task creation supported
- Drag & Drop functionality

**Columns:**
- Pending
- In Progress
- Done

**Features:**
- Task assignment
- Status tracking
- Real-time updates

---

### 📊 3.8 Dashboard & Analytics

#### Modules:
- Meeting History
- Scheduled Meetings
- Tasks Overview
- Analytics Dashboard

#### Metrics:
- Total meetings
- Task completion %
- Productivity trends

#### Visualization:
- Recharts (line charts, pie charts)

---

## ⚡ 4. Advanced Engineering & Optimizations

---

### 🔧 WebRTC Hardware Lock Fix
- Prevented camera crashes across tabs
- Managed MediaStream lifecycle correctly

---

### 🌍 Timezone Bug Fix
- Replaced server UTC timestamps
- Used frontend local-time injection
- Eliminated scheduling inconsistencies

---

### 🔐 Security Enhancements
- Helmet.js (OWASP protection)
- Express-rate-limit (API abuse prevention)
- Input sanitization

---

### ⚡ Socket Optimization
- Prevented memory leaks on component unmount
- Optimized event listeners
- Reduced unnecessary re-renders

---

### 💾 Intelligent UI State
- LocalStorage-based tab persistence
- Restores user session state seamlessly

---

## 🏗️ 5. System Architecture Diagram

```mermaid
flowchart LR
    A[Client - React/Vite] -->|REST API| B[Node.js + Express Backend]
    A -->|Socket.io| C[Realtime Server]

    subgraph WebRTC Network
        A1[Client 1]
        A2[Client 2]
        A3[Client 3]
        A1 --- A2
        A2 --- A3
        A1 --- A3
    end

    A -->|Signaling| C
    C -->|WebRTC Handshake| A1
    C -->|WebRTC Handshake| A2
    C -->|WebRTC Handshake| A3

    A1 -->|STUN/TURN| D[STUN/TURN Servers]
    A2 -->|STUN/TURN| D
    A3 -->|STUN/TURN| D

    B -->|DB Queries| E[(MongoDB Atlas)]
    B -->|Media Upload| F[Cloudinary]
    B -->|Email Service| G[Nodemailer SMTP]

    C -->|Chat / Notes Sync| A
````

---

## ⚙️ 6. Setup & Installation Guide

---

### 📋 Prerequisites

* Node.js (v18+)
* MongoDB Atlas account
* Cloudinary account
* Email SMTP credentials

---

### 📥 Clone Repository


git clone https://github.com/your-repo/intellmeet.git && cd intellmeet


### 🔐 Backend Environment Variables

Create `.env` in backend:

```env
MONGO_URI=
JWT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
TURN_URL=
TURN_USERNAME=
TURN_PASSWORD=
EMAIL_USER=
EMAIL_PASS=
---

---


### 🌐 Frontend Environment Variables

Create `.env` in frontend:

```env
VITE_API_URL=
VITE_SOCKET_URL=
```

---

### 📦 Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

---

### ▶️ Run Application

```bash
# Backend
npm run dev

# Frontend
npm run dev
```

---

## 🧪 7. Deployment Summary

* **Frontend:** Vercel (auto CI/CD)
* **Backend:** Render (Node server)
* **Database:** MongoDB Atlas
* **Media:** Cloudinary CDN

---

## 📈 8. Technical Highlights

* Real-time event-driven architecture
* WebRTC mesh network implementation
* AI-driven automation pipeline
* Secure enterprise-grade authentication
* Scalable cloud deployment

---

## 🎯 9. Conclusion

IntellMeet is a **production-grade enterprise collaboration platform** that combines:

* Real-time communication
* AI intelligence
* Task automation
* Data-driven analytics

It demonstrates strong expertise in:

* Full-stack development
* Distributed systems
* DevOps & deployment
* Real-time architectures

---

## 🚀 Future Enhancements

* Kubernetes-based scaling
* AI model fine-tuning
* Multi-tenant enterprise support
* Mobile app version