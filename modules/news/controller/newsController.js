const News = require("../model/News");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createNews = catchAsync(async (req, res, next) => {
  const news = await News.create({
    ...req.body,
    author: req.user.id,
  });

  res.status(201).json({
    success: true,
    data: { news },
  });
});

exports.getAllNews = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.tag) filter.tags = req.query.tag;

  // Non-admins only see published articles
  const isAdmin = req.user && ["SUPER_ADMIN", "CLUB_ADMIN"].includes(req.user.role);
  if (!isAdmin) {
    filter.isPublished = true;
  } else if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === "true";
  }

  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: "i" } },
      { excerpt: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const total = await News.countDocuments(filter);
  const articles = await News.find(filter)
    .populate("author", "name photo")
    .populate("club", "name slug")
    .sort("-publishedAt -createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: articles.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: { articles },
  });
});

exports.getNews = catchAsync(async (req, res, next) => {
  const article = await News.findById(req.params.id)
    .populate("author", "name photo")
    .populate("club", "name slug logo");

  if (!article) {
    return next(new AppError("Article not found.", 404));
  }

  // Increment views
  article.views += 1;
  await article.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: { article },
  });
});

exports.updateNews = catchAsync(async (req, res, next) => {
  const article = await News.findById(req.params.id);

  if (!article) {
    return next(new AppError("Article not found.", 404));
  }

  const updated = await News.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { article: updated },
  });
});

exports.deleteNews = catchAsync(async (req, res, next) => {
  const article = await News.findByIdAndDelete(req.params.id);

  if (!article) {
    return next(new AppError("Article not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Article deleted successfully.",
  });
});

exports.publishNews = catchAsync(async (req, res, next) => {
  const article = await News.findById(req.params.id);

  if (!article) {
    return next(new AppError("Article not found.", 404));
  }

  article.isPublished = true;
  await article.save();

  res.status(200).json({
    success: true,
    data: { article },
  });
});

exports.unpublishNews = catchAsync(async (req, res, next) => {
  const article = await News.findById(req.params.id);

  if (!article) {
    return next(new AppError("Article not found.", 404));
  }

  article.isPublished = false;
  await article.save();

  res.status(200).json({
    success: true,
    data: { article },
  });
});
