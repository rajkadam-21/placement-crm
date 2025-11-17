# COMPLETE API DOCUMENTATION & TESTING GUIDE

## Overview
This document contains all APIs for the multi-tenant college placement management system with complete testing scenarios, sample data, and step-by-step guides.

---

## TABLE OF CONTENTS
1. [Health Check](#health-check)
2. [System Admin APIs](#system-admin-apis)
3. [College Admin APIs](#college-admin-apis)
4. [Authentication APIs](#authentication-apis)
5. [Student APIs](#student-apis)
6. [User Management APIs](#user-management-apis)
7. [Database Setup](#database-setup)
8. [Environment Variables](#environment-variables)
9. [Testing Scenarios](#testing-scenarios)
10. [Common Errors](#common-errors)

---

# 1. HEALTH CHECK

## GET /health
Check if the server is running and view tenant resolution.

```
Method: GET
URL: http://localhost:4000/health
Auth: None
Headers: None
```

### Example Request:
```bash
curl -X GET http://localhost:4000/health
```

### Example Response (200):
```json
{
  "ok": true,
  "tenant": null
}
```

### Response With Subdomain (if tenant resolver is active):
```json
{
  "ok": true,
  "tenant": {
    "college_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "T1",
    "college_name": "RCPIT",
    "college_subdomain": "rcpit",
    "status": "active"
  }
}
```

---

# 2. SYSTEM ADMIN APIs (System Admin Only)

## 2.1 System Admin Login

```
Method: POST
URL: http://localhost:4000/api/v1/auth/login
Auth: None
Headers: Content-Type: application/json
```

### Request Body:
```json
{
  "email": "admin@pcrm.in",
  "password": "adminpcrm"
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pcrm.in",
    "password": "adminpcrm"
  }'
```

### Success Response (200):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ25neml6Z3N6endhd25hdXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzk0MzUsImV4cCI6MjA3ODcxNTQzNX0.b9nFLImIm_BGZ0bmWnaJXYprIuJQn58nNbC3lpVqLBs",
    "role": "sysadmin",
    "email": "admin@pcrm.in"
  }
}
```

**⚠️ Important: Save the token as `SYSADMIN_TOKEN` for subsequent requests.**

---

## 2.2 Create New College

```
Method: POST
URL: http://localhost:4000/api/v1/admin/colleges
Auth: System Admin JWT Token
Headers: 
  Content-Type: application/json
  Authorization: Bearer {SYSADMIN_TOKEN}
```

### Request Body:
```json
{
  "tenant_id": "T1",
  "college_name": "R.C. Patel Institute of Technology",
  "college_subdomain": "rcpit",
  "admin_name": "Dr. Rajesh Kumar",
  "admin_email": "admin@rcpit.edu.in",
  "admin_password": "Admin@123"
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/admin/colleges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "tenant_name": "RCPIT Organization",
    "college_name": "R.C. Patel Institute of Technology",
    "college_subdomain": "rcpit",
    "admin_name": "Dr. Rajesh Kumar",
    "admin_email": "admin@rcpit.edu.in",
    "admin_password": "Admin@123"
  }'
```

### Success Response (201):
```json
{
  "success": true,
  "data": {
    "college": {
      "college_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "T1",
      "college_name": "R.C. Patel Institute of Technology",
      "college_subdomain": "rcpit",
      "status": "active",
      "created_at": "2025-11-17T21:00:00.000Z"
    },
    "admin": {
      "user_id": "660e8400-e29b-41d4-a716-446655440001",
      "user_name": "Dr. Rajesh Kumar",
      "user_email": "admin@rcpit.edu.in",
      "user_role": "admin",
      "temporary_password": "Admin@123"
    },
    "portal_url": "https://rcpit.pcrm.in"
  },
  "message": "College created. Admin credentials sent."
}
```

**⚠️ Important: Save `college_id` and admin credentials for next steps.**

---

## 2.3 List All Colleges

```
Method: GET
URL: http://localhost:4000/api/v1/admin/colleges
Auth: System Admin JWT Token
Headers: Authorization: Bearer {SYSADMIN_TOKEN}
```

### Example cURL:
```bash
curl -X GET http://localhost:4000/api/v1/admin/colleges \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Success Response (200):
```json
{
  "success": true,
  "data": [
    {
      "college_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "T1",
      "tenant_name": "RCPIT Organization",
      "college_name": "R.C. Patel Institute of Technology",
      "college_subdomain": "rcpit",
      "status": "active",
      "user_count": 1,
      "student_count": 0,
      "created_at": "2025-11-17T21:00:00.000Z"
    }
  ]
}
```

---

# 3. COLLEGE ADMIN APIs

## 3.1 College Admin Login

```
Method: POST
URL: http://localhost:4000/api/v1/auth/login
Auth: None
Headers: 
  Content-Type: application/json
  Host: rcpit.pcrm.in (for local testing, add to /etc/hosts)
```

### Request Body:
```json
{
  "email": "admin@rcpit.edu.in",
  "password": "Admin@123"
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "email": "admin@rcpit.edu.in",
    "password": "Admin@123"
  }'
```

### Success Response (200):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ25neml6Z3N6endhd25hdXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzk0MzUsImV4cCI6MjA3ODcxNTQzNX0.b9nFLImIm_BGZ0bmWnaJXYprIuJQn58nNbC3lpVqLBs",
    "role": "admin",
    "college_subdomain": "rcpit"
  }
}
```

**⚠️ Important: Save the token as `COLLEGE_ADMIN_TOKEN`.**

---

# 4. USER MANAGEMENT APIs (College Admin)

## 4.1 Create User (Teacher/Admin)

```
Method: POST
URL: http://localhost:4000/api/v1/users
Auth: College Admin JWT Token
Headers:
  Content-Type: application/json
  Authorization: Bearer {COLLEGE_ADMIN_TOKEN}
  Host: rcpit.pcrm.in
```

### Request Body:
```json
{
  "user_name": "Prof. Priya Sharma",
  "user_email": "priya.sharma@rcpit.edu.in",
  "user_password": "Teacher@123",
  "user_role": "teacher"
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "user_name": "Prof. Priya Sharma",
    "user_email": "priya.sharma@rcpit.edu.in",
    "user_password": "Teacher@123",
    "user_role": "teacher"
  }'
```

### Success Response (201):
```json
{
  "success": true,
  "data": {
    "user_id": "660e8400-e29b-41d4-a716-446655440002",
    "user_name": "Prof. Priya Sharma",
    "user_email": "priya.sharma@rcpit.edu.in",
    "user_role": "teacher",
    "created_at": "2025-11-17T21:30:00.000Z"
  },
  "message": "User created successfully"
}
```

---

## 4.2 List Users

```
Method: GET
URL: http://localhost:4000/api/v1/users
Auth: College Admin/Teacher JWT Token
Headers:
  Authorization: Bearer {COLLEGE_ADMIN_TOKEN}
  Host: rcpit.pcrm.in
```

### Example cURL:
```bash
curl -X GET http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Host: rcpit.pcrm.in"
```

### Success Response (200):
```json
{
  "success": true,
  "data": [
    {
      "user_id": "660e8400-e29b-41d4-a716-446655440001",
      "user_name": "Dr. Rajesh Kumar",
      "user_email": "admin@rcpit.edu.in",
      "user_role": "admin",
      "user_status": "active",
      "created_at": "2025-11-17T21:00:00.000Z"
    },
    {
      "user_id": "660e8400-e29b-41d4-a716-446655440002",
      "user_name": "Prof. Priya Sharma",
      "user_email": "priya.sharma@rcpit.edu.in",
      "user_role": "teacher",
      "user_status": "active",
      "created_at": "2025-11-17T21:30:00.000Z"
    }
  ]
}
```

---

## 4.3 Update User

```
Method: PUT
URL: http://localhost:4000/api/v1/users/{userId}
Auth: College Admin JWT Token
Headers:
  Content-Type: application/json
  Authorization: Bearer {COLLEGE_ADMIN_TOKEN}
  Host: rcpit.pcrm.in
```

### Request Body:
```json
{
  "user_name": "Prof. Priya Sharma Updated",
  "user_status": "active"
}
```

### Example cURL:
```bash
curl -X PUT http://localhost:4000/api/v1/users/660e8400-e29b-41d4-a716-446655440002 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "user_name": "Prof. Priya Sharma Updated"
  }'
```

### Success Response (200):
```json
{
  "success": true,
  "data": {
    "user_id": "660e8400-e29b-41d4-a716-446655440002",
    "user_name": "Prof. Priya Sharma Updated",
    "user_email": "priya.sharma@rcpit.edu.in",
    "user_role": "teacher",
    "user_status": "active"
  }
}
```

---

## 4.4 Delete User (Soft Delete)

```
Method: DELETE
URL: http://localhost:4000/api/v1/users/{userId}
Auth: College Admin JWT Token
Headers:
  Authorization: Bearer {COLLEGE_ADMIN_TOKEN}
  Host: rcpit.pcrm.in
```

### Example cURL:
```bash
curl -X DELETE http://localhost:4000/api/v1/users/660e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Host: rcpit.pcrm.in"
```

### Success Response (200):
```json
{
  "success": true,
  "message": "User deactivated"
}
```

---

# 5. STUDENT APIs

## 5.1 Register Single Student

```
Method: POST
URL: http://localhost:4000/api/v1/students/register
Auth: None
Headers: Content-Type: application/json
```

### Request Body:
```json
{
  "college_id": "550e8400-e29b-41d4-a716-446655440000",
  "student_name": "Amit Patel",
  "student_email": "amit.patel@rcpit.edu.in",
  "student_password": "Student@123",
  "student_department": "Computer Engineering",
  "student_year": 3
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/students/register \
  -H "Content-Type: application/json" \
  -d '{
    "college_id": "550e8400-e29b-41d4-a716-446655440000",
    "student_name": "Amit Patel",
    "student_email": "amit.patel@rcpit.edu.in",
    "student_password": "Student@123",
    "student_department": "Computer Engineering",
    "student_year": 3
  }'
```

### Success Response (201):
```json
{
  "success": true,
  "data": {
    "student_id": "770e8400-e29b-41d4-a716-446655440001",
    "student_name": "Amit Patel",
    "student_email": "amit.patel@rcpit.edu.in"
  }
}
```

---

## 5.2 Bulk Register Students

```
Method: POST
URL: http://localhost:4000/api/v1/students/bulk
Auth: College Admin JWT Token
Headers:
  Content-Type: application/json
  Authorization: Bearer {COLLEGE_ADMIN_TOKEN}
  Host: rcpit.pcrm.in
```

### Request Body:
```json
{
  "college_id": "550e8400-e29b-41d4-a716-446655440000",
  "students": [
    {
      "student_name": "Sneha Desai",
      "student_email": "sneha.desai@rcpit.edu.in",
      "student_password": "Student@123",
      "student_department": "Information Technology",
      "student_year": 2
    },
    {
      "student_name": "Rahul Mehta",
      "student_email": "rahul.mehta@rcpit.edu.in",
      "student_password": "Student@123",
      "student_department": "Electronics Engineering",
      "student_year": 4
    }
  ]
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/students/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "college_id": "550e8400-e29b-41d4-a716-446655440000",
    "students": [
      {
        "student_name": "Sneha Desai",
        "student_email": "sneha.desai@rcpit.edu.in",
        "student_password": "Student@123",
        "student_department": "Information Technology",
        "student_year": 2
      }
    ]
  }'
```

### Success Response (200):
```json
{
  "success": true,
  "data": {
    "success": [
      {
        "student_id": "770e8400-e29b-41d4-a716-446655440002",
        "student_name": "Sneha Desai",
        "student_email": "sneha.desai@rcpit.edu.in"
      }
    ],
    "failed": []
  },
  "message": "1 students registered, 0 failed"
}
```

---

## 5.3 Student Login

```
Method: POST
URL: http://localhost:4000/api/v1/students/login
Auth: None
Headers: 
  Content-Type: application/json
  Host: rcpit.pcrm.in
```

### Request Body:
```json
{
  "student_email": "amit.patel@rcpit.edu.in",
  "student_password": "Student@123"
}
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/students/login \
  -H "Content-Type: application/json" \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "student_email": "amit.patel@rcpit.edu.in",
    "student_password": "Student@123"
  }'
```

### Success Response (200):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ25neml6Z3N6endhd25hdXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMzk0MzUsImV4cCI6MjA3ODcxNTQzNX0.b9nFLImIm_BGZ0bmWnaJXYprIuJQn58nNbC3lpVqLBs",
    "role": "student"
  }
}
```

**⚠️ Important: Save the token as `STUDENT_TOKEN`.**

---

## 5.4 Student Logout

```
Method: POST
URL: http://localhost:4000/api/v1/students/logout
Auth: Student JWT Token
Headers:
  Authorization: Bearer {STUDENT_TOKEN}
  Host: rcpit.pcrm.in
```

### Example cURL:
```bash
curl -X POST http://localhost:4000/api/v1/students/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Host: rcpit.pcrm.in"
```

### Success Response (200):
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

# 6. DATABASE SETUP

## SQL Schema

```sql
-- Tenants table
CREATE TABLE public.tenants (
  tenant_id uuid not null default gen_random_uuid(),
  tenant_name text not null,
  db_name text null,
  created_at timestamp without time zone null default now(),
  constraint tenants_pkey primary key (tenant_id)
);

-- Colleges table
CREATE TABLE public.colleges (
  college_id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  college_name text not null,
  college_subdomain text not null unique,
  college_status text not null default 'active' check (college_status in ('active', 'inactive')),
  created_at timestamp without time zone null default now(),
  constraint colleges_pkey primary key (college_id),
  constraint colleges_tenant_id_fkey foreign key (tenant_id) references tenants(tenant_id) on delete cascade
);

-- Users table
CREATE TABLE public.users (
  user_id uuid not null default gen_random_uuid(),
  college_id uuid not null,
  user_name text not null,
  user_email text not null unique,
  user_password text not null,
  user_role text not null check (user_role in ('admin', 'teacher', 'other')),
  user_status text not null default 'active' check (user_status in ('active', 'inactive')),
  created_at timestamp without time zone null default now(),
  constraint users_pkey primary key (user_id),
  constraint users_college_id_fkey foreign key (college_id) references colleges(college_id) on delete cascade
);

-- Students table
CREATE TABLE public.students (
  student_id uuid not null default gen_random_uuid(),
  college_id uuid not null,
  student_name text not null,
  student_email text not null unique,
  student_password text not null,
  student_department text not null,
  student_year integer not null,
  created_at timestamp without time zone null default now(),
  constraint students_pkey primary key (student_id),
  constraint students_college_id_fkey foreign key (college_id) references colleges(college_id) on delete cascade
);

-- Create indexes for performance
CREATE INDEX idx_colleges_subdomain ON colleges(college_subdomain);
CREATE INDEX idx_users_email ON users(user_email);
CREATE INDEX idx_users_college ON users(college_id);
CREATE INDEX idx_students_email ON students(student_email);
CREATE INDEX idx_students_college ON students(college_id);
```

---

# 7. ENVIRONMENT VARIABLES

Create `.env` file in project root:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# System Admin Credentials (stored in .env as per requirement)
SYSADMIN_EMAIL=admin@pcrm.in
SYSADMIN_PASSWORD=adminpcrm

# JWT Configuration
JWT_SECRET=cprm
JWT_EXPIRES_IN=7d

# Database Connection (PostgreSQL/Supabase)
DATABASE_URL=postgresql://postgres:yourPassword@db.xxxxx.supabase.co:5432/postgres

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=debug
LOG_DIR=./logs

# Optional: For future tenant databases
# TENANT_DB_T2=postgresql://user:pass@host:5432/tenant2_db
```

---

# 8. COMPLETE TESTING FLOW

## Quick Start (Copy & Paste)

### Step 1: Health Check
```bash
curl -X GET http://localhost:4000/health
```

### Step 2: System Admin Login
```bash
SYSADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pcrm.in",
    "password": "adminpcrm"
  }' | jq -r '.data.token')

echo "System Admin Token: $SYSADMIN_TOKEN"
```

### Step 3: Create College
```bash
curl -X POST http://localhost:4000/api/v1/admin/colleges \
  -H "Authorization: Bearer $SYSADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "college_name": "RCPIT",
    "college_subdomain": "rcpit",
    "admin_name": "Dr. Principal",
    "admin_email": "admin@rcpit.edu.in",
    "admin_password": "Admin@123"
  }'
```

### Step 4: College Admin Login
```bash
COLLEGE_ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "email": "admin@rcpit.edu.in",
    "password": "Admin@123"
  }' | jq -r '.data.token')

echo "College Admin Token: $COLLEGE_ADMIN_TOKEN"
```

### Step 5: Create Teacher
```bash
curl -X POST http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer $COLLEGE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "user_name": "Prof. Sharma",
    "user_email": "sharma@rcpit.edu.in",
    "user_password": "Teacher@123",
    "user_role": "teacher"
  }'
