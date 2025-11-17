# API Development Quick Reference - UPDATED v2.1

## 📋 QUICK COPY-PASTE CHECKLIST

Use this when creating new APIs. Copy exact patterns.

---

## 1️⃣ Validator Pattern

```javascript
// validators/yourResourceValidator.js
const Joi = require('joi');
const { VALIDATION, STATUS } = require('../config/constants');

const createYourResourceSchema = Joi.object({
  name: Joi.string()
    .min(VALIDATION.STRING_MIN_LENGTH)
    .max(VALIDATION.STRING_MAX_LENGTH)
    .required(),
  status: Joi.string().valid(...Object.values(STATUS))
});

module.exports = { createYourResourceSchema };
```

---

## 2️⃣ Service Pattern

```javascript
// services/yourResourceService.js
const { getMainPool, getPoolForTenant } = require('../config/db');
const logger = require('../config/logger');
const { LOG, STATUS, DB_ERROR_CODES } = require('../config/constants');

class YourResourceService {
  async create(data, collegeId, tenant = null) {
    const pool = getMainPool(); // All currently in main DB
    const client = await pool.connect();

    try {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Creating resource`);
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Your queries here
      const query = `INSERT INTO your_resources (...) VALUES (...) RETURNING *`;
      const { rows } = await client.query(query, [data.field1, data.field2]);

      await client.query('COMMIT');
      logger.info(`${LOG.TRANSACTION_PREFIX} Resource created`, {
        resource_id: rows[0].id
      });

      return rows[0];

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`${LOG.TRANSACTION_PREFIX} Creation failed`, {
        error: err.message,
        code: err.code
      });
      throw err;
    } finally {
      client.release();
    }
  }

  async getById(resourceId, collegeId, tenant = null) {
    const pool = getMainPool();
    const { rows } = await pool.query(
      'SELECT * FROM your_resources WHERE id = $1 AND college_id = $2 LIMIT 1',
      [resourceId, collegeId]
    );
    if (!rows.length) throw new Error('Not found');
    return rows[0];
  }

  async list(filters = {}, collegeId, page = 1, limit = 20, tenant = null) {
    const pool = getMainPool();
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM your_resources WHERE college_id = $1 AND status = $2';
    const params = [collegeId, STATUS.ACTIVE];

    if (filters.search) {
      query += ` AND name ILIKE $${params.length + 1}`;
      params.push(`%${filters.search}%`);
    }

    // Count
    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Data
    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const { rows } = await pool.query(query, params);

    return { data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async update(resourceId, data, collegeId, tenant = null) {
    const pool = getMainPool();
    const client = await pool.connect();

    try {
      logger.debug(`${LOG.TRANSACTION_PREFIX} Starting update`);
      await client.query('BEGIN');
      
      const query = `UPDATE your_resources SET name = COALESCE($1, name), updated_at = NOW()
                     WHERE id = $2 AND college_id = $3 RETURNING *`;
      const { rows } = await client.query(query, [data.name || null, resourceId, collegeId]);

      await client.query('COMMIT');
      logger.info(`${LOG.TRANSACTION_PREFIX} Resource updated`, { resource_id: resourceId });

      return rows[0];

    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`${LOG.TRANSACTION_PREFIX} Update failed`, { error: err.message });
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(resourceId, collegeId, tenant = null) {
    const pool = getMainPool();
    const { rows } = await pool.query(
      'UPDATE your_resources SET status = $1, updated_at = NOW() WHERE id = $2 AND college_id = $3 RETURNING id',
      [STATUS.INACTIVE, resourceId, collegeId]
    );
    if (!rows.length) throw new Error('Not found');
    logger.info(`${LOG.TRANSACTION_PREFIX} Resource deleted`, { resource_id: resourceId });
    return rows[0];
  }
}

module.exports = new YourResourceService();
```

---

## 3️⃣ Controller Pattern (UPDATED - With Duration Tracking)

```javascript
// controllers/yourResourceController.js
const yourResourceService = require('../services/yourResourceService');
const logger = require('../config/logger');
const { LOG, HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES, ROLES } = require('../config/constants');
const { success, error } = require('../utils/responseHelper');

async function createResource(req, res) {
  const requestId = `${LOG.API_START_PREFIX} POST /resources`;
  const startTime = Date.now();
  logger.info(requestId, { user_id: req.user?.id, college_id: req.user?.college_id, ip: req.ip });

  try {
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(`${LOG.SECURITY_PREFIX} Unauthorized`, { user_role: req.user?.role });
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    const newResource = await yourResourceService.create(req.validated, req.user.college_id, req.tenant);

    logger.info(`${LOG.API_END_PREFIX} POST /resources - Created`, { 
      resource_id: newResource.id, 
      duration_ms: Date.now() - startTime 
    });
    return success(res, newResource, SUCCESS_MESSAGES.RESOURCE_CREATED, HTTP_STATUS.CREATED);

  } catch (err) {
    logger.error(`${LOG.API_ERROR_PREFIX} POST /resources - Error`, { 
      error: err.message, 
      duration_ms: Date.now() - startTime 
    });
    if (err.message.includes('already exists')) return error(res, err.message, HTTP_STATUS.CONFLICT);
    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

async function getResource(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /resources/:id`;
  const startTime = Date.now();
  logger.info(requestId, { resource_id: req.params.resourceId, user_id: req.user?.id });

  try {
    const resource = await yourResourceService.getById(req.params.resourceId, req.user.college_id, req.tenant);
    logger.info(`${LOG.API_END_PREFIX} GET /resources/:id - Retrieved`, { 
      duration_ms: Date.now() - startTime 
    });
    return success(res, resource);
  } catch (err) {
    logger.error(`${LOG.API_ERROR_PREFIX} GET /resources/:id - Error`, { 
      error: err.message, 
      duration_ms: Date.now() - startTime 
    });
    if (err.message.includes('not found')) return error(res, ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

async function listResources(req, res) {
  const requestId = `${LOG.API_START_PREFIX} GET /resources`;
  const startTime = Date.now();
  logger.info(requestId, { user_id: req.user?.id, query: req.query });

  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const result = await yourResourceService.list({}, req.user.college_id, page, limit, req.tenant);

    logger.info(`${LOG.API_END_PREFIX} GET /resources - Listed ${result.data.length}`, { 
      total: result.pagination.total, 
      duration_ms: Date.now() - startTime 
    });
    return success(res, result.data, 'Retrieved', HTTP_STATUS.OK);

  } catch (err) {
    logger.error(`${LOG.API_ERROR_PREFIX} GET /resources - Error`, { 
      error: err.message, 
      duration_ms: Date.now() - startTime 
    });
    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

async function updateResource(req, res) {
  const requestId = `${LOG.API_START_PREFIX} PUT /resources/:id`;
  const startTime = Date.now();
  logger.info(requestId, { resource_id: req.params.resourceId, user_id: req.user?.id });

  try {
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(`${LOG.SECURITY_PREFIX} Unauthorized`, { user_role: req.user?.role });
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    const updated = await yourResourceService.update(req.params.resourceId, req.validated, req.user.college_id, req.tenant);
    logger.info(`${LOG.API_END_PREFIX} PUT /resources/:id - Updated`, { 
      duration_ms: Date.now() - startTime 
    });
    return success(res, updated, SUCCESS_MESSAGES.RESOURCE_UPDATED);

  } catch (err) {
    logger.error(`${LOG.API_ERROR_PREFIX} PUT /resources/:id - Error`, { 
      error: err.message, 
      duration_ms: Date.now() - startTime 
    });
    if (err.message.includes('not found')) return error(res, ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

async function deleteResource(req, res) {
  const requestId = `${LOG.API_START_PREFIX} DELETE /resources/:id`;
  const startTime = Date.now();
  logger.info(requestId, { resource_id: req.params.resourceId, user_id: req.user?.id });

  try {
    if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.SYSADMIN) {
      logger.warn(`${LOG.SECURITY_PREFIX} Unauthorized`, { user_role: req.user?.role });
      return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    await yourResourceService.delete(req.params.resourceId, req.user.college_id, req.tenant);
    logger.info(`${LOG.API_END_PREFIX} DELETE /resources/:id - Deleted`, { 
      duration_ms: Date.now() - startTime 
    });
    return success(res, {}, SUCCESS_MESSAGES.RESOURCE_DELETED);

  } catch (err) {
    logger.error(`${LOG.API_ERROR_PREFIX} DELETE /resources/:id - Error`, { 
      error: err.message, 
      duration_ms: Date.now() - startTime 
    });
    if (err.message.includes('not found')) return error(res, ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    return error(res, ERROR_MESSAGES.SERVER_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

module.exports = { createResource, getResource, listResources, updateResource, deleteResource };
```

---

## 4️⃣ Routes Pattern (UPDATED - With Rate Limiters)

```javascript
// routes/yourResource.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/yourResourceController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validateRequest');
const { apiLimiter, searchLimiter } = require('../config/rateLimiter');
const { createYourResourceSchema, updateYourResourceSchema } = require('../validators/yourResourceValidator');
const { ROLES } = require('../config/constants');

// POST - Create (strict rate limit)
router.post('/', 
  authMiddleware, 
  requireRole(ROLES.ADMIN, ROLES.SYSADMIN), 
  apiLimiter,
  validate(createYourResourceSchema), 
  controller.createResource
);

// GET - List (search rate limit)
router.get('/', 
  authMiddleware, 
  searchLimiter,
  controller.listResources
);

// GET - By ID
router.get('/:resourceId', 
  authMiddleware, 
  controller.getResource
);

// PUT - Update (strict rate limit)
router.put('/:resourceId', 
  authMiddleware, 
  requireRole(ROLES.ADMIN, ROLES.SYSADMIN), 
  apiLimiter,
  validate(updateYourResourceSchema), 
  controller.updateResource
);

// DELETE - Delete (strict rate limit)
router.delete('/:resourceId', 
  authMiddleware, 
  requireRole(ROLES.ADMIN, ROLES.SYSADMIN), 
  apiLimiter,
  controller.deleteResource
);

module.exports = router;
```

---

## 5️⃣ Constants Addition

```javascript
// Add to src/config/constants.js

// In ERROR_MESSAGES:
RESOURCE_NOT_FOUND: 'Resource not found or has been deleted',
RESOURCE_ALREADY_EXISTS: 'Resource with this name already exists',

// In SUCCESS_MESSAGES:
RESOURCE_CREATED: 'Resource created successfully',
RESOURCE_UPDATED: 'Resource updated successfully',
RESOURCE_DELETED: 'Resource deleted successfully'
```

---

## 6️⃣ Routes Index Update

```javascript
// In src/routes/index.js - Add ONE line:

const yourResourceRoutes = require('./yourResource.routes');

// And add to router.use():
router.use('/resources', yourResourceRoutes);
```

---

## 🔑 KEY LOGGING LINES (UPDATED - With Duration)

```javascript
// API START - Always track time
const startTime = Date.now();
logger.info(`${LOG.API_START_PREFIX} METHOD /endpoint`, { user_id, college_id, ip });

// API SUCCESS - Include duration
logger.info(`${LOG.API_END_PREFIX} METHOD /endpoint - Success`, { 
  resource_id, 
  duration_ms: Date.now() - startTime 
});

// API ERROR - Include duration
logger.error(`${LOG.API_ERROR_PREFIX} METHOD /endpoint - Error`, { 
  error: err.message, 
  duration_ms: Date.now() - startTime 
});

// TRANSACTION START
logger.debug(`${LOG.TRANSACTION_PREFIX} Starting transaction`);

// TRANSACTION COMMIT
logger.info(`${LOG.TRANSACTION_PREFIX} Transaction committed`, { resource_id });

// TRANSACTION ROLLBACK
logger.error(`${LOG.TRANSACTION_PREFIX} Transaction rolled back`, { 
  error: err.message, 
  code: err.code 
});

// SECURITY VIOLATION
logger.warn(`${LOG.SECURITY_PREFIX} Unauthorized access`, { user_role, required_role });

// VALIDATION FAILURE
logger.warn(`${LOG.VALIDATION_PREFIX} Validation failed`, { missing_fields: ['email'] });
```

---

## 🔒 RATE LIMITER PATTERNS (NEW)

```javascript
// Import rate limiters
const { authLimiter, apiLimiter, searchLimiter, uploadLimiter } = require('../config/rateLimiter');

// Apply to routes

// Authentication (5 attempts per 15 minutes - STRICT)
router.post('/login', authLimiter, controller.login);

// General API (50 requests per minute)
router.post('/create', apiLimiter, controller.create);
router.put('/update/:id', apiLimiter, controller.update);
router.delete('/delete/:id', apiLimiter, controller.delete);

// Search (30 searches per minute)
router.get('/search', searchLimiter, controller.search);

// Upload (10 uploads per hour - STRICT)
router.post('/upload', uploadLimiter, controller.upload);

// List (no special limiter - uses global)
router.get('/', controller.list);
```

---

## 💾 DATABASE POOL DECISION TREE

```
Is your query on TENANTS or COLLEGES table?
├─ YES → Use getMainPool()
└─ NO → Query is on USERS, STUDENTS, or other?
    ├─ YES → Use getMainPool() (all currently in main DB)
    └─ Future: Will use getPoolForTenant() when T2+ available
              But code works same way
```

---

## ✅ BEFORE SUBMITTING API (UPDATED)

- [ ] Validator created with all fields
- [ ] Service has create, get, list, update, delete
- [ ] Controller calls service (NOT direct DB)
- [ ] All logging lines present (START, END, ERROR with duration_ms)
- [ ] Authorization checks in controllers
- [ ] Tenant isolation (college_id passed)
- [ ] Constants added to constants.js
- [ ] Routes added to routes/index.js
- [ ] Rate limiters applied (apiLimiter on write, searchLimiter on read)
- [ ] No console.log (use logger)
- [ ] All queries parameterized
- [ ] Soft delete (status = inactive)
- [ ] Try-catch blocks present
- [ ] Duration tracking in all controllers
- [ ] Security logging for authorization failures
- [ ] Error code captured in DB errors

---

## 🚀 DEPLOYMENT READY

Your code is ready when:

✅ All validators working
✅ All services working
✅ All controllers working
✅ Logs show: [API_START] → [API_END] or [API_ERROR] with duration_ms
✅ Authorization working
✅ Rate limiters enforced (429 responses on limit)
✅ Tenant isolation verified
✅ Test with different users/roles
✅ Test error cases
✅ Database transactions atomic
✅ No sensitive data in logs
✅ Performance metrics available (duration_ms in all logs)

---

## 📝 FILE NAMES TO CREATE

For new resource called "YourResource":

```
validators/yourResourceValidator.js
services/yourResourceService.js
controllers/yourResourceController.js
routes/yourResource.routes.js
```

**Note**: Use camelCase naming!

---

## 🎯 QUICK START (30-45 Minutes)

1. **Create validator** (5 min) - Copy pattern from section 1️⃣
2. **Create service** (10 min) - Copy pattern from section 2️⃣
3. **Create controller** (12 min) - Copy pattern from section 3️⃣ (with duration tracking)
4. **Create routes** (5 min) - Copy pattern from section 4️⃣ (with limiters)
5. **Add constants** (2 min) - Copy from section 5️⃣
6. **Update routes index** (1 min) - Copy from section 6️⃣
7. **Test endpoints** (5 min) - Use Postman/Insomnia

---

## ⚠️ COMMON MISTAKES TO AVOID

❌ Don't query database in controller
✅ Always use service layer

❌ Don't use console.log
✅ Always use logger with LOG prefixes

❌ Don't hardcode strings/numbers
✅ Use constants.js

❌ Don't forget BEGIN/COMMIT/ROLLBACK
✅ Use transactions for multi-step ops

❌ Don't skip authorization checks
✅ Always verify req.user.role

❌ Don't forget college_id in queries
✅ Always pass to service for tenant isolation

❌ Don't use string concatenation in SQL
✅ Always use parameterized queries

❌ Don't forget API_START/END logs
✅ Always log lifecycle with duration_ms

❌ Don't forget rate limiters
✅ Apply apiLimiter to write endpoints, searchLimiter to read

❌ Don't track duration manually
✅ Use `const startTime = Date.now()` pattern

❌ Don't skip error codes in logging
✅ Always capture `err.code` for DB errors

---

## 📊 EXPECTED LOG OUTPUT

```
2025-11-16T23:20:45.123Z [INFO]: [API_START] POST /api/v1/resources user_id=123 college_id=456 ip=192.168.1.1
2025-11-16T23:20:45.234Z [DEBUG]: [TRANSACTION] Creating resource
2025-11-16T23:20:45.567Z [INFO]: [TRANSACTION] Resource created successfully resource_id=789
2025-11-16T23:20:45.678Z [INFO]: [API_END] POST /api/v1/resources - Resource created successfully resource_id=789 duration_ms=555
```

---

**All patterns follow production-grade standards!** ✅
