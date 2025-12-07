# API Testing Documentation

Complete API Reference with Request/Response Examples  
Single Database Architecture - College, User, Student Management

---

## SYSTEM ADMIN APIs (System Admin Only)

### API 1: SYSTEM ADMIN LOGIN

```
Method: POST
URL: http://localhost:4000/api/v1/auth/login
Auth: None
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "email": "sysadmin@pcrm.in",
  "password": "Admin@1234"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "sysadmin",
    "email": "sysadmin@pcrm.in",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "message": "Login successful"
}
```

---

### API 2: CREATE COLLEGE

```
Method: POST
URL: http://localhost:4000/api/v1/colleges
Auth: Bearer {token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "college_name": "MIT",
  "college_subdomain": "mit",
  "admin_name": "Dr. John Smith",
  "admin_email": "admin@mit.edu",
  "admin_password": "Admin@1234"
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "data": {
    "college": {
      "college_id": "550e8400-e29b-41d4-a716-446655440001",
      "college_name": "MIT",
      "college_subdomain": "mit",
      "college_status": "active",
      "enabled_features": ["core"],
      "created_at": "2025-12-07T10:00:00Z"
    },
    "admin": {
      "user_id": "550e8400-e29b-41d4-a716-446655440002",
      "user_name": "Dr. John Smith",
      "user_email": "admin@mit.edu",
      "user_role": "admin",
      "temporary_password": "Admin@1234"
    },
    "portal_url": "https://mit.pcrm.in",
    "note": "Please change the temporary password on first login"
  },
  "message": "College created successfully"
}
```

---

### API 3: LIST ALL COLLEGES

```
Method: GET
URL: http://localhost:4000/api/v1/colleges?page=1&limit=20
Auth: Bearer {token}
Headers: Content-Type: application/json
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "college_id": "550e8400-e29b-41d4-a716-446655440001",
      "college_name": "MIT",
      "college_subdomain": "mit",
      "college_status": "active",
      "enabled_features": ["core", "ai_mock", "mcq_test"],
      "created_at": "2025-12-07T10:00:00Z",
      "updated_at": "2025-12-07T10:15:00Z"
    },
    {
      "college_id": "550e8400-e29b-41d4-a716-446655440003",
      "college_name": "Stanford",
      "college_subdomain": "stanford",
      "college_status": "active",
      "enabled_features": ["core"],
      "created_at": "2025-12-07T10:05:00Z",
      "updated_at": null
    }
  ],
  "message": "Colleges retrieved",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "pages": 1
  }
}
```

---

### API 4: GET SINGLE COLLEGE

```
Method: GET
URL: http://localhost:4000/api/v1/colleges/550e8400-e29b-41d4-a716-446655440001
Auth: Bearer {token}
Headers: Content-Type: application/json
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "college_name": "MIT",
    "college_subdomain": "mit",
    "college_status": "active",
    "enabled_features": ["core", "ai_mock", "mcq_test"],
    "created_at": "2025-12-07T10:00:00Z",
    "updated_at": "2025-12-07T10:15:00Z"
  },
  "message": "College retrieved"
}
```

---

### API 5: UPDATE COLLEGE (Name, Subdomain, Status)

```
Method: PUT
URL: http://localhost:4000/api/v1/colleges/550e8400-e29b-41d4-a716-446655440001
Auth: Bearer {token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "college_name": "Massachusetts Institute of Technology",
  "college_status": "active"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "college_name": "Massachusetts Institute of Technology",
    "college_subdomain": "mit",
    "college_status": "active",
    "enabled_features": ["core", "ai_mock", "mcq_test"],
    "created_at": "2025-12-07T10:00:00Z",
    "updated_at": "2025-12-07T11:00:00Z"
  },
  "message": "College updated successfully"
}
```

---

### API 6: UPDATE COLLEGE FEATURES ⭐ IMPORTANT

```
Method: PUT
URL: http://localhost:4000/api/v1/colleges/550e8400-e29b-41d4-a716-446655440001/features
Auth: Bearer {token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "enabled_features": ["core", "ai_mock", "mcq_test", "resume_builder", "placement_help"]
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "college_name": "MIT",
    "college_subdomain": "mit",
    "college_status": "active",
    "enabled_features": ["core", "ai_mock", "mcq_test", "resume_builder", "placement_help"],
    "created_at": "2025-12-07T10:00:00Z",
    "updated_at": "2025-12-07T11:30:00Z"
  },
  "message": "College features updated successfully"
}
```

