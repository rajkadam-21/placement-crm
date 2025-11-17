# COMPLETE CODEBASE STRUCTURE & SUMMARY

## Project Structure

```
project-root/
├── src/
│   ├── config/
│   │   ├── db.js                    # Database pool management (RULE 1 & 2)
│   │   ├── logger.js                # Winston logger configuration
│   │   ├── rateLimiter.js           # Rate limiting configuration (7 limiters)
│   │   ├── constants.js             # All constants (ERROR_MESSAGES, LOG prefixes, etc)
│   │   └── env.js                   # Environment variables
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js        # Authentication & RBAC (authMiddleware, requireRole)
│   │   └── validateRequest.js       # Request validation middleware
│   │
│   ├── controllers/
│   │   ├── tenantController.js      # Tenant HTTP endpoints
│   │   ├── collegeController.js     # College HTTP endpoints
│   │   ├── userController.js        # User HTTP endpoints
│   │   ├── authController.js        # Auth HTTP endpoints (login, logout, verify)
│   │   └── studentController.js     # Student HTTP endpoints
│   │
│   ├── services/
│   │   ├── tenantService.js         # Tenant business logic
│   │   ├── collegeService.js        # College business logic
│   │   ├── userService.js           # User business logic (RULE 2)
│   │   ├── authService.js           # Auth business logic (RULE 2)
│   │   └── studentService.js        # Student business logic (RULE 2)
│   │
│   ├── routes/
│   │   ├── index.js                 # Main routes file
│   │   ├── tenant.routes.js         # Tenant routes
│   │   ├── college.routes.js        # College routes
│   │   ├── user.routes.js           # User routes
│   │   ├── auth.routes.js           # Auth routes
│   │   └── student.routes.js        # Student routes
│   │
│   ├── validators/
│   │   ├── tenantValidator.js       # Tenant Joi schemas
│   │   ├── collegeValidator.js      # College Joi schemas
│   │   ├── userValidator.js         # User Joi schemas
│   │   ├── authValidator.js         # Auth Joi schemas
│   │   └── studentValidator.js      # Student Joi schemas
│   │
│   ├── utils/
│   │   ├── responseHelper.js        # success() & error() helpers
│   │   ├── passwordHelper.js        # Hash & compare passwords
│   │   ├── jwtHelper.js             # JWT sign & verify
│   │   └── errorHandler.js          # Global error handler
│   │
│   └── app.js                       # Express app setup
│
├── logs/                            # Logger output (created automatically)
│   ├── combined.log
│   ├── error.log
│   └── info.log
│
├── .env                             # Environment variables (git ignored)
├── .env.example                     # Environment template
├── package.json
├── README.md
└── server.js                        # Server entry point
```

---

## File Relationships & Data Flow

### API Request Flow (Example: Create User)

```
1. User Request
   ├─ POST /api/v1/users
   └─ Body: { user_name, user_email, user_password, user_role }

2. Route Handler (user.routes.js)
   ├─ authMiddleware (verify JWT)
   ├─ requireRole (check ADMIN)
   ├─ apiLimiter (rate limit)
   ├─ validate(createUserSchema) (validate request)
   └─ → userController.createUser()

3. Controller (userController.js)
   ├─ Log: API_START with metadata
   ├─ Authorization check
   ├─ Call userService.create()
   ├─ Log: API_END with duration_ms
   └─ Response: success() or error()

4. Service (userService.js)
   ├─ Log: TRANSACTION_PREFIX steps
   ├─ Step 1: Get college from colleges (RULE 1)
   ├─ Step 2: Get tenant from tenants (RULE 1)
   ├─ Step 3: Get pool for tenant (RULE 2)
   ├─ Step 4: Get transaction with SERIALIZABLE isolation
   ├─ Step 5: Hash password
   ├─ Step 6: Insert user
   ├─ Step 7: Commit/Rollback
   └─ Return user data or throw error

5. Database
   ├─ mainPool (for colleges/tenants)
   └─ tenantPool (for users/students)

6. Response Back
   ├─ Controller formats response
   ├─ All logging complete
   └─ HTTP 201 + data sent to client
```

---

## Core Components Explanation

### 1. Database Pools (config/db.js)

**RULE 1: getMainPool()**
- Used for: tenants, colleges tables
- Connection: Direct to main database
- Scope: System-wide

```javascript
// Example usage in tenantController.js
const mainPool = getMainPool();
const { rows } = await mainPool.query(
  'SELECT * FROM tenants WHERE tenant_id = $1',
  [tenantId]
);
```

**RULE 2: getPoolForTenant()**
- Used for: users, students tables
- Logic: If db_url is null → use mainPool, else create separate connection
- Scope: Tenant-specific

```javascript
// Example usage in userService.js
const mainPool = getMainPool();
const collegeResult = await mainPool.query(
  'SELECT tenant_id FROM colleges WHERE college_id = $1',
  [collegeId]
);
const { tenant_id } = collegeResult.rows[0];

const tenantRecord = await mainPool.query(
  'SELECT * FROM tenants WHERE tenant_id = $1',
  [tenant_id]
);

const tenantPool = getPoolForTenant({
  tenant_id: tenantRecord.rows[0].tenant_id,
  db_url: tenantRecord.rows[0].db_url // null or "postgres://..."
});

// Now use tenantPool for users table
const userResult = await tenantPool.query(
  'SELECT * FROM users WHERE user_id = $1',
  [userId]
);
```

