import { createLdapClient } from '@naze/ldap-client';
import { logger as appLogger } from '@/utils/server-logger';

export interface LdapUser {
  username: string;
  email: string;
  name: string;
  dn: string;
}

interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindCredentials: string;
}

const logger = {
  log: (msg: string) => appLogger.info(msg),
  error: (msg: string) => appLogger.error(msg),
  warn: (msg: string) => appLogger.warn(msg),
};

export async function authenticateLdap(
  username: string,
  password: string
): Promise<{ success: boolean; user?: LdapUser; error?: string }> {
  const config: LdapConfig = {
    url: process.env.LDAP_URL || 'ldap://192.168.110.5:389',
    baseDn: process.env.LDAP_BASE_DN || 'dc=naze',
    bindDn: process.env.LDAP_BIND_DN || 'cn=admin,dc=naze',
    bindCredentials: process.env.LDAP_BIND_CREDENTIALS || 'Naze666666',
  };

  logger.log(`LDAP: connecting to ${config.url}`);

  // Step 1: Connect and bind with admin credentials
  const adminClient = createLdapClient(config.url, 5000);

  try {
    const bindResult = await adminClient.bind(config.bindDn, config.bindCredentials);
    if (!bindResult.success) {
      logger.error(`LDAP admin bind failed: ${bindResult.error}`);
      return { success: false, error: `LDAP admin bind failed: ${bindResult.error}` };
    }
    logger.log('LDAP admin bind successful');

    // Step 2: Search for the user
    const searchResult = await adminClient.search(
      config.baseDn,
      `(|(uid=${username})(cn=${username})(mail=${username}))`,
    );
    if (!searchResult.success || searchResult.entries.length === 0) {
      logger.warn(`User '${username}' not found in LDAP`);
      adminClient.unbind();
      return { success: false, error: 'User not found' };
    }

    const entry = searchResult.entries[0];
    logger.log(`User found, DN: ${entry.dn}`);

    // Step 3: Bind with user DN to verify password
    const userClient = createLdapClient(config.url, 5000);
    const userBindResult = await userClient.bind(entry.dn, password);
    userClient.unbind();
    adminClient.unbind();

    if (!userBindResult.success) {
      logger.error(`User bind failed: ${userBindResult.error}`);
      return { success: false, error: 'Invalid credentials' };
    }

    logger.log(`User bind successful for: ${username}`);

    const attr = (name: string) => entry.attributes[name.toLowerCase()] || entry.attributes[name];

    return {
      success: true,
      user: {
        username: attr('uid') || username,
        email: attr('mail') || `${username}@naze`,
        name: attr('cn') || attr('displayName') || attr('sn') || username,
        dn: entry.dn,
      },
    };
  } catch (err) {
    adminClient.unbind();
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`LDAP error: ${msg}`);
    return { success: false, error: msg };
  }
}
