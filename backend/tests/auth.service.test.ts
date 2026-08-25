/**
 * Day 39: Backend Tests - Auth Service Unit Tests
 */
import bcrypt from 'bcryptjs';

// ─── Mock external dependencies ────────────────────────────────────────────
jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../../src/utils/jwt', () => ({
  signAccessToken: jest.fn(() => 'mock-access-token'),
  signRefreshToken: jest.fn(() => 'mock-refresh-token'),
  verifyRefreshToken: jest.fn(),
}));

import { prisma } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { AuthService } from '../../src/services/auth.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── register ────────────────────────────────────────────────────────────
  describe('register', () => {
    it('should register a new user and return tokens + user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: null,
        passwordHash: 'hashed',
      });
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const result = await AuthService.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw 409 if email already exists', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        AuthService.register({
          email: 'existing@example.com',
          password: 'Password123!',
          firstName: 'Jane',
          lastName: 'Doe',
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should login with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 12);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-456',
        email: 'user@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        avatarUrl: null,
        passwordHash,
      });
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const result = await AuthService.login('user@example.com', 'Password123!');

      expect(result.user.id).toBe('user-456');
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('should throw 401 if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AuthService.login('unknown@example.com', 'pass')).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw 401 if password is wrong', async () => {
      const passwordHash = await bcrypt.hash('correct_pass', 12);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-789',
        email: 'user@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        avatarUrl: null,
        passwordHash,
      });

      await expect(AuthService.login('user@example.com', 'wrong_pass')).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('should delete the refresh token from redis', async () => {
      (mockRedis.del as jest.Mock).mockResolvedValue(1);

      await AuthService.logout('user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-123');
    });

    it('should not throw if redis is unavailable', async () => {
      (mockRedis.del as jest.Mock).mockRejectedValue(new Error('Redis down'));

      await expect(AuthService.logout('user-123')).resolves.toBeUndefined();
    });
  });

  // ─── checkEmail ───────────────────────────────────────────────────────────
  describe('checkEmail', () => {
    it('should return { exists: true } if email is taken', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'abc' });
      const result = await AuthService.checkEmail('taken@example.com');
      expect(result.exists).toBe(true);
    });

    it('should return { exists: false } if email is available', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await AuthService.checkEmail('free@example.com');
      expect(result.exists).toBe(false);
    });
  });
});
