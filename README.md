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
