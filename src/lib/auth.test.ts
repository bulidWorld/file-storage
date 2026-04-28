import { signToken, verifyToken, getAuthUser, JwtPayload } from './auth';

describe('Auth Library', () => {
  const testPayload: JwtPayload = {
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    sub: 123,
  };

  describe('signToken', () => {
    it('should sign a valid token', () => {
      const token = signToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload data', () => {
      const token = signToken(testPayload);
      const decoded = verifyToken(token);
      expect(decoded?.username).toBe(testPayload.username);
      expect(decoded?.email).toBe(testPayload.email);
      expect(decoded?.sub).toBe(testPayload.sub);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = signToken(testPayload);
      const result = verifyToken(token);
      expect(result).toBeDefined();
      expect(result?.username).toBe(testPayload.username);
    });

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      const result = verifyToken('not-a-jwt');
      expect(result).toBeNull();
    });
  });

  describe('getAuthUser', () => {
    it('should extract user from valid auth header', () => {
      const token = signToken(testPayload);
      const result = getAuthUser(`Bearer ${token}`);
      expect(result).toBeDefined();
      expect(result?.username).toBe(testPayload.username);
    });

    it('should return null for missing header', () => {
      const result = getAuthUser(null);
      expect(result).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const result = getAuthUser('InvalidFormat');
      expect(result).toBeNull();
    });

    it('should return null for empty string header', () => {
      const result = getAuthUser('');
      expect(result).toBeNull();
    });

    it('should return null for invalid token in header', () => {
      const result = getAuthUser('Bearer invalid.token');
      expect(result).toBeNull();
    });
  });
});
