const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { registerUser, loginUser, updateProfile, updateAvatar, updatePassword, forgotPassword, resetPassword, verifyEmail } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/profile/avatar', protect, upload.single('avatar'), updateAvatar);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/verifyemail/:token', verifyEmail); 

router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);

module.exports = router;