#### Error Response (400 Bad Request) - Core missing:
```json
{
  "success": false,
  "message": "Core feature must always be included in enabled features"
}
```

---

## COLLEGE ADMIN APIs (Admin Only - Same College)

### API 7: COLLEGE ADMIN LOGIN

```
Method: POST
URL: http://localhost:4000/api/v1/auth/login
Auth: None
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "email": "admin@mit.edu",
  "password": "Admin@1234"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "admin",
    "email": "admin@mit.edu",
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440002"
  },
  "message": "Login successful"
}
```

---

### API 8: GET COLLEGE DETAILS (With Features)

```
Method: GET
URL: http://localhost:4000/api/v1/colleges/550e8400-e29b-41d4-a716-446655440001
Auth: Bearer {admin_token}
Headers: Content-Type: application/json
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "college_name": "MIT",
    "college_subdomain": "mit",
    "college_status": "active",
    "enabled_features": ["core", "ai_mock", "mcq_test"],
    "created_at": "2025-12-07T10:00:00Z",
    "updated_at": "2025-12-07T11:30:00Z"
  },
  "message": "College retrieved"
}
```

---

## STUDENT APIs

### API 9: STUDENT REGISTRATION (Public)

```
Method: POST
URL: http://localhost:4000/api/v1/students/register
Auth: None
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "college_id": "550e8400-e29b-41d4-a716-446655440001",
  "student_name": "John Doe",
  "student_email": "john.doe@mit.edu",
  "student_password": "Student@1234",
  "student_department": "Computer Science",
  "student_year": 2
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "data": {
    "student_id": "550e8400-e29b-41d4-a716-446655440004",
    "student_name": "John Doe",
    "student_email": "john.doe@mit.edu"
  },
  "message": "Student registered successfully"
}
```

#### Error Response (409 Conflict) - Email exists:
```json
{
  "success": false,
  "message": "Email already exists"
}
```

---

### API 10: BULK REGISTER STUDENTS (Admin Only)

```
Method: POST
URL: http://localhost:4000/api/v1/students/bulk
Auth: Bearer {admin_token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "students": [
    {
      "student_name": "Alice Johnson",
      "student_email": "alice.johnson@mit.edu",
      "student_password": "Student@1234",
      "student_department": "Electrical Engineering",
      "student_year": 1
    },
    {
      "student_name": "Bob Smith",
      "student_email": "bob.smith@mit.edu",
      "student_password": "Student@1234",
      "student_department": "Mechanical Engineering",
      "student_year": 3
    }
  ]
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "success": [
      {
        "student_id": "550e8400-e29b-41d4-a716-446655440005",
        "student_email": "alice.johnson@mit.edu",
        "student_name": "Alice Johnson"
      },
      {
        "student_id": "550e8400-e29b-41d4-a716-446655440006",
        "student_email": "bob.smith@mit.edu",
        "student_name": "Bob Smith"
      }
    ],
    "failed": []
  },
  "message": "2 students registered, 0 failed"
}
```

---

### API 11: STUDENT LOGIN (Public)

```
Method: POST
URL: http://localhost:4000/api/v1/students/login
Auth: None
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "college_id": "550e8400-e29b-41d4-a716-446655440001",
  "student_email": "john.doe@mit.edu",
  "student_password": "Student@1234"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "student",
    "student_email": "john.doe@mit.edu",
    "student_name": "John Doe"
  },
  "message": "Login successful"
}
```

#### Error Response (401 Unauthorized) - Invalid credentials:
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### API 12: STUDENT LOGOUT (Authenticated)

```
Method: POST
URL: http://localhost:4000/api/v1/students/logout
Auth: Bearer {student_token}
Headers: Content-Type: application/json
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {},
  "message": "Logout successful"
}
```

---

### API 13: UPDATE STUDENT PASSWORD (Authenticated Student)

```
Method: PUT
URL: http://localhost:4000/api/v1/students/password
Auth: Bearer {student_token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "old_password": "Student@1234",
  "new_password": "NewPassword@1234"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {},
  "message": "Password updated successfully"
}
```

#### Error Response (401 Unauthorized) - Wrong old password:
```json
{
  "success": false,
  "message": "Old password is incorrect"
}
```

---

### API 14: UPDATE STUDENT PROFILE (Admin/Teacher Only)

```
Method: PUT
URL: http://localhost:4000/api/v1/students/550e8400-e29b-41d4-a716-446655440004/profile
Auth: Bearer {admin_token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "student_name": "John Michael Doe",
  "student_year": 3,
  "student_status": "active"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "student_id": "550e8400-e29b-41d4-a716-446655440004",
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "student_name": "John Michael Doe",
    "student_email": "john.doe@mit.edu",
    "student_department": "Computer Science",
    "student_year": 3,
    "student_status": "active"
  },
  "message": "Student profile updated successfully"
}
```

---

## TEACHER APIs (Similar to Admin but limited scope)

### API 15: TEACHER LOGIN

```
Method: POST
URL: http://localhost:4000/api/v1/auth/login
Auth: None
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "email": "teacher@mit.edu",
  "password": "Teacher@1234"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "teacher",
    "email": "teacher@mit.edu",
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440007"
  },
  "message": "Login successful"
}
```

---

### API 16: TEACHER UPDATE STUDENT PROFILE

```
Method: PUT
URL: http://localhost:4000/api/v1/students/550e8400-e29b-41d4-a716-446655440004/profile
Auth: Bearer {teacher_token}
Headers: Content-Type: application/json
```

#### Request Body:
```json
{
  "student_status": "active"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "student_id": "550e8400-e29b-41d4-a716-446655440004",
    "college_id": "550e8400-e29b-41d4-a716-446655440001",
    "student_name": "John Doe",
    "student_email": "john.doe@mit.edu",
    "student_department": "Computer Science",
    "student_year": 2,
    "student_status": "active"
  },
  "message": "Student profile updated successfully"
}
```

---

## ERROR RESPONSES

### 400 BAD REQUEST - Validation Error
```json
{
  "success": false,
  "message": "Minimum 2 characters"
}
```

### 401 UNAUTHORIZED - No Token
```json
{
  "success": false,
  "message": "Missing Authorization header"
}
```

### 401 UNAUTHORIZED - Invalid Token
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### 403 FORBIDDEN - Insufficient Permissions
```json
{
  "success": false,
  "message": "Forbidden - insufficient permissions"
}
```

### 404 NOT FOUND
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 429 TOO MANY REQUESTS - Rate Limited
```json
{
  "success": false,
  "message": "Too many login attempts. Please try again in 15 minutes.",
  "retryAfter": 900
}
```

### 500 INTERNAL SERVER ERROR
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## TEST DATA CREDENTIALS

### SYSADMIN:
- Email: `sysadmin@pcrm.in`
- Password: `Admin@1234`
- Role: `sysadmin`

### COLLEGE ADMIN:
- Email: `admin@mit.edu`
- Password: `Admin@1234`
- Role: `admin`
- College: `MIT`

### TEACHER:
- Email: `teacher@mit.edu`
- Password: `Teacher@1234`
- Role: `teacher`
- College: `MIT`

### STUDENT 1:
- Email: `john.doe@mit.edu`
- Password: `Student@1234`
- Name: `John Doe`
- College: `MIT`
- Department: `Computer Science`
- Year: `2`

### STUDENT 2:
- Email: `alice.johnson@mit.edu`
- Password: `Student@1234`
- Name: `Alice Johnson`
- College: `MIT`
- Department: `Electrical Engineering`
- Year: `1`

### STUDENT 3:
- Email: `bob.smith@mit.edu`
- Password: `Student@1234`
- Name: `Bob Smith`
- College: `MIT`
- Department: `Mechanical Engineering`
- Year: `3`

---

## IMPORTANT NOTES

### 1. TOKEN VALIDITY
All tokens should be passed in Authorization header as `Bearer {token}`

### 2. RATE LIMITING
- Auth endpoints: 5 attempts per 15 minutes
- API endpoints: 50 requests per 1 minute
- Sysadmin bypass rate limits on API endpoints

### 3. FEATURE MANAGEMENT
- Always include "core" in enabled_features
- Cannot create college without "core" feature
- Use API 6 to manage features

### 4. COLLEGE ISOLATION
- Students from one college cannot access another college
- Email must be unique per college (alice@mit.edu vs alice@stanford.edu OK)
- Admins/Teachers can only manage their own college

### 5. PASSWORD REQUIREMENTS
- Minimum 8 characters
- Must contain uppercase, lowercase, and numeric characters
- Example: Admin@1234, Student@5678, Teacher@9999

### 6. LOCAL TESTING
- Base URL: `http://localhost:4000`
- API Prefix: `/api/v1`
- Content-Type: `application/json`

### 7. TESTING FLOW
1. Login as Sysadmin → Get token
2. Create College → Get college_id
3. Register Student → Get student_id
4. Login as Student → Get student token
5. Update Password or Profile
