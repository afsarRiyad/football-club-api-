const AppError = require("../utils/AppError");

const handleCastErrorDB = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue ? Object.values(err.keyValue)[0] : "";
  return new AppError(`Duplicate field value: ${value}. Please use another value.`, 400);
};

const handleValidationErrorDB = (err) => {
  const messages = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Validation error: ${messages.join(". ")}`, 400);
};

const handleJWTError = () => {
  return new AppError("Invalid token. Please log in again.", 401);
};

const handleJWTExpiredError = () => {
  return new AppError("Token has expired. Please log in again.", 401);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  } else {
    console.error("ERROR 💥", err);
    res.status(500).json({
      success: false,
      message: "Something went very wrong!",
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Guard: never leave a request hanging. Previously this handler only sent a
  // response when NODE_ENV was exactly "development" or "production" — on hosts
  // where NODE_ENV is unset (e.g. Render with `node server.js`), every error
  // (401, validation, failed login…) silently fell through and the request
  // hung until the client timed out.
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    sendErrorDev(err, res);
    return;
  }

  let error = { ...err, message: err.message };

  if (err.name === "CastError") error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === "ValidationError") error = handleValidationErrorDB(err);
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

  sendErrorProd(error, res);
};

module.exports = errorHandler;
