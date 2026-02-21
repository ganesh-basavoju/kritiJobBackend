# Subscription Module

This module handles premium subscription management for candidates.

## Endpoints

- `POST /api/subscriptions/create-order` - Create Razorpay order
- `POST /api/subscriptions/verify-payment` - Verify payment and activate subscription
- `GET /api/subscriptions/status` - Get current subscription status
- `GET /api/subscriptions/history` - Get subscription history
- `POST /api/subscriptions/cancel` - Cancel auto-renewal

## Configuration

Set the following environment variables in `.env`:

```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

## Pricing

- **Premium Plan**: ₹499/month (49900 paise)
- **Duration**: 30 days

## Features

### For Non-Premium Candidates:
- Maximum 10 job applications per month
- Lower ranking in application lists

### For Premium Candidates:
- Unlimited job applications
- Higher ranking in application lists (shown first to employers)
- Priority badge

## Testing

Use Razorpay test credentials:
- Card: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date

For complete documentation, see: `PREMIUM_SUBSCRIPTION_GUIDE.md`
