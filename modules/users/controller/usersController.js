const User = require("../../auth/model/User");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.role) {
    filter.role = req.query.role;
  }
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ];
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: users.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: users,
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

exports.updateUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;

  if (!role) {
    return next(new AppError("Role is required.", 400));
  }

  // Only super admin can change roles
  if (req.user.role !== "SUPER_ADMIN") {
    return next(new AppError("Only super admins can change user roles.", 403));
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  user.role = role;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: { user },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const { name, email, photo, role, isActive } = req.body;

  // Users can update their own profile; admins can update anyone
  const isOwnProfile = req.params.id === req.user.id;
  const isAdmin = ["SUPER_ADMIN", "CLUB_ADMIN"].includes(req.user.role);

  if (!isOwnProfile && !isAdmin) {
    return next(new AppError("You can only update your own profile.", 403));
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  if (name) user.name = name;
  if (email) user.email = email;
  if (photo !== undefined) user.photo = photo;
  // Admins can update role and isActive
  if (isAdmin && role) user.role = role;
  if (isAdmin && isActive !== undefined) user.isActive = isActive;

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: { user },
  });
});

exports.deactivateUser = catchAsync(async (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "CLUB_ADMIN") {
    return next(new AppError("You do not have permission to deactivate users.", 403));
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  user.isActive = false;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "User deactivated successfully.",
  });
});

exports.activateUser = catchAsync(async (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN" && req.user.role !== "CLUB_ADMIN") {
    return next(new AppError("You do not have permission to activate users.", 403));
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  user.isActive = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "User activated successfully.",
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return next(new AppError("Only super admins can delete users.", 403));
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully.",
  });
});