---

### 2. Logging Standards

**LOG Prefixes:**
- `LOG.API_START_PREFIX` → Start of API endpoint
- `LOG.API_END_PREFIX` → Successful completion
- `LOG.API_ERROR_PREFIX` → Error in API
- `LOG.TRANSACTION_PREFIX` → Database transaction steps
- `LOG.SECURITY_PREFIX` → Security issues (auth failures)
- `LOG.VALIDATION_PREFIX` → Input validation failures

**Logger Methods:**
```javascript
// Info - successful operations
logger.info(`${LOG.API_START_PREFIX} POST /users`, { user_id, ip });

// Debug - detailed flow
logger.debug(`${LOG.TRANSACTION_PREFIX} Starting transaction`, { college_id });

// Warn - security/validation issues
logger.warn(`${LOG.SECURITY_PREFIX} Unauthorized access`, { user_id });

// Error - exceptions
logger.error(`${LOG.API_ERROR_PREFIX} Database error`, { error: err.message });
```

---

### 3. Rate Limiters

```javascript
// 7 Specialized Limiters

1. globalLimiter
   - 100 requests / 15 minutes per IP
   - Applied to: app.use() - all routes

2. authLimiter
   - 5 requests / 15 minutes per IP
   - Applied to: /auth/login, /auth/logout, /students/login

3. apiLimiter
   - 50 requests / minute per IP
   - Applied to: CRUD operations

4. uploadLimiter
   - 10 uploads / hour per user
   - Applied to: /uploads (when available)

5. searchLimiter
   - 30 searches / minute per user
   - Applied to: /search (when available)

6. tenantLimiter
   - 100 requests / 15 minutes per tenant
   - Applied to: tenant-scoped routes

7. collegeLimiter
   - 200 requests / 15 minutes per college
   - Applied to: college-scoped routes
```

---

### 4. Service → Controller Pattern

**Service (Business Logic):**
```javascript
// src/services/userService.js
async createUser(data, collegeId, tenant) {
  // 1. Database queries
  // 2. Transaction management
  // 3. RULE 1 & 2 implementation
  // 4. Error handling
  // 5. Logging (TRANSACTION prefix)
  return userData;  // Return data only
}
```

**Controller (HTTP):**
```javascript
// src/controllers/userController.js
async createUser(req, res) {
  // 1. API logging (API_START)
  // 2. Authorization check
  // 3. Call service
  // 4. API logging (API_END)
  // 5. Format response
  return success(res, data, message, status);
}
```

---

## Authentication Flow

### System Admin Login
```
1. POST /auth/login with sysadmin email/password
2. Service checks environment variables (SYSADMIN_EMAIL, SYSADMIN_PASSWORD)
3. Generate JWT with role: 'sysadmin'
4. Token payload: { id: 'system-admin-001', role: 'sysadmin', ... }
5. Access: All tenant/college endpoints
```

### College User Login (RULE 2)
```
1. POST /auth/login with user email/password
2. Service:
   - Get college from colleges table (RULE 1)
   - Get tenant from tenants table (RULE 1)
   - Get pool for tenant (RULE 2)
   - Query user from users table (RULE 2)
   - Verify password
   - Generate JWT with role, college_id, tenant_id
3. Token payload: { id, role, college_id, tenant_id, ... }
4. Access: College-scoped endpoints only
```

### Student Login (RULE 2)
```
1. POST /students/login with student email/password
2. Service:
   - Similar to college user (RULE 2)
   - Query students table
   - Generate JWT with role: 'student'
3. Token payload: { id, role: 'student', college_id, ... }
4. Access: Limited student endpoints
```

---

## Multi-Tenant Isolation

### How It Works

**T1 (Current - Shared Database):**
```
Main Database
├─ tenants
│  └─ T1 (db_url: null)
├─ colleges
│  └─ college_id: X (tenant_id: T1)
├─ users
│  └─ user_id: A (college_id: X)
└─ students
   └─ student_id: 1 (college_id: X)
```

**T2+ (Future - Separate Databases):**
```
Main Database          Separate Database (T2)
├─ tenants             ├─ users
│  └─ T2               │  └─ user_id: B
│     (db_url: "...")  └─ students
└─ colleges              └─ student_id: 2
   └─ college_id: Y
      (tenant_id: T2)
```

**Isolation Mechanism:**
1. Every query to users/students first gets college_id
2. Gets tenant from college
3. Gets appropriate pool for tenant
4. Queries specific table with college_id filter
5. Result: Different tenants never see each other's data

---

## Error Handling Strategy

### Database Errors
```javascript
try {
  await query(...);
} catch (err) {
  // Handle specific error codes
  if (err.code === '23505') {
    throw new Error('Email already exists');  // UNIQUE_VIOLATION
  }
  if (err.code === '23503') {
    throw new Error('Invalid college reference');  // FOREIGN_KEY
  }
  throw err;
}
```