```

### Step 6: Register Student
```bash
curl -X POST http://localhost:4000/api/v1/students/register \
  -H "Content-Type: application/json" \
  -d '{
    "college_id": "550e8400-e29b-41d4-a716-446655440000",
    "student_name": "Amit",
    "student_email": "amit@rcpit.edu.in",
    "student_password": "Student@123",
    "student_department": "CS",
    "student_year": 3
  }'
```

### Step 7: Student Login
```bash
STUDENT_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/students/login \
  -H "Content-Type: application/json" \
  -H "Host: rcpit.pcrm.in" \
  -d '{
    "student_email": "amit@rcpit.edu.in",
    "student_password": "Student@123"
  }' | jq -r '.data.token')

echo "Student Token: $STUDENT_TOKEN"
```

### Step 8: Student Logout
```bash
curl -X POST http://localhost:4000/api/v1/students/logout \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Host: rcpit.pcrm.in"
```

---

# 9. COMMON ERRORS & SOLUTIONS

| Error Code | Message | Solution |
|------------|---------|----------|
| 401 | Missing Authorization header | Add `Authorization: Bearer {token}` header |
| 403 | Access denied to this college | Use correct subdomain or college-specific token |
| 404 | User not found | Verify user ID exists in database |
| 409 | Email already exists | Use unique email address |
| 429 | Too many requests | Wait before making more requests (rate limit exceeded) |
| 500 | Server error | Check server logs for details |

---

# 10. LOCAL TESTING WITHOUT DNS

For local testing, add these entries to your hosts file:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Mac/Linux:** `/etc/hosts`

```
127.0.0.1 pcrm.in
127.0.0.1 rcpit.pcrm.in
127.0.0.1 dypatil.pcrm.in
127.0.0.1 admin.rcpit.pcrm.in
```

Then you can use URLs like:
- `http://rcpit.pcrm.in:4000/api/v1/students/login`
- `http://dypatil.pcrm.in:4000/api/v1/users`

