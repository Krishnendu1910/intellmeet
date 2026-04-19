const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

dotenv.config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const Meeting = require('./models/meeting');

const app = express();
const server = http.createServer(app);

connectDB();

// Security
app.use(helmet({ contentSecurityPolicy: false }));

// ✅ FIXED CORS
app.use(
  cors({
    origin: [
      "https://intellmeet-one.vercel.app", // your frontend
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);

// Routes
app.get("/", (req, res) =>
  res.send("IntellMeet API is Running Successfully 🚀")
);

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// ✅ FIXED SOCKET CORS
const io = new Server(server, {
  cors: {
    origin: [
      "https://intellmeet-one.vercel.app",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"],
  },
});

const roomStates = {};
const activeSockets = {};

io.on('connection', (socket) => {

  socket.on('join-request', async ({ roomId, userId, userName, profilePic }) => {
    try {
      const meeting = await Meeting.findOne({ roomId });
      if (!meeting)
        return socket.emit('join-error', 'Meeting not found or invalid Link!');

      activeSockets[socket.id] = userId;
      const isCreator = meeting.host.toString() === userId;

      if (!isCreator && userId && !userId.startsWith('anon_')) {
        await Meeting.updateOne({ roomId }, { $addToSet: { participants: userId } });
      }

      if (!roomStates[roomId]) {
        roomStates[roomId] = {
          isWaitingRoom: meeting.isWaitingRoom,
          permissions: { mic: true, video: true, screen: true, record: false },
          roles: {},
          approvedUsers: new Set(),
        };
      }

      const role = isCreator ? 'creator' : 'guest';
      roomStates[roomId].roles[socket.id] = role;

      if (
        isCreator ||
        !roomStates[roomId].isWaitingRoom ||
        roomStates[roomId].approvedUsers.has(userId)
      ) {
        roomStates[roomId].approvedUsers.add(userId);
        socket.emit('join-approved', {
          role,
          permissions: roomStates[roomId].permissions,
        });
      } else {
        for (const [sId, uId] of Object.entries(activeSockets)) {
          const uRole = roomStates[roomId].roles[sId];
          if (uRole === 'creator' || uRole === 'co-host') {
            io.to(sId).emit('participant-waiting', {
              socketId: socket.id,
              targetUserId: userId,
              userName,
              profilePic,
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  socket.on('accept-join', ({ targetSocketId, targetUserId, roomId }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].approvedUsers.add(targetUserId);
      roomStates[roomId].roles[targetSocketId] = 'guest';
      io.to(targetSocketId).emit('join-approved', {
        role: 'guest',
        permissions: roomStates[roomId].permissions,
      });
    }
  });

  socket.on('reject-join', ({ targetSocketId }) => {
    io.to(targetSocketId).emit('join-denied');
  });

  socket.on('user-typing', ({ roomId, userName }) => {
    socket.to(roomId).emit('user-typing', { userName });
  });

  socket.on('user-stopped-typing', ({ roomId, userName }) => {
    socket.to(roomId).emit('user-stopped-typing', { userName });
  });

  socket.on('make-cohost', ({ targetSocketId, roomId }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].roles[targetSocketId] = 'co-host';
      io.to(targetSocketId).emit('role-changed', 'co-host');
      io.to(roomId).emit('roles-updated', roomStates[roomId].roles);
    }
  });

  socket.on('remove-cohost', ({ targetSocketId, roomId }) => {
    if (roomStates[roomId]) {
      roomStates[roomId].roles[targetSocketId] = 'guest';
      io.to(targetSocketId).emit('role-changed', 'guest');
      io.to(roomId).emit('roles-updated', roomStates[roomId].roles);
    }
  });

  socket.on('kick-user', ({ targetSocketId, targetUserId, roomId }) => {
    if (roomStates[roomId])
      roomStates[roomId].approvedUsers.delete(targetUserId);
    io.to(targetSocketId).emit('kicked-out');
  });

  socket.on('update-permissions', ({ roomId, permissions }) => {
    if (roomStates[roomId])
      roomStates[roomId].permissions = permissions;
    socket.to(roomId).emit('permissions-updated', permissions);
  });

  socket.on('host-ended-meeting', ({ roomId }) => {
    socket.to(roomId).emit('meeting-ended-by-host');
  });

  socket.on('join-room', ({ roomId, userName, profilePic }) => {
    socket.join(roomId);

    if (roomStates[roomId])
      io.to(roomId).emit('roles-updated', roomStates[roomId].roles);

    socket.to(roomId).emit('user-connected', {
      userId: socket.id,
      userName,
      profilePic,
    });

    socket.on('send-message', (message) =>
      io.to(roomId).emit('receive-message', message)
    );

    socket.on('disconnect', () => {
      delete activeSockets[socket.id];
    });
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});