const Member = require("../model/Member");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createMember = catchAsync(async (req, res, next) => {
  const member = await Member.create(req.body);

  res.status(201).json({
    success: true,
    data: { member },
  });
});

exports.getAllMembers = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.membershipType) filter.membershipType = req.query.membershipType;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const total = await Member.countDocuments(filter);
  const members = await Member.find(filter)
    .populate("user", "name email photo")
    .populate("club", "name slug")
    .sort("-joinDate")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: members.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: { members },
  });
});

exports.getMember = catchAsync(async (req, res, next) => {
  const member = await Member.findById(req.params.id)
    .populate("user", "name email photo")
    .populate("club", "name slug logo");

  if (!member) {
    return next(new AppError("Member not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { member },
  });
});

exports.updateMember = catchAsync(async (req, res, next) => {
  const member = await Member.findById(req.params.id);

  if (!member) {
    return next(new AppError("Member not found.", 404));
  }

  const updated = await Member.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { member: updated },
  });
});

exports.deleteMember = catchAsync(async (req, res, next) => {
  const member = await Member.findByIdAndDelete(req.params.id);

  if (!member) {
    return next(new AppError("Member not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Member removed successfully.",
  });
});

exports.upgradeMembership = catchAsync(async (req, res, next) => {
  const member = await Member.findById(req.params.id);

  if (!member) {
    return next(new AppError("Member not found.", 404));
  }

  const { membershipType, expiryDate } = req.body;
  if (!membershipType) {
    return next(new AppError("Membership type is required.", 400));
  }

  member.membershipType = membershipType;
  if (expiryDate) member.expiryDate = new Date(expiryDate);
  await member.save();

  res.status(200).json({
    success: true,
    data: { member },
  });
});
