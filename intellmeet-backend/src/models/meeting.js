const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },
    status: { type: String, default: 'todo' },
    creator: { type: String, default: 'System' },
    assigneeId: { type: String, default: null }, // FIX: ObjectId ki jagah String kiya
    assigneeName: { type: String, default: 'Unassigned' },
    assigneeProfilePic: { type: String, default: null }
});

const meetingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    roomId: { type: String, required: true, unique: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isWaitingRoom: { type: Boolean, default: false },
    status: { type: String, default: 'Scheduled' },
    summary: { type: String, default: '' },
    sharedNotes: { type: String, default: '' },
    tasks: [taskSchema]
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);