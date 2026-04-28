import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JwtPayload {
  username: string;
  email: string;
  name: string;
  sub: number; // user id
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const result = jwt.verify(token, JWT_SECRET);
    if (typeof result === 'string') return null;
    return result as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function getAuthUser(authHeader?: string | null): JwtPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  return verifyToken(token);
}
