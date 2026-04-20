const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const cloudinary = require('cloudinary').v2;

const generateTokens = (id) => {
    const accessToken = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists with this email' });

        const user = await User.create({ name, email, password });

        const verifyToken = user.getVerificationToken();
        await user.save({ validateBeforeSave: false });

        // FIX: Ensure CLIENT_URL exists and isn't a wildcard
        const clientBaseUrl = process.env.CLIENT_URL && process.env.CLIENT_URL !== '*' 
            ? process.env.CLIENT_URL 
            : 'http://localhost:5173';

        const verifyUrl = `${clientBaseUrl}/verify-email/${verifyToken}`;
        
        const message = `
  <div style="
    background:linear-gradient(135deg,#020617,#0f172a,#020617);
    padding:50px 0;
    font-family:'Segoe UI',Arial,sans-serif;
  ">
    <div style="
      max-width:520px;
      margin:auto;
      border-radius:18px;
      overflow:hidden;
      background:linear-gradient(145deg,#0f172a,#1e293b);
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    ">
      <div style="
        height:1px;
        background:#22d3ee;
        box-shadow:0 0 12px rgba(34,211,238,0.6);
      "></div>
      <div style="padding:40px 35px;text-align:center;">
        <h1 style="margin:0; font-size:20px; letter-spacing:3px; color:#22d3ee;">INTELLMEET</h1>
        <h2 style="margin-top:25px; color:#f1f5f9; font-size:20px; font-weight:600;">Verify Your Email</h2>
        <p style="color:#cbd5f5; font-size:14px; margin:20px 0 30px;">
          Hi ${user.name},<br/>
          Please verify your email to activate your account.
        </p>
        <a href="${verifyUrl}" style="
          display:inline-block;
          padding:14px 34px;
          font-weight:600;
          color:white;
          text-decoration:none;
          border-radius:12px;
          background:linear-gradient(90deg,#14b8a6,#06b6d4);
          box-shadow:0 8px 25px rgba(6,182,212,0.45);
        ">Verify Email</a>
        <div style="height:1px; background:rgba(255,255,255,0.08); margin:30px 0;"></div>
        <p style="font-size:12px; color:#94a3b8;">If you didn’t create this account, you can ignore this email.</p>
      </div>
    </div>
  </div>
`;
        await sendEmail({ email: user.email, subject: 'Verify your IntellMeet Account', html: message });
        res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.verifyEmail = async (req, res) => {
    try {
        const verificationToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ verificationToken, verificationTokenExpire: { $gt: Date.now() } });

        if (!user) return res.status(400).json({ message: 'Invalid or expired verification link' });

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully. You can now login.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

        if (user.isVerified === false) {
            return res.status(401).json({ message: 'Please verify your email first.' });
        }

        const tokens = generateTokens(user._id);
        res.json({
            token: tokens.accessToken,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: { _id: user._id, name: user.name, email: user.email, profilePic: user.profilePic }
        });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.name = req.body.name || user.name;
            const updatedUser = await user.save();
            res.json({ _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, profilePic: updatedUser.profilePic });
        } else { res.status(404).json({ message: 'User not found' }); }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);
        if (user && (await bcrypt.compare(currentPassword, user.password))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else { res.status(401).json({ message: 'Incorrect current password' }); }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(404).json({ message: 'No account found with this email' });

        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        const clientBaseUrl = process.env.CLIENT_URL && process.env.CLIENT_URL !== '*' 
            ? process.env.CLIENT_URL 
            : 'http://localhost:5173';

        const resetUrl = `${clientBaseUrl}/reset-password/${resetToken}`;
        const message = `
  <div style="
    background:linear-gradient(135deg,#020617,#0f172a,#020617);
    padding:50px 0;
    font-family:'Segoe UI',Arial,sans-serif;
  ">
    <div style="
      max-width:520px;
      margin:auto;
      border-radius:18px;
      overflow:hidden;
      background:linear-gradient(145deg,#0f172a,#1e293b);
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    ">
      <div style="height:3px; background:linear-gradient(90deg,#22d3ee,#14b8a6,#06b6d4);"></div>
      <div style="padding:35px; text-align:center;">
        <h1 style="margin:0; font-size:20px; letter-spacing:3px; font-weight:600; color:#22d3ee;">INTELLMEET</h1>
        <h2 style="margin-top:25px; color:#f1f5f9; font-size:20px; font-weight:600;">Reset Your Password</h2>
        <p style="color:#cbd5f5; font-size:14px; line-height:1.6; margin:20px 0 30px;">
          Hey ${user.name},<br/>We received a request to reset your password.
        </p>
        <a href="${resetUrl}" style="
            display:inline-block;
            padding:14px 34px;
            font-size:15px;
            font-weight:600;
            color:white;
            text-decoration:none;
            border-radius:12px;
            background:linear-gradient(90deg,#14b8a6,#06b6d4);
            box-shadow:0 8px 25px rgba(6,182,212,0.45);
            letter-spacing:0.3px;
        ">Reset Password</a>
        <p style="margin-top:28px; color:#f87171; font-size:13px;">This link will expire in 10 minutes.</p>
        <div style="height:1px; background:rgba(255,255,255,0.08); margin:30px 0;"></div>
        <p style="font-size:12px; color:#94a3b8;">If you didn’t request this, you can safely ignore this email.</p>
      </div>
    </div>
  </div>
`;
        try {
            await sendEmail({ email: user.email, subject: 'IntellMeet - Password Reset', html: message });
            res.status(200).json({ message: 'Password reset link sent to your email.' });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ message: 'Email could not be sent.' });
        }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');
        const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image file provided' });
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'intellmeet_avatars', width: 250, height: 250, crop: "fill", gravity: "face"
        });
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id, { profilePic: result.secure_url }, { returnDocument: 'after' }
        ).select('-password');
        res.status(200).json(updatedUser);
    } catch (error) { res.status(500).json({ message: 'Image upload failed' }); }
};