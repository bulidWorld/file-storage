import ldap from 'ldapjs';
import { logger as appLogger } from '@/utils/server-logger';

export interface LdapUser {
  username: string;
  email: string;
  name: string;
  dn: string;
}

export interface LdapConfig {
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

function getAttribute(attributes: any, name: string): string | undefined {
  // Handle array format: [{ type: 'uid', values: ['testuser'] }, ...]
  if (Array.isArray(attributes)) {
    const attr = attributes.find((a: any) => a?.type?.toLowerCase() === name.toLowerCase());
    if (!attr?.values) return undefined;
    const value = Array.isArray(attr.values) ? attr.values[0] : attr.values;
    return value ? String(value) : undefined;
  }
  // Handle object format: { uid: ['testuser'], mail: ['test@naze'], cn: ['Test User'] }
  if (attributes && typeof attributes === 'object') {
    // Try exact match first, then case-insensitive
    const keys = Object.keys(attributes);
    const match = keys.find(k => k.toLowerCase() === name.toLowerCase());
    if (match) {
      const val = attributes[match];
      if (Array.isArray(val)) return val[0] ? String(val[0]) : undefined;
      if (val) return String(val);
    }
  }
  return undefined;
}

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

  logger.log(`LDAP Config: url=${config.url}, baseDn=${config.baseDn}, bindDn=${config.bindDn}`);
  logger.log(`Attempting to authenticate user: ${username}`);

  return new Promise((resolve) => {
    const client = ldap.createClient({
      url: config.url,
      connectTimeout: 5000,
    });

    client.on('error', (err: Error) => {
      logger.error(`LDAP connection error: ${err.message}`);
      resolve({ success: false, error: `LDAP connection error: ${err.message}` });
    });

    client.on('connect', () => {
      logger.log('LDAP connected successfully');

      // First bind with admin credentials
      client.bind(config.bindDn, config.bindCredentials, (bindErr: any) => {
        if (bindErr) {
          logger.error(`LDAP admin bind failed: ${bindErr.message}`);
          client.unbind();
          resolve({ success: false, error: `LDAP admin bind failed: ${bindErr.message}` });
          return;
        }
        logger.log('LDAP admin bind successful');

        // Search for the user
        const searchFilter = `(|(uid=${username})(cn=${username})(mail=${username}))`;
        const searchOptions: ldap.SearchOptions = {
          scope: 'sub',
          filter: searchFilter,
        };

        logger.log(`Searching for user with filter: ${searchFilter}, baseDn: ${config.baseDn}`);

        client.search(config.baseDn, searchOptions, (searchErr: any, res: any) => {
          if (searchErr) {
            logger.error(`LDAP search failed: ${searchErr.message}`);
            client.unbind();
            resolve({ success: false, error: `LDAP search failed: ${searchErr.message}` });
            return;
          }

          let userEntry: any = null;
          let searchFinished = false;

          res.on('searchEntry', (entry: any) => {
            logger.log(`Found user entry: ${entry.object?.dn || entry.objectName || entry.dn}`);
            // Store the full entry with DN
            userEntry = {
              object: entry.object || entry.attributes || {},
              dn: entry.dn || entry.objectName,
              objectName: entry.objectName || entry.dn,
            };
          });

          res.on('end', () => {
            if (searchFinished) return;
            searchFinished = true;

            if (!userEntry) {
              logger.warn(`User '${username}' not found in LDAP`);
              client.unbind();
              resolve({ success: false, error: 'User not found' });
              return;
            }

            logger.log(`User found, DN: ${userEntry.dn || userEntry.objectName}`);

            // Try to bind with user credentials
            // Handle both string DN and LdapDn object
            let userDn: string;
            if (typeof userEntry.dn === 'string') {
              userDn = userEntry.dn;
            } else if (userEntry.dn && typeof userEntry.dn.toString === 'function') {
              userDn = userEntry.dn.toString();
            } else if (userEntry.objectName) {
              userDn = typeof userEntry.objectName === 'string'
                ? userEntry.objectName
                : userEntry.objectName.toString();
            } else {
              userDn = `uid=${username},${config.baseDn}`;
            }

            logger.log(`Attempting user bind with DN: ${userDn}`);

            const userClient = ldap.createClient({
              url: config.url,
              connectTimeout: 5000,
            });

            userClient.bind(userDn, password, (userBindErr: any) => {
              userClient.unbind();
              client.unbind();

              if (userBindErr) {
                logger.error(`User bind failed: ${userBindErr.message}`);
                resolve({ success: false, error: 'Invalid credentials' });
                return;
              }

              logger.log(`User bind successful for: ${username}`);

              // Authentication successful - extract user data from LDAP attributes
              const attrs = userEntry.object || {};
              const getAttr = (name: string) => getAttribute(attrs, name);

              resolve({
                success: true,
                user: {
                  username: getAttr('uid') || username,
                  email: getAttr('mail') || `${username}@naze`,
                  name: getAttr('cn') || getAttr('displayName') || getAttr('sn') || username,
                  dn: userDn,
                },
              });
            });
          });
        });
      });
    });

    client.on('connectTimeout', () => {
      logger.error('LDAP connection timeout');
      resolve({ success: false, error: 'LDAP connection timeout' });
    });
  });
}
