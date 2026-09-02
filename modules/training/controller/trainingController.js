const Training = require("../model/Training");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createTraining = catchAsync(async (req, res, next) => {
  const training = await Training.create(req.body);

  res.status(201).json({
    success: true,
    data: { training },
  });
});

exports.getAllTrainings = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.team) filter.team = req.query.team;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: "i" };
  }

  const total = await Training.countDocuments(filter);
  const sessions = await Training.find(filter)
    .populate("club", "name slug")
    .populate("team", "name slug")
    .populate("coach", "name email")
    .sort("-date")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: sessions.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: sessions,
  });
});

exports.getTraining = catchAsync(async (req, res, next) => {
  const training = await Training.findById(req.params.id)
    .populate("club", "name slug")
    .populate("team", "name slug")
    .populate("coach", "name email")
    .populate("attendance.player", "firstName lastName number position");

  if (!training) {
    return next(new AppError("Training session not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { training },
  });
});

exports.updateTraining = catchAsync(async (req, res, next) => {
  const training = await Training.findById(req.params.id);

  if (!training) {
    return next(new AppError("Training session not found.", 404));
  }

  const updated = await Training.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { training: updated },
  });
});

exports.deleteTraining = catchAsync(async (req, res, next) => {
  const training = await Training.findByIdAndDelete(req.params.id);

  if (!training) {
    return next(new AppError("Training session not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Training session deleted successfully.",
  });
});

exports.markAttendance = catchAsync(async (req, res, next) => {
  const training = await Training.findById(req.params.id);

  if (!training) {
    return next(new AppError("Training session not found.", 404));
  }

  const { playerId, status, notes } = req.body;

  // Update existing attendance or add new
  const existingIndex = training.attendance.findIndex(
    (a) => a.player.toString() === playerId
  );

  if (existingIndex > -1) {
    training.attendance[existingIndex].status = status;
    if (notes) training.attendance[existingIndex].notes = notes;
  } else {
    training.attendance.push({ player: playerId, status, notes });
  }

  await training.save();

  res.status(200).json({
    success: true,
    data: { training },
  });
});
