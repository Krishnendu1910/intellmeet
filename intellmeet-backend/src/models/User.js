const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); 
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpire: Date,

    resetPasswordToken: String,
    resetPasswordExpire: Date
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return; 
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.getResetPasswordToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    return resetToken;
};

userSchema.methods.getVerificationToken = function() {
    const verifyToken = crypto.randomBytes(20).toString('hex');
    this.verificationToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
    this.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours valid
    return verifyToken;
};

module.exports = mongoose.model('User', userSchema);