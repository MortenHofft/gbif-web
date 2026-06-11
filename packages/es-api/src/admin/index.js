const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../logger');
const {
  getQueueNames,
  getQueueLimits,
  setQueueLimits,
  getShedSettings,
  setShedSettings,
} = require('../health/metrics');

/**
 * Runtime admin endpoint for the es-api.
 *
 * Exposes the settings that are safe to change without a redeploy — log level,
 * per-queue concurrency / max queue size, and the occurrence priority-shedding
 * config — and lets an authorised user adjust them live. Changes are in-memory
 * and ephemeral (reset on restart); this is for incident response / tuning.
 *
 * Authorisation reuses the GraphQL JWT: gbif-org mints a short-lived token for
 * the logged-in user (signed with the shared GraphQL JWT secret) and forwards
 * it here as a Bearer token. We verify the signature with that same secret and
 * read the user from the verified claims (userName + roles, which gbif-org
 * embeds). The user must be on the configured allowlist (`adminUsers`) or hold
 * one of `adminRoles`. Both default to empty, so this is fail-closed until
 * explicitly opened per environment.
 *
 * Config (.env): `graphqlJwtSecret`, `adminUsers`, `adminRoles`.
 */

const adminUsers = Array.isArray(config.adminUsers) ? config.adminUsers : [];
const adminRoles = Array.isArray(config.adminRoles) ? config.adminRoles : [];
const secret = config.graphqlJwtSecret;

// Verify the Bearer GraphQL JWT and return { userName, roles } or null.
function resolveUser(authorization) {
  if (typeof authorization !== 'string' || authorization === '') return null;
  const [type, value] = authorization.split(' ');
  if (type !== 'Bearer' || !value || !secret) return null;
  try {
    const decoded = jwt.verify(value, secret, { algorithms: ['HS256'] });
    let roles = [];
    if (Array.isArray(decoded.roles)) {
      roles = decoded.roles;
    } else if (typeof decoded.roles === 'string') {
      // gbif-org embeds roles as a JSON string.
      try {
        roles = JSON.parse(decoded.roles);
      } catch (e) {
        roles = [];
      }
    }
    return { userName: decoded.userName, roles };
  } catch (err) {
    return null;
  }
}

function isAuthorised(user) {
  if (!user || !user.userName) return false;
  if (adminUsers.includes(user.userName)) return true;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return adminRoles.some((role) => roles.includes(role));
}

function requireAdmin(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  const user = resolveUser(req.headers.authorization || req.headers.Authorization);
  if (!isAuthorised(user)) {
    // Uniform 403 — do not distinguish "not authenticated" from "not allowed".
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  req.adminUser = user;
  next();
}

function currentSettings() {
  return {
    logLevel: logger.getLogLevel(),
    queues: getQueueLimits(),
    shedding: getShedSettings(),
  };
}

function applySettings(req, res) {
  const body = req.body || {};
  const before = currentSettings();
  try {
    if (typeof body.logLevel !== 'undefined') logger.setLogLevel(body.logLevel);

    if (body.queues && typeof body.queues === 'object') {
      const known = new Set(getQueueNames());
      const unknown = Object.keys(body.queues).filter((q) => !known.has(q));
      if (unknown.length) {
        res
          .status(400)
          .json({ error: `Unknown queue(s): ${unknown.join(', ')}`, knownQueues: [...known] });
        return;
      }
      Object.entries(body.queues).forEach(([name, patch]) => {
        setQueueLimits(name, patch || {});
      });
    }

    if (body.shedding && typeof body.shedding === 'object') {
      Object.entries(body.shedding).forEach(([name, patch]) => {
        setShedSettings(name, patch || {});
      });
    }
  } catch (err) {
    logger.error('admin runtime settings update failed', { error: err.message });
    res.status(400).json({ error: err.message });
    return;
  }

  const after = currentSettings();
  // Audit trail: who changed what (warn so it survives the default log level).
  logger.warn('admin runtime settings changed', {
    actor: req.adminUser && req.adminUser.userName,
    requested: body,
    before,
    after,
  });

  res.json({ settings: after });
}

module.exports = function adminController(app) {
  app.get('/admin/settings', requireAdmin, (req, res) => {
    res.json({ settings: currentSettings() });
  });
  app.post('/admin/settings', requireAdmin, applySettings);
};
