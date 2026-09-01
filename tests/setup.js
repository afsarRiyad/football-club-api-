/**
 * Jest test setup file.
 * Runs before each test file.
 */

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_for_testing";
process.env.JWT_EXPIRES_IN = "1d";
process.env.MONGODB_URI = "mongodb://localhost:27017/football-club-test";

// Increase timeout for database operations
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
// Uncomment the line below if logs are too noisy:
// global.console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn() };
