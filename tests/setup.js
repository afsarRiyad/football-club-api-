/**
 * Jest test setup file.
 * Runs before each test file.
 */

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_for_testing";
process.env.JWT_EXPIRES_IN = "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
process.env.MONGODB_URI = "mongodb://localhost:27017/football-club-test";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";

// Increase timeout for database operations
jest.setTimeout(30000);

// Track users for testing
const mockUsers = new Map();

// Mock bcrypt
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashedpassword"),
  compare: jest.fn().mockImplementation((candidate, hashed) => {
    return Promise.resolve(candidate === "password123");
  }),
}));

// Mock token utilities
const mockTokenUtils = {
  generateAccessToken: jest.fn((userId) => `access_token_${userId}`),
  generateRefreshToken: jest.fn(() => `refresh_token_${Date.now()}`),
  hashRefreshToken: jest.fn((token) => `hashed_${token}`),
  calculateRefreshTokenExpiry: jest.fn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  verifyAccessToken: jest.fn((token) => ({ id: "test-user-id" })),
  generateTokenPair: jest.fn((userId) => {
    const refreshToken = `refresh_token_${Date.now()}`;
    const hashedRefreshToken = `hashed_${refreshToken}`;
    
    // Store refresh token in mock users
    for (const user of mockUsers.values()) {
      if (user._id === userId) {
        user.refreshToken = hashedRefreshToken;
        user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
    }
    
    return {
      accessToken: `access_token_${userId}`,
      refreshToken: refreshToken,
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresIn: "7d",
    };
  }),
};

jest.mock("../utils/token", () => mockTokenUtils);

jest.mock("../modules/auth/model/User", () => ({
  findOne: jest.fn().mockImplementation((query) => {
    const email = query.email;
    if (mockUsers.has(email)) {
      const user = mockUsers.get(email);
      // Return a user with select method support
      return Promise.resolve({
        ...user,
        select: jest.fn().mockReturnThis(),
        save: jest.fn().mockImplementation(function() {
          this.lastLogin = new Date();
          return Promise.resolve(this);
        }),
      });
    }
    // Handle refresh token lookup
    if (query.refreshToken) {
      for (const user of mockUsers.values()) {
        if (user.refreshToken === query.refreshToken) {
          return Promise.resolve({
            ...user,
            select: jest.fn().mockReturnThis(),
            save: jest.fn().mockImplementation(function() {
              return Promise.resolve(this);
            }),
          });
        }
      }
    }
    return Promise.resolve(null);
  }),
  create: jest.fn().mockImplementation((data) => {
    const newUserId = "test-user-id-" + Date.now();
    const newUser = {
      _id: newUserId,
      name: data.name,
      email: data.email,
      password: "hashedpassword",
      role: "USER",
      comparePassword: jest.fn().mockImplementation((candidate) => {
        return Promise.resolve(candidate === "password123");
      }),
      save: jest.fn().mockImplementation(function() {
        return Promise.resolve(this);
      }),
      select: jest.fn().mockReturnThis(),
    };
    mockUsers.set(data.email, newUser);
    // Also store by ID for findById
    mockUsers.set(newUserId, newUser);
    return Promise.resolve(newUser);
  }),
  findById: jest.fn().mockImplementation((id) => {
    if (mockUsers.has(id)) {
      return Promise.resolve({
        ...mockUsers.get(id),
        select: jest.fn().mockReturnThis(),
      });
    }
    // Also check for users by email
    for (const user of mockUsers.values()) {
      if (user._id === id) {
        return Promise.resolve({
          ...user,
          select: jest.fn().mockReturnThis(),
        });
      }
    }
    return Promise.resolve(null);
  }),
  findByIdAndUpdate: jest.fn().mockResolvedValue(true),
}));

// Mock Member model for getMe endpoint
jest.mock("../modules/members/model/Member", () => ({
  findOne: jest.fn().mockResolvedValue(null),
}));

// Mock the auth middleware
const mockProtect = jest.fn((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route"
    });
  }
  // Use the first user ID from our mock
  const firstUserId = Array.from(mockUsers.values())[0]?._id || "test-user-id";
  req.user = { id: firstUserId };
  next();
});

jest.mock("../middleware/auth", () => ({
  protect: mockProtect,
}));

// Export mock users for test usage
global.mockUsers = mockUsers;
global.mockProtect = mockProtect;
global.mockTokenUtils = mockTokenUtils;

// Suppress console logs during tests
global.console = { ...console, log: jest.fn(), warn: jest.fn(), error: jest.fn() };
