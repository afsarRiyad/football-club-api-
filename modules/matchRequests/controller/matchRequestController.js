const MatchRequest = require("../model/MatchRequest");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");
const { escapeRegex } = require("../../../utils/textGuards");

// Get all match requests (with filters)
exports.getAllMatchRequests = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.status) filter.status = req.query.status;

  // Text search across requesterName, requesterEmail, teamName.
  // The term is escaped before it reaches `$regex`: unescaped, a caller could
  // pass a regex (`(?=)`-style lookaheads error out, `(a+)+$` pins the CPU) and
  // the admin search box would be a remote DoS lever. `$`-prefixed keys are
  // already stripped from the query by express-mongo-sanitize.
  if (req.query.search) {
    const term = String(req.query.search).trim().slice(0, 100);
    if (term) {
      const searchRegex = { $regex: escapeRegex(term), $options: "i" };
      filter.$or = [
        { requesterName: searchRegex },
        { requesterEmail: searchRegex },
        { teamName: searchRegex },
      ];
    }
  }

  // Clamped so `?limit=1000000` cannot ask Mongo for the whole collection.
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    MatchRequest.find(filter).sort("-createdAt").skip(skip).limit(limit),
    MatchRequest.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    results: requests.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: requests,
  });
});

// Get single match request
exports.getMatchRequest = catchAsync(async (req, res, next) => {
  const request = await MatchRequest.findById(req.params.id);

  if (!request) {
    return next(new AppError("Match request not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { request },
  });
});

// Create match request (public — no auth required)
exports.createMatchRequest = catchAsync(async (req, res, next) => {
  const { club, requesterName, requesterEmail, requesterPhone, teamName, preferredDate, preferredVenue, message } = req.body;

  if (!club || !requesterName || !requesterEmail || !teamName) {
    return next(new AppError("club, requesterName, requesterEmail, and teamName are required.", 400));
  }

  const request = await MatchRequest.create({
    club,
    requesterName,
    requesterEmail,
    requesterPhone,
    teamName,
    preferredDate,
    preferredVenue,
    message,
  });

  res.status(201).json({
    success: true,
    data: { request },
  });
});

// Update match request status (admin)
exports.updateMatchRequest = catchAsync(async (req, res, next) => {
  const { status, adminNotes } = req.body;

  const request = await MatchRequest.findById(req.params.id);
  if (!request) {
    return next(new AppError("Match request not found.", 404));
  }

  if (status) request.status = status;
  if (adminNotes !== undefined) request.adminNotes = adminNotes;
  await request.save();

  res.status(200).json({
    success: true,
    data: { request },
  });
});

// Delete match request
exports.deleteMatchRequest = catchAsync(async (req, res, next) => {
  const request = await MatchRequest.findByIdAndDelete(req.params.id);

  if (!request) {
    return next(new AppError("Match request not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Match request deleted successfully.",
  });
});
