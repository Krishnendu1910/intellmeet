const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const Meeting = require('./models/meeting'); 

const app = express();
const server = http.createServer(app);

connectDB();
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: ["https://intellmeet.vercel.app", "http://localhost:5173"], 
  credentials: true
}));

app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);

app.get("/", (req, res) => res.send("IntellMeet API is Running Successfully 🚀"));
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

const io = new Server(server, {
  cors: { origin: ["https://intellmeet.vercel.app", "http://localhost:5173"], methods: ["GET", "POST"] }
});

const roomStates = {};
const activeSockets = {}; 

io.on('connection', (socket) => {

    socket.on('join-request', async ({ roomId, userId, userName, profilePic }) => {
        try {
            const meeting = await Meeting.findOne({ roomId });
            if (!meeting) return socket.emit('join-error', 'Meeting not found or invalid Link!');

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
                    approvedUsers: new Set() 
                };
            }

            const role = isCreator ? 'creator' : 'guest';
            roomStates[roomId].roles[socket.id] = role;

            if (isCreator || !roomStates[roomId].isWaitingRoom || roomStates[roomId].approvedUsers.has(userId)) {
                roomStates[roomId].approvedUsers.add(userId);
                socket.emit('join-approved', { role, permissions: roomStates[roomId].permissions });
            } else {
                for (const [sId, uId] of Object.entries(activeSockets)) {
                    const uRole = roomStates[roomId].roles[sId];
                    if (uRole === 'creator' || uRole === 'co-host') {
                        io.to(sId).emit('participant-waiting', { socketId: socket.id, targetUserId: userId, userName, profilePic });
                    }
                }
            }
        } catch (error) { console.error(error); }
    });

    socket.on('accept-join', ({ targetSocketId, targetUserId, roomId }) => {
        if(roomStates[roomId]) {
            roomStates[roomId].approvedUsers.add(targetUserId);
            roomStates[roomId].roles[targetSocketId] = 'guest';
            io.to(targetSocketId).emit('join-approved', { role: 'guest', permissions: roomStates[roomId].permissions });
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
        if(roomStates[roomId]) { 
            roomStates[roomId].roles[targetSocketId] = 'co-host'; 
            io.to(targetSocketId).emit('role-changed', 'co-host');
            io.to(roomId).emit('roles-updated', roomStates[roomId].roles); 
        }
    });

    socket.on('remove-cohost', ({ targetSocketId, roomId }) => {
        if(roomStates[roomId]) { 
            roomStates[roomId].roles[targetSocketId] = 'guest'; 
            io.to(targetSocketId).emit('role-changed', 'guest');
            io.to(roomId).emit('roles-updated', roomStates[roomId].roles); 
        }
    });

    socket.on('kick-user', ({ targetSocketId, targetUserId, roomId }) => {
        if (roomStates[roomId]) roomStates[roomId].approvedUsers.delete(targetUserId);
        io.to(targetSocketId).emit('kicked-out');
    });

    socket.on('update-permissions', ({ roomId, permissions }) => {
        if(roomStates[roomId]) roomStates[roomId].permissions = permissions;
        socket.to(roomId).emit('permissions-updated', permissions);
    });

    socket.on('host-ended-meeting', ({ roomId }) => {
        socket.to(roomId).emit('meeting-ended-by-host');
    });

    socket.on('join-room', ({ roomId, userName, profilePic }) => {
        socket.join(roomId);
        if (roomStates[roomId]) io.to(roomId).emit('roles-updated', roomStates[roomId].roles);
        
        socket.to(roomId).emit('user-connected', { userId: socket.id, userName, profilePic });
        socket.on('send-message', (message) => io.to(roomId).emit('receive-message', message));
        socket.on('media-status-change', (data) => socket.to(data.roomId).emit('peer-media-status', { userId: socket.id, isMuted: data.isMuted, isVideoOff: data.isVideoOff }));
        socket.on('request-media-status', (targetUserId) => socket.to(targetUserId).emit('request-media-status-from', socket.id));
        socket.on('send-transcript', (text) => socket.to(roomId).emit('receive-transcript', { text, sender: socket.id }));
        
        socket.on('offer', (data) => socket.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id, userName: data.userName, profilePic: data.profilePic }));
        socket.on('answer', (data) => socket.to(data.target).emit('answer', { sdp: data.sdp, caller: socket.id, userName: data.userName, profilePic: data.profilePic }));
        
        socket.on('update-notes', (data) => socket.to(data.roomId).emit('receive-notes', data.notes));
        socket.on('add-task', (data) => socket.to(data.roomId).emit('receive-task', data.task));
        socket.on('speaking-status', (data) => socket.to(data.roomId).emit('peer-speaking', { userId: socket.id, isSpeaking: data.isSpeaking }));
        socket.on('toggle-raise-hand', (data) => socket.to(data.roomId).emit('peer-raised-hand', { userId: socket.id, userName: data.userName, isRaised: data.isRaised }));
        socket.on('send-reaction', (data) => socket.to(data.roomId).emit('peer-reaction', { userId: socket.id, emoji: data.emoji }));
        socket.on('ice-candidate', (data) => socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, caller: socket.id }));
    });

    socket.on('disconnect', () => { 
        delete activeSockets[socket.id]; 
    });

    socket.on('disconnecting', () => { 
        socket.rooms.forEach(roomId => { 
            if (roomStates[roomId] && roomStates[roomId].roles[socket.id]) {
                delete roomStates[roomId].roles[socket.id];
                io.to(roomId).emit('roles-updated', roomStates[roomId].roles);
            }
            if (roomId !== socket.id) socket.to(roomId).emit('user-disconnected', socket.id); 
        }); 
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => { console.log(`Server running on port ${PORT}`); });