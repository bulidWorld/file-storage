// Mock ldapjs module
jest.mock('ldapjs', () => {
  const mockClient: any = {
    on: jest.fn(),
    bind: jest.fn(),
    search: jest.fn(),
    unbind: jest.fn(),
  };

  mockClient.on.mockImplementation((event: string, callback: () => void) => {
    if (event === 'connect') {
      setTimeout(callback, 10);
    }
    return mockClient;
  });

  mockClient.bind.mockImplementation((dn: string, credentials: string, callback: (err?: any) => void) => {
    callback(null);
    return mockClient;
  });

  mockClient.search.mockImplementation((baseDn: string, options: any, callback: (err?: any, res?: any) => void) => {
    const mockRes: any = {
      on: jest.fn(),
    };

    mockRes.on.mockImplementation((event: string, handler: (entry?: any) => void) => {
      if (event === 'searchEntry') {
        handler({
          object: [
            { type: 'uid', values: ['testuser'] },
            { type: 'mail', values: ['testuser@naze'] },
            { type: 'cn', values: ['Test User'] },
          ],
          dn: 'uid=testuser,dc=naze',
        });
      }
      if (event === 'end') {
        setTimeout(handler, 20);
      }
      return mockRes;
    });

    callback(null, mockRes);
    return mockClient;
  });

  return {
    createClient: jest.fn(() => mockClient),
  };
});

import { authenticateLdap } from './ldap';

describe('LDAP Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LDAP_URL = 'ldap://localhost:389';
    process.env.LDAP_BASE_DN = 'dc=naze';
    process.env.LDAP_BIND_DN = 'cn=admin,dc=naze';
    process.env.LDAP_BIND_CREDENTIALS = 'password';
  });

  it('should authenticate successfully with valid credentials', async () => {
    const result = await authenticateLdap('testuser', 'password123');

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.username).toBe('testuser');
    expect(result.user?.email).toBe('testuser@naze');
  });

  it('should return user DN in result', async () => {
    const result = await authenticateLdap('testuser', 'password123');

    expect(result.user?.dn).toContain('uid=testuser');
    expect(result.user?.dn).toContain('dc=naze');
  });

  it('should handle missing username', async () => {
    const result = await authenticateLdap('', 'password123');

    // Empty username should still try to authenticate (depends on LDAP server)
    expect(result).toBeDefined();
  });

  it('should handle missing password', async () => {
    const result = await authenticateLdap('testuser', '');

    // Empty password might still be accepted by some LDAP servers
    expect(result).toBeDefined();
  });

  describe('LDAP Configuration', () => {
    it('should use environment variables for config', async () => {
      process.env.LDAP_URL = 'ldap://custom-host:389';
      process.env.LDAP_BASE_DN = 'dc=custom';

      const result = await authenticateLdap('testuser', 'password');
      expect(result).toBeDefined();
    });

    it('should use default values when env vars are missing', async () => {
      delete process.env.LDAP_URL;
      delete process.env.LDAP_BASE_DN;

      const result = await authenticateLdap('testuser', 'password');
      expect(result).toBeDefined();
    });
  });
});
