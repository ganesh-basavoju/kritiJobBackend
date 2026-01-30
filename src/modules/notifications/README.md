# Notifications Module

Production-grade push notification system using Firebase Cloud Messaging (FCM).

## Overview

This module handles:
- FCM device token management
- Push notification delivery via Firebase Admin SDK
- Notification history persistence
- Automatic invalid token cleanup
- Event-driven notification triggers

## Architecture

```
┌─────────────────┐
│   Controllers   │  ← REST API endpoints
│  notifications  │
│   .controller   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Services     │  ← Core business logic
│  notification   │
│    .service     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│     Models      │  ← MongoDB schemas
│  DeviceToken    │
│  Notification   │
└─────────────────┘
```

## Files

### Controller
**`notifications.controller.js`** - HTTP request handlers
- Token registration/unregistration
- Notification history retrieval
- Read/unread management
- Deletion operations

### Service
**`notification.service.js`** - Core notification logic
- Push sending via Firebase Admin SDK
- Single/bulk/role-based sends
- Invalid token cleanup
- Error handling

### Models
**`DeviceToken.js`** - FCM token storage
- Links tokens to users and roles
- Platform tracking (Android/iOS)
- Enable/disable status

**`Notification.js`** - Notification persistence
- All sent notifications stored
- Read/unread tracking
- Deep linking data

### Routes
**`notifications.routes.js`** - API endpoints
- All routes require authentication
- RESTful design

## API Endpoints

### Token Management

#### Register Token
```http
POST /api/notifications/register-token
Content-Type: application/json
Authorization: Bearer <token>

{
  "fcmToken": "string",
  "platform": "android|ios",
  "deviceId": "string (optional)"
}
```

#### Unregister Token
```http
DELETE /api/notifications/unregister-token
Content-Type: application/json
Authorization: Bearer <token>

{
  "fcmToken": "string"
}
```

### Notification History

#### Get Notifications
```http
GET /api/notifications?page=1&limit=20
Authorization: Bearer <token>
```

#### Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

#### Mark as Read
```http
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

#### Mark Multiple as Read
```http
PUT /api/notifications/mark-read
Content-Type: application/json
Authorization: Bearer <token>

{
  "notificationIds": ["id1", "id2", "id3"]
}
```

#### Mark All as Read
```http
PUT /api/notifications/mark-all-read
Authorization: Bearer <token>
```

#### Delete Notification
```http
DELETE /api/notifications/:id
Authorization: Bearer <token>
```

#### Clear All
```http
DELETE /api/notifications/clear-all
Authorization: Bearer <token>
```

## Service Methods

### Send to User
```javascript
await notificationService.sendToUser(userId, {
  title: 'Notification Title',
  body: 'Notification message',
  type: 'job_alert',
  actionScreen: 'JobDetails',
  actionData: { jobId: '123' }
});
```

### Send to Multiple Users
```javascript
await notificationService.sendToMultipleUsers([userId1, userId2], notification);
```

### Send to Role
```javascript
await notificationService.sendToRole('candidate', notification);
```

### Specific Notification Types
```javascript
// New job alert
await notificationService.sendNewJobAlert(job);

// Application status update
await notificationService.sendApplicationStatusUpdate(application, previousStatus);

// New applicant alert
await notificationService.sendNewApplicantAlert(application, job, candidate);
```

## Notification Types

| Type | Description | Recipients |
|------|-------------|-----------|
| `job_alert` | New job posted | All candidates |
| `application_status` | Application status changed | Candidate |
| `new_applicant` | New application received | Employer |
| `job_deadline` | Job deadline approaching | (Future) |
| `general` | General notification | Any |

## Deep Linking

Notifications include navigation data:

```javascript
{
  actionScreen: 'JobDetails',  // Target screen
  actionData: {                // Navigation params
    jobId: '123',
    applicationId: '456'
  }
}
```

Supported screens:
- `JobDetails` - Job details page
- `ApplicationDetails` - Application details
- `ApplicantDetails` - Employer views applicant
- `MyApplications` - Candidate's applications
- `JobFeed` - Job listings
- `EmployerApplications` - Applications for a job

## Integration Points

### Jobs Module
**`jobs.controller.js`**
```javascript
// After job creation
if (job.status === 'Open') {
  notificationService.sendNewJobAlert(job).catch(err => {
    console.error('Failed to send job alert:', err.message);
  });
}
```

### Applications Module
**`applications.controller.js`**
```javascript
// After application submission
notificationService.sendNewApplicantAlert(application, job, candidate);

// After status update
notificationService.sendApplicationStatusUpdate(application, previousStatus);
```

## Error Handling

### Invalid Tokens
- Detected during FCM send operation
- Automatically removed from database
- Logged for monitoring

### Send Failures
- Non-blocking (async operations)
- Logged but don't stop main flow
- User experience unaffected

### Missing Tokens
- Gracefully handled
- Warning logged
- No error thrown

## Database Indexes

### DeviceToken Collection
- `{ userId: 1, enabled: 1 }` - User token queries
- `{ fcmToken: 1 }` - Unique constraint
- `{ role: 1, enabled: 1 }` - Role-based sends

### Notification Collection
- `{ userId: 1, read: 1, createdAt: -1 }` - History queries
- `{ userId: 1, type: 1, createdAt: -1 }` - Filter by type

## Security

### Token Storage
- Linked to authenticated users only
- Role-based access control
- JWT validation required

### Service Account
- Never exposed to frontend
- Stored in environment variables
- Proper Firebase permissions

### Data Privacy
- Users only see their own notifications
- Tokens not shared across users
- Sensitive data not in push payload

## Monitoring

### Key Metrics
- Token registration success rate
- Notification delivery rate
- Invalid token frequency
- Average send latency

### Logs
```javascript
logger.info(`FCM token registered for user: ${userId}`);
logger.info(`Notification sent to user ${userId}: ${successCount}/${totalCount} succeeded`);
logger.warn(`No active device tokens found for user: ${userId}`);
logger.error(`Error sending notification: ${error.message}`);
```

## Testing

### Manual Testing
1. Register device token via app
2. Trigger notification event (create job, apply, etc.)
3. Verify push received on device
4. Check database for notification record
5. Test deep linking by tapping notification

### API Testing (Postman/cURL)
```bash
# Register token
curl -X POST https://kriti-job-backend.vercel.app/api/notifications/register-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fcmToken":"test-token","platform":"android"}'

# Get notifications
curl -X GET https://kriti-job-backend.vercel.app/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Maintenance

### Token Cleanup (Recommended Cron Job)
```javascript
// Remove disabled tokens older than 30 days
cron.schedule('0 2 * * *', async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await DeviceToken.deleteMany({
    enabled: false,
    updatedAt: { $lt: cutoff }
  });
});
```

## Future Enhancements

### Planned Features
- [ ] User notification preferences
- [ ] Notification scheduling
- [ ] Rich notifications (images, actions)
- [ ] Notification analytics
- [ ] A/B testing for messages
- [ ] Rate limiting per user
- [ ] Batch send optimization

### Scalability
- [ ] Redis caching for tokens
- [ ] Message queue for bulk sends
- [ ] Multi-region FCM support
- [ ] Monitoring dashboard

## Dependencies

- `firebase-admin` - Firebase Admin SDK for FCM
- `mongoose` - MongoDB ODM
- `winston` - Logging

## References

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [React Native Firebase](https://rnfirebase.io/)
