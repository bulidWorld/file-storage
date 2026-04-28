import { POST } from './route';
import { authenticateLdap } from '@/lib/ldap';
import { store } from '@/lib/store';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/ldap', () => ({
  authenticateLdap: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(() => 'mock-jwt-token'),
}));

jest.mock('@/lib/store', () => ({
  store: {
    groups: {
      findOrCreateDefault: jest.fn(() => Promise.resolve({ id: 1, name: 'default' })),
      getMember: jest.fn(() => Promise.resolve(null)),
      addMember: jest.fn(() => Promise.resolve()),
    },
    users: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
  prisma: {
    $disconnect: jest.fn(),
  },
}));

describe('Login API', () => {
  const mockLdapUser = {
    username: 'testuser',
    email: 'testuser@naze',
    name: 'Test User',
    dn: 'uid=testuser,dc=naze',
  };

  const mockDbUser = {
    id: 1,
    publicId: 'user-123',
    username: 'testuser',
    email: 'testuser@naze',
    name: 'Test User',
    dn: 'uid=testuser,dc=naze',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error when username is missing', async () => {
    const request = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should return error when password is missing', async () => {
    const request = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should return error when LDAP authentication fails', async () => {
    (authenticateLdap as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    const request = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'test', password: 'wrong' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('should return token when authentication succeeds', async () => {
    (authenticateLdap as jest.Mock).mockResolvedValue({
      success: true,
      user: mockLdapUser,
    });

    (store.users.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
    (store.users.update as jest.Mock).mockResolvedValue(mockDbUser);

    const request = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'correct' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.access_token).toBe('mock-jwt-token');
    expect(data.user).toBeDefined();
  });

  it('should create user if not exists in database', async () => {
    (authenticateLdap as jest.Mock).mockResolvedValue({
      success: true,
      user: mockLdapUser,
    });

    (store.users.findUnique as jest.Mock).mockResolvedValue(null);
    (store.users.create as jest.Mock).mockResolvedValue(mockDbUser);

    const request = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'newuser', password: 'correct' }),
    });

    await POST(request);

    expect(store.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: mockLdapUser.username,
        email: mockLdapUser.email,
        name: mockLdapUser.name,
        dn: mockLdapUser.dn,
      })
    );
  });

  it('should update existing user from LDAP', async () => {
    (authenticateLdap as jest.Mock).mockResolvedValue({
      success: true,
      user: { ...mockLdapUser, email: 'updated@naze' },
    });

    (store.users.findUnique as jest.Mock).mockResolvedValue(mockDbUser);
    (store.users.update as jest.Mock).mockResolvedValue({
      ...mockDbUser,
      email: 'updated@naze',
    });

    const request = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'correct' }),
    });

    await POST(request);

    expect(store.users.update).toHaveBeenCalled();
  });
});
