const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const aiController = require('../controllers/aiController');
const { scheduleMeeting, getMeetings, deleteMeeting, getMeetingByRoomId, updateTaskStatus, deleteTask, getIceServers } = require('../controllers/meetingController');

router.post('/schedule', protect, scheduleMeeting);
router.get('/', protect, getMeetings);
router.get('/room/:roomId', protect, getMeetingByRoomId); 
router.delete('/:id', protect, deleteMeeting);
router.put('/room/:roomId/tasks/:taskId', protect, updateTaskStatus); 
router.delete('/room/:roomId/tasks/:taskId', protect, deleteTask);

router.get('/ice-servers', getIceServers);
router.post('/summary', protect, aiController.generateSummary); 
router.post('/end', protect, aiController.endMeetingAndSummarize); 

module.exports = router;