---

# 11. SAMPLE DATA REFERENCE

## System Admin
- Email: `admin@pcrm.in`
- Password: `adminpcrm`
- Role: `sysadmin`

## College RCPIT
- Name: `R.C. Patel Institute of Technology`
- Subdomain: `rcpit`
- Admin Email: `admin@rcpit.edu.in`
- Admin Password: `Admin@123`

## College DYPatil
- Name: `Dr. D.Y. Patil University`
- Subdomain: `dypatil`

## Sample Student
- Name: `Amit Patel`
- Email: `amit@rcpit.edu.in`
- Password: `Student@123`
- Department: `Computer Science`
- Year: `3`

---

# 12. TROUBLESHOOTING

### Issue: "Invalid Authorization header"
**Solution:** Ensure token is properly formatted and not expired
```bash
# Check token format
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Issue: "Tenant not found"
**Solution:** Verify subdomain exists in database or create college first
```sql
SELECT * FROM colleges WHERE college_subdomain = 'rcpit';
```

### Issue: "Database connection failed"
**Solution:** Verify DATABASE_URL in .env is correct PostgreSQL connection string
```
✓ Correct: postgresql://user:pass@host:5432/db
✗ Wrong: https://xxxxx.supabase.co
```

### Issue: "Rate limit exceeded"
**Solution:** Wait 1 minute and try again (default limit: 100 requests per minute)

---

# 13. TESTING CHECKLIST

- [ ] Health check endpoint works
- [ ] System admin can login with credentials from .env
- [ ] System admin can create colleges
- [ ] College admin can login after college creation
- [ ] College admin can create users (teachers)
- [ ] College admin can list all users
- [ ] College admin can update user details
- [ ] College admin can delete users
- [ ] Students can register individually
- [ ] Multiple students can be bulk registered
- [ ] Students can login with credentials
- [ ] Students can logout
- [ ] Invalid emails are rejected
- [ ] Duplicate emails are rejected
- [ ] Cross-tenant access is denied
- [ ] Rate limiting works as expected

---

**END OF DOCUMENTATION**

Last Updated: November 17, 2025
Version: 1.0
