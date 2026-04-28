import { NextRequest, NextResponse } from 'next/server';
import { authenticateLdap } from '@/lib/ldap';
import { signToken } from '@/lib/auth';
import { store } from '@/lib/store';
import { logger } from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Authenticate with LDAP
    const ldapResult = await authenticateLdap(username, password);

    if (!ldapResult.success) {
      return NextResponse.json(
        { error: ldapResult.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const ldapUser = ldapResult.user!;

    // Sync user to store
    let dbUser = await store.users.findUnique({
      username: ldapUser.username,
    });

    if (dbUser) {
      dbUser = await store.users.update({
        id: dbUser.id,
        data: {
          email: ldapUser.email,
          name: ldapUser.name,
          dn: ldapUser.dn,
        },
      });
    } else {
      dbUser = await store.users.create({
        username: ldapUser.username,
        email: ldapUser.email,
        name: ldapUser.name || ldapUser.username,
        dn: ldapUser.dn,
      });
    }

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Ensure user is member of default group
    const defaultGroup = await store.groups.findOrCreateDefault();
    const member = await store.groups.getMember(defaultGroup.id, dbUser.id);
    if (!member) {
      await store.groups.addMember(defaultGroup.id, dbUser.id);
    }

    // Generate JWT token
    const token = signToken({
      username: dbUser.username,
      email: dbUser.email,
      name: dbUser.name || '',
      sub: dbUser.id,
    });

    return NextResponse.json({
      access_token: token,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        name: dbUser.name,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
