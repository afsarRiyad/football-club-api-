const jwt = require("jsonwebtoken");
const User = require("../model/User");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_EXPIRES_IN === "7d" ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000)
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  // Remove password from output
  user.password = undefined;

  res.cookie("jwt", token, cookieOptions);

  res.status(statusCode).json({
    success: true,
    token,
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
  createSendToken(user, 201, res);
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

  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ success: true, message: "Logged out successfully." });
};

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});