### Transaction Errors
```javascript
try {
  await client.query('BEGIN');
  // ... operations
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');  // Automatic rollback
  throw err;
}
```

### Controller Error Mapping
```javascript
// Service throws: 'Email already exists'
// Controller maps to: HTTP 409 CONFLICT
if (err.message.includes('already exists')) {
  return error(res, ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
}
```

---

## API Testing Priority Order

1. **System Admin APIs** (Foundation)
   - Login
   - Create tenant (optional - T1 exists)
   - List tenants

2. **College Creation** (Required for other tests)
   - Create college (creates admin user automatically)

3. **College Admin APIs** (User management)
   - Login as admin
   - Create user
   - List users
   - Update user
   - Delete user

4. **Student APIs** (Student management)
   - Register student
   - Bulk register
   - Login
   - Logout

5. **Auth APIs** (Token management)
   - Verify token
   - Logout

---

## Common Testing Mistakes

### ❌ Mistake 1: Using wrong pool
```javascript
// WRONG: Always using mainPool for users
const { rows } = await mainPool.query('SELECT * FROM users WHERE ...');

// RIGHT: Get tenant pool first (RULE 2)
const tenantPool = getPoolForTenant(tenant);
const { rows } = await tenantPool.query('SELECT * FROM users WHERE ...');
```

### ❌ Mistake 2: Not checking tenant isolation
```javascript
// WRONG: Querying user without college_id check
const q = 'SELECT * FROM users WHERE user_id = $1';

// RIGHT: Include college_id to ensure isolation
const q = 'SELECT * FROM users WHERE user_id = $1 AND college_id = $2';
```

### ❌ Mistake 3: Missing authorization
```javascript
// WRONG: Calling service directly without role check
const user = await userService.createUser(data);

// RIGHT: Check role in controller first
if (req.user.role !== ROLES.ADMIN) {
  return error(res, ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
}
const user = await userService.createUser(data);
```

### ❌ Mistake 4: Wrong logging prefix
```javascript
// WRONG
logger.info('User created', { user_id });

// RIGHT
logger.info(`${LOG.API_END_PREFIX} POST /users - User created`, { user_id });
```

---

## Key Files to Review

1. **Database Architecture:** `src/config/db.js`
   - Understand getMainPool() vs getPoolForTenant()
   - See RULE 1 & 2 implementation

2. **Logging Setup:** `src/config/logger.js`
   - Winston configuration
   - Log levels and prefixes

3. **Constants:** `src/config/constants.js`
   - All error messages
   - Log prefixes
   - HTTP status codes
   - Roles

4. **Response Helper:** `src/utils/responseHelper.js`
   - success() & error() functions
   - Response format consistency

5. **Auth Middleware:** `src/middleware/authMiddleware.js`
   - JWT verification
   - Role-based access control
   - RULE 2 implementation for user validation

---

## Performance Considerations

### Database Connections
```javascript
// Connection pooling prevents connection exhaustion
// Max connections: 20 (configurable in .env)
// Reused across requests
```

### Transaction Isolation
```javascript
// SERIALIZABLE isolation prevents race conditions
// Used for multi-step operations (register student, create user, etc)
// Slightly slower but ensures data consistency
```

### Rate Limiting
```javascript
// Prevents abuse
// 5 auth attempts / 15 min prevents brute force
// 50 API requests / min prevents flooding
```

---

## Security Best Practices Implemented

1. **Password Hashing:** bcrypt with 10 salt rounds
2. **JWT Tokens:** Signed with secret, 24-hour expiration
3. **SQL Injection Prevention:** Parameterized queries ($1, $2)
4. **Rate Limiting:** 7 different limiters for different endpoints
5. **Role-Based Access:** All endpoints check user role
6. **Tenant Isolation:** All queries include college_id/tenant_id
7. **Logging:** All auth attempts logged for audit trail
8. **Error Handling:** No sensitive data in error messages

---

## Next Steps After Testing

1. **Add More APIs:**
   - Interview management
   - Company management
   - Placement tracking

2. **Add Features:**
   - Email notifications
   - File uploads (for resumes)
   - Dashboard analytics

3. **Scaling:**
   - Add T2+ tenants with separate databases
   - No code changes needed, just add db_url to tenants table

4. **Monitoring:**
   - Set up error tracking (Sentry)
   - Performance monitoring (New Relic)
   - Log aggregation (ELK Stack)

---

## Support & Debugging

### Enable Debug Logging
```bash
# In .env
LOG_LEVEL=debug

# Restart server
npm start
```

### Check Database Connections
```sql
-- In PostgreSQL
SELECT * FROM pg_stat_activity WHERE datname = 'pcrm_main';
```

### Monitor Rate Limits
```bash
# Response headers show:
# RateLimit-Limit: 100
# RateLimit-Remaining: 87
# RateLimit-Reset: 1637091045
```

### Verify JWTs
```bash
# Use jwt.io to decode tokens (for debugging only)
# Verify: Algorithm, expiration, payload
```
