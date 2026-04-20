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

        const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;
        const message = `
            <div style="font-family: Arial, sans-serif; max-w: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2563eb; margin: 0; font-size: 24px;">IntellMeet</h2>
                </div>
                <h3 style="color: #1e293b;">Welcome to IntellMeet, ${name}!</h3>
                <p style="color: #475569; line-height: 1.6;">Thank you for registering. To ensure the security of your account, please verify your email address by clicking the button below.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">This link will expire in 24 hours.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you did not create an account, please ignore this email.</p>
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
        if (user && (await bcrypt.compare(password, user.password))) {
            
            if (user.isVerified === false) {
                return res.status(401).json({ message: 'Please verify your email first. Check your inbox.' });
            }

            const tokens = generateTokens(user._id);
            res.json({
                token: tokens.accessToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                // NAYA: profilePic add kiya taaki login ke baad turant photo dikhe
                user: { _id: user._id, name: user.name, email: user.email, profilePic: user.profilePic } 
            });
        } else { res.status(401).json({ message: 'Invalid email or password' }); }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.name = req.body.name || user.name;
            const updatedUser = await user.save();
            // NAYA: profilePic add kiya
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
        } else {
            res.status(401).json({ message: 'Incorrect current password' });
        }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(404).json({ message: 'No account found with this email' });

        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        const message = `
            <div style="font-family: Arial, sans-serif; max-w: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2563eb; margin: 0; font-size: 24px;">IntellMeet</h2>
                </div>
                <h3 style="color: #1e293b;">Password Reset Request</h3>
                <p style="color: #475569; line-height: 1.6;">Hello ${user.name},<br/><br/>You recently requested to reset your password for your IntellMeet account. Click the button below to proceed.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #ef4444; font-size: 14px; font-weight: bold;">This link is only valid for 10 minutes.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
        `;

        try {
            await sendEmail({ email: user.email, subject: 'IntellMeet - Password Reset', html: message });
            res.status(200).json({ message: 'Password reset link sent to your email.' });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
        }
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');
        const user = await User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } });

        if (!user) return res.status(400).json({ message: 'Invalid or expired token. Please request a new one.' });

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password has been reset successfully. You can now login.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'intellmeet_avatars',
            width: 250,
            height: 250,
            crop: "fill", 
            gravity: "face" 
        });

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { profilePic: result.secure_url },
            { returnDocument: 'after' } 
        ).select('-password');

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("CLOUDINARY ERROR:", error);
        res.status(500).json({ message: 'Image upload failed', error: error.message });
    }
};