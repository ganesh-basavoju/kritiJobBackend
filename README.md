# Kriti Job Portal Backend API Documentation

## Overview

The Kriti Job Portal Backend is a RESTful API built with Node.js, Express, and MongoDB. It provides comprehensive job portal functionality including user authentication, job management, application tracking, company profiles, candidate profiles, real-time chat, and notifications.

## Base URL

```
http://localhost:5000/api
```

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time Communication**: Socket.IO
- **File Upload**: Multer + Cloudinary
- **Validation**: express-validator
- **Email**: Nodemailer

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## User Roles

The system supports three user roles:
- **candidate**: Can apply for jobs, manage profile, save jobs
- **employer**: Can post jobs, manage company, view applications
- **admin**: Full system access, manage users, view reports

---

## API Endpoints

### 🔐 Authentication (`/api/auth`)

#### Register a New User
```http
POST /api/auth/signup
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "candidate"
}
```

**Validation:**
- `name`: Required, not empty
- `email`: Required, valid email format
- `password`: Required, minimum 6 characters
- `role`: Optional, one of: `candidate`, `employer`, `admin` (default: `candidate`)

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "candidate"
  }
}
```

---

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "candidate"
  }
}
```

---

#### Get Current User
```http
GET /api/auth/me
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "candidate",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

#### Logout
```http
GET /api/auth/logout
```

**Authentication:** Required

---

#### Refresh Token
```http
POST /api/auth/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

---

#### Forgot Password
```http
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

---

#### Reset Password
```http
PUT /api/auth/reset-password/:resetToken
```

**Request Body:**
```json
{
  "password": "newPassword123"
}
```

---

### 👥 Users Management (`/api/users`)

**Authentication:** Required (Admin only)

#### Get All Users
```http
GET /api/users
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 10)
- `role`: Filter by role
- `status`: Filter by status

---

#### Get User by ID
```http
GET /api/users/:id
```

---

#### Update User
```http
PUT /api/users/:id
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "status": "active"
}
```

---

#### Delete User
```http
DELETE /api/users/:id
```

---

### 💼 Jobs (`/api/jobs`)

#### Get All Jobs (Public)
```http
GET /api/jobs
```

**Query Parameters:**
- `page`: Page number
- `limit`: Results per page
- `keyword`: Search in title/description
- `location`: Filter by location
- `type`: Filter by job type
- `experienceLevel`: Filter by experience level
- `status`: Filter by status

**Response:**
```json
{
  "success": true,
  "count": 10,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50
  },
  "data": [
    {
      "_id": "job_id",
      "title": "Full Stack Developer",
      "description": "Job description...",
      "location": "Remote",
      "type": "Full-Time",
      "experienceLevel": "Intermediate",
      "salaryRange": "$80k - $120k",
      "skillsRequired": ["JavaScript", "React", "Node.js"],
      "status": "Open",
      "employerId": {...},
      "companyId": {...},
      "postedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### Get Job by ID
```http
GET /api/jobs/:id
```

---

#### Get My Jobs (Employer)
```http
GET /api/jobs/my-jobs
```

**Authentication:** Required (Employer only)

---

#### Create Job (Employer)
```http
POST /api/jobs
```

**Authentication:** Required (Employer or Admin)

**Request Body:**
```json
{
  "companyId": "company_id",
  "title": "Full Stack Developer",
  "description": "We are looking for...",
  "location": "Remote",
  "type": "Full-Time",
  "experienceLevel": "Intermediate",
  "salaryRange": "$80k - $120k",
  "skillsRequired": ["JavaScript", "React", "Node.js"]
}
```

**Validation:**
- `type`: Must be one of: `Full-Time`, `Part-Time`, `Contract`, `Internship`, `Freelance`
- `experienceLevel`: Must be one of: `Entry Level`, `Intermediate`, `Expert`
- `status`: Default: `Open`, Options: `Open`, `Closed`, `Draft`, `Archived`

---

#### Update Job
```http
PUT /api/jobs/:id
```

**Authentication:** Required (Employer or Admin)

---

#### Delete Job
```http
DELETE /api/jobs/:id
```

**Authentication:** Required (Employer or Admin)

---

### 📄 Applications (`/api/applications`)

**Authentication:** Required

#### Apply for Job (Candidate)
```http
POST /api/applications
```

**Authentication:** Required (Candidate only)

**Request Body:**
```json
{
  "jobId": "job_id",
  "resumeUrl": "https://cloudinary.com/resume.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "application_id",
    "jobId": "job_id",
    "candidateId": "candidate_id",
    "employerId": "employer_id",
    "resumeUrl": "resume_url",
    "status": "Applied",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

#### Get My Applications (Candidate)
```http
GET /api/applications/my-applications
```

**Authentication:** Required (Candidate only)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "application_id",
      "jobId": {
        "title": "Full Stack Developer",
        "companyId": {...}
      },
      "status": "Reviewing",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### Get Company Applications (Employer)
```http
GET /api/applications/employer/all
```

**Authentication:** Required (Employer or Admin)

---

#### Get Applications for Specific Job (Employer)
```http
GET /api/applications/job/:jobId
```

**Authentication:** Required (Employer or Admin)

---

#### Update Application Status (Employer)
```http
PUT /api/applications/:id/status
```

**Authentication:** Required (Employer or Admin)

**Request Body:**
```json
{
  "status": "Interviewing"
}
```

**Status Options:**
- `Applied`
- `Reviewing`
- `Interviewing`
- `Selected`
- `Rejected`

---

### 🏢 Company (`/api/company`)

#### Get All Companies (Public)
```http
GET /api/company
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "company_id",
      "name": "Tech Corp",
      "description": "Leading tech company",
      "logoUrl": "https://cloudinary.com/logo.png",
      "website": "https://techcorp.com",
      "location": "San Francisco, CA",
      "employeesCount": "51-200",
      "ownerId": "user_id"
    }
  ]
}
```

---

#### Get Company by ID
```http
GET /api/company/:id
```

---

#### Get My Company (Employer)
```http
GET /api/company/me
```

**Authentication:** Required

---

#### Create Company (Employer)
```http
POST /api/company
```

**Authentication:** Required (Employer or Admin)

**Content-Type:** `multipart/form-data`

**Form Data:**
- `name`: Company name (required)
- `description`: Company description (required)
- `website`: Company website URL
- `location`: Company location (required)
- `employeesCount`: One of: `1-10`, `11-50`, `51-200`, `201-500`, `500+`
- `logo`: Image file (optional)

---

#### Update Company
```http
PUT /api/company/:id
```

**Authentication:** Required (Employer or Admin)

**Content-Type:** `multipart/form-data`

---

### 👤 Candidate Profile (`/api/candidate`)

**Authentication:** Required (Candidate only)

#### Get Candidate Profile
```http
GET /api/candidate/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "profile_id",
    "userId": "user_id",
    "title": "Full Stack Developer",
    "location": "San Francisco, CA",
    "about": "Passionate developer with 5 years experience...",
    "skills": ["JavaScript", "React", "Node.js"],
    "phone": "+1234567890",
    "avatarUrl": "https://cloudinary.com/avatar.jpg",
    "resumes": [
      {
        "name": "resume.pdf",
        "url": "https://cloudinary.com/resume.pdf",
        "uploadedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "defaultResumeUrl": "https://cloudinary.com/resume.pdf",
    "savedJobs": []
  }
}
```

---

#### Update Candidate Profile
```http
PUT /api/candidate/profile
```

**Request Body:**
```json
{
  "title": "Senior Full Stack Developer",
  "location": "Remote",
  "about": "Updated bio...",
  "skills": ["JavaScript", "React", "Node.js", "MongoDB"],
  "phone": "+1234567890"
}
```

---

#### Upload Resume
```http
POST /api/candidate/resume
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `resume`: PDF file (required)

---

#### Delete Resume
```http
DELETE /api/candidate/resume/:resumeId
```

---

#### Upload Avatar
```http
POST /api/candidate/avatar
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `avatar`: Image file (required)

---

#### Get Saved Jobs
```http
GET /api/candidate/saved-jobs
```

---

#### Save Job
```http
POST /api/candidate/saved-jobs
```

**Request Body:**
```json
{
  "jobId": "job_id"
}
```

---

#### Remove Saved Job
```http
DELETE /api/candidate/saved-jobs/:jobId
```

---

### 💬 Chat (`/api/chat`)

**Authentication:** Required

#### Initiate Chat
```http
POST /api/chat
```

**Request Body:**
```json
{
  "participantId": "user_id"
}
```

---

#### Get All Conversations
```http
GET /api/chat/conversations
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "conversationId": "conv_id",
      "participant": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "lastMessage": {
        "content": "Hello!",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    }
  ]
}
```

---

#### Get Messages in Conversation
```http
GET /api/chat/:conversationId/messages
```

**Query Parameters:**
- `page`: Page number
- `limit`: Messages per page

---

#### Send Message
```http
POST /api/chat/messages
```

**Request Body:**
```json
{
  "receiverId": "user_id",
  "content": "Hello, how are you?"
}
```

**Note:** Real-time messaging is handled via Socket.IO

---

### 🔔 Notifications (`/api/notifications`)

**Authentication:** Required

#### Get All Notifications
```http
GET /api/notifications
```

**Query Parameters:**
- `page`: Page number
- `limit`: Notifications per page
- `isRead`: Filter by read status (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "notification_id",
      "recipientId": "user_id",
      "type": "Info",
      "message": "Your application has been reviewed",
      "isRead": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Notification Types:**
- `Info`
- `Alert`
- `Success`

---

#### Mark Notification as Read
```http
PUT /api/notifications/:id/read
```

---

### 🔍 Employer Search (`/api/employer`)

**Authentication:** Required (Employer only)

#### Search Candidates
```http
GET /api/employer/candidates
```

**Query Parameters:**
- `skills`: Comma-separated skills to search
- `location`: Location filter
- `keyword`: Search keyword
- `page`: Page number
- `limit`: Results per page

---

#### Get Candidate by ID
```http
GET /api/employer/candidates/:id
```

---

### 📊 Reports (`/api/reports`)

**Authentication:** Required (Admin only)

#### Get Platform Statistics
```http
GET /api/reports/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1000,
    "totalJobs": 150,
    "totalApplications": 500,
    "totalCompanies": 50,
    "usersByRole": {
      "candidate": 800,
      "employer": 180,
      "admin": 20
    }
  }
}
```

---

#### Get Recent Activity
```http
GET /api/reports/activity
```

---

#### Get User Growth
```http
GET /api/reports/growth
```

---

### 📝 Content Management (`/api/content`)

**Authentication:** Required (Admin only)

#### Get All Content
```http
GET /api/content
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "content_id",
      "key": "about",
      "value": "About page content...",
      "lastUpdatedBy": "admin_user_id",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Content Keys:**
- `about`: About page content
- `terms`: Terms of service
- `privacy`: Privacy policy

---

#### Update Content
```http
PUT /api/content
```

**Request Body:**
```json
{
  "key": "about",
  "value": "Updated about page content..."
}
```

---

## WebSocket Events (Socket.IO)

The application uses Socket.IO for real-time communication.

### Connection
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Chat Events

#### Send Message
```javascript
socket.emit('sendMessage', {
  receiverId: 'user_id',
  content: 'Hello!'
});
```

#### Receive Message
```javascript
socket.on('newMessage', (message) => {
  console.log('New message:', message);
});
```

### Notification Events

#### Receive Notification
```javascript
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate email)
- `500 Internal Server Error`: Server error

---

## Data Models

### User
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String (hashed),
  role: 'candidate' | 'employer' | 'admin',
  status: 'active' | 'blocked',
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Job
```javascript
{
  _id: ObjectId,
  employerId: ObjectId (ref: User),
  companyId: ObjectId (ref: Company),
  title: String,
  description: String,
  location: String,
  type: 'Full-Time' | 'Part-Time' | 'Contract' | 'Internship' | 'Freelance',
  experienceLevel: 'Entry Level' | 'Intermediate' | 'Expert',
  salaryRange: String,
  skillsRequired: [String],
  status: 'Open' | 'Closed' | 'Draft' | 'Archived',
  postedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Application
```javascript
{
  _id: ObjectId,
  jobId: ObjectId (ref: Job),
  candidateId: ObjectId (ref: User),
  employerId: ObjectId (ref: User),
  resumeUrl: String,
  status: 'Applied' | 'Reviewing' | 'Interviewing' | 'Selected' | 'Rejected',
  createdAt: Date,
  updatedAt: Date
}
```

### Company
```javascript
{
  _id: ObjectId,
  ownerId: ObjectId (ref: User),
  name: String,
  description: String,
  logoUrl: String,
  website: String,
  location: String,
  employeesCount: '1-10' | '11-50' | '51-200' | '201-500' | '500+',
  createdAt: Date,
  updatedAt: Date
}
```

### CandidateProfile
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String,
  location: String,
  about: String,
  skills: [String],
  phone: String,
  avatarUrl: String,
  resumes: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  defaultResumeUrl: String,
  savedJobs: [ObjectId (ref: Job)],
  createdAt: Date,
  updatedAt: Date
}
```

### Message
```javascript
{
  _id: ObjectId,
  conversationId: String,
  senderId: ObjectId (ref: User),
  receiverId: ObjectId (ref: User),
  content: String,
  readAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Notification
```javascript
{
  _id: ObjectId,
  recipientId: ObjectId (ref: User),
  type: 'Info' | 'Alert' | 'Success',
  message: String,
  isRead: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/job-portal

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRE=90d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=noreply@jobportal.com
FROM_NAME=Job Portal

# Frontend URL
CLIENT_URL=http://localhost:3000
```

---

## Installation & Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd kritiJobBackend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start MongoDB**
```bash
mongod
```

5. **Run the application**

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

---

## Testing API Endpoints

You can test the API using tools like:
- **Postman**: Import the endpoints and test
- **cURL**: Command-line testing
- **Thunder Client** (VS Code extension)
- **Insomnia**

### Example cURL Request:

```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "candidate"
  }'

# Get all jobs
curl http://localhost:5000/api/jobs

# Get authenticated user (requires token)
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Rate Limiting

Consider implementing rate limiting for production:
- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per 15 minutes

---

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens for authentication
- CORS enabled with configurable origins
- Helmet.js for security headers
- Input validation using express-validator
- File upload restrictions (type and size)
- Role-based access control (RBAC)

---

## Support & Contact

For issues, questions, or contributions, please contact the development team or create an issue in the repository.

---

## License

This project is licensed under the MIT License.
