const jwt = require("jsonwebtoken");
const User = require("../model/User");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  calculateRefreshTokenExpiry,
  generateTokenPair,
} = require("../../../utils/token");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = async (user, statusCode, res) => {
  const tokenPair = generateTokenPair(user._id);
  
  // Hash refresh token and store in database
  const hashedRefreshToken = hashRefreshToken(tokenPair.refreshToken);
  user.refreshToken = hashedRefreshToken;
  user.refreshTokenExpires = calculateRefreshTokenExpiry();
  await user.save({ validateBeforeSave: false });

  const accessTokenCookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_EXPIRES_IN === "7d" ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000)
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  const refreshTokenCookieOptions = {
    expires: calculateRefreshTokenExpiry(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/refresh-token",
  };

  // Remove password from output
  user.password = undefined;

  res.cookie("accessToken", tokenPair.accessToken, accessTokenCookieOptions);
  res.cookie("refreshToken", tokenPair.refreshToken, refreshTokenCookieOptions);

  res.status(statusCode).json({
    success: true,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: tokenPair.accessTokenExpiresIn,
    data: { user },
  });
};

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError("Email already in use.", 400));
  }

  const user = await User.create({ name, email, password });
  await createSendToken(user, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password.", 400));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Incorrect email or password.", 401));
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  await createSendToken(user, 200, res);
});

exports.logout = catchAsync(async (req, res, next) => {
  // Clear refresh token from database
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: undefined,
      refreshTokenExpires: undefined,
    });
  }

  // Clear cookies
  res.cookie("accessToken", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  
  res.cookie("refreshToken", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    path: "/api/auth/refresh-token",
  });

  res.status(200).json({ success: true, message: "Logged out successfully." });
});

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  // If member, include membership data
  let membership = null;
  if (user.role === "MEMBER") {
    const Member = require("../../members/model/Member");
    membership = await Member.findOne({ user: user._id })
      .populate("club", "name slug logo");
  }

  res.status(200).json({
    success: true,
    data: { user, membership },
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new AppError("Please provide current password, new password, and confirm password.", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError("New password and confirm password do not match.", 400));
  }

  if (newPassword.length < 8) {
    return next(new AppError("Password must be at least 8 characters.", 400));
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  const isCorrect = await user.comparePassword(currentPassword);
  if (!isCorrect) {
    return next(new AppError("Current password is incorrect.", 401));
  }

  user.password = newPassword;
  await user.save();

  // Send new token
  await createSendToken(user, 200, res);
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Please provide your email address.", 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if user exists
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    });
  }

  // Generate reset token
  const crypto = require("crypto");
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save({ validateBeforeSave: false });

  // In production, send email with reset URL
  // For now, return the token (dev only)
  const resetURL = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${resetToken}`;

  res.status(200).json({
    success: true,
    message: "If an account with that email exists, a reset link has been sent.",
    ...(process.env.NODE_ENV === "development" && { resetToken, resetURL }),
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    return next(new AppError("Please provide token, password, and confirm password.", 400));
  }

  if (password !== confirmPassword) {
    return next(new AppError("Password and confirm password do not match.", 400));
  }

  if (password.length < 8) {
    return next(new AppError("Password must be at least 8 characters.", 400));
  }

  const crypto = require("crypto");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Token is invalid or has expired.", 400));
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await createSendToken(user, 200, res);
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return next(new AppError("Refresh token not found. Please login again.", 401));
  }

  // Hash the refresh token from cookie
  const hashedRefreshToken = hashRefreshToken(refreshToken);

  // Find user with this refresh token
  const user = await User.findOne({
    refreshToken: hashedRefreshToken,
    refreshTokenExpires: { $gt: Date.now() },
  }).select("+refreshToken +refreshTokenExpires");

  if (!user) {
    return next(new AppError("Invalid or expired refresh token. Please login again.", 401));
  }

  // Generate new token pair
  const tokenPair = generateTokenPair(user._id);
  
  // Update refresh token in database (token rotation)
  const newHashedRefreshToken = hashRefreshToken(tokenPair.refreshToken);
  user.refreshToken = newHashedRefreshToken;
  user.refreshTokenExpires = calculateRefreshTokenExpiry();
  await user.save({ validateBeforeSave: false });

  const accessTokenCookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_EXPIRES_IN === "7d" ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000)
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  const refreshTokenCookieOptions = {
    expires: calculateRefreshTokenExpiry(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/refresh-token",
  };

  // Remove password from output
  user.password = undefined;

  res.cookie("accessToken", tokenPair.accessToken, accessTokenCookieOptions);
  res.cookie("refreshToken", tokenPair.refreshToken, refreshTokenCookieOptions);

  res.status(200).json({
    success: true,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    expiresIn: tokenPair.accessTokenExpiresIn,
    data: { user },
  });
});
