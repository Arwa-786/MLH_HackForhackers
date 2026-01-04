# Demo Data Setup Guide

## Step 1: Insert Demo Requests into MongoDB

Open MongoDB Compass and navigate to your `requests` collection. Insert the following documents:

```json
[
  {
    "_id": "demo_request_1",
    "from_user_id": "6958c084d6d4ea1f109dad71",
    "to_user_id": "6958c084d6d4ea1f109dad70",
    "hackathon_id": "69595cc4050b63ae29083b97",
    "status": "pending",
    "message": "Hey! I saw your VR skills. Want to team up?",
    "createdAt": { "$date": "2024-01-15T10:00:00Z" }
  },
  {
    "_id": "demo_request_2",
    "from_user_id": "6958c084d6d4ea1f109dad72",
    "to_user_id": "6958c084d6d4ea1f109dad70",
    "hackathon_id": "69595cc4050b63ae29083b97",
    "status": "pending",
    "message": "I'm a Backend dev, let's win this!",
    "createdAt": { "$date": "2024-01-15T10:05:00Z" }
  }
]
```

**Or use MongoDB Compass Insert Document (one at a time):**

Document 1:
```json
{
  "from_user_id": "6958c084d6d4ea1f109dad71",
  "to_user_id": "6958c084d6d4ea1f109dad70",
  "hackathon_id": "69595cc4050b63ae29083b97",
  "status": "pending",
  "message": "Hey! I saw your VR skills. Want to team up?"
}
```

Document 2:
```json
{
  "from_user_id": "6958c084d6d4ea1f109dad72",
  "to_user_id": "6958c084d6d4ea1f109dad70",
  "hackathon_id": "69595cc4050b63ae29083b97",
  "status": "pending",
  "message": "I'm a Backend dev, let's win this!"
}
```

**Important Notes:**
- Replace `6958c084d6d4ea1f109dad70` with your actual user ID (CURRENT_USER_ID)
- Replace `69595cc4050b63ae29083b97` with your actual hackathon ID
- Make sure the `from_user_id` values correspond to existing users in your `users` collection
- The `to_user_id` should be your user ID

## Step 2: Verify Users Exist

Make sure these users exist in your `users` collection:
- User ID: `6958c084d6d4ea1f109dad71` (Elena - example)
- User ID: `6958c084d6d4ea1f109dad72` (Alex - example)

If they don't exist, create them with appropriate names, skills, and tech stacks.

## Step 3: Test the Flow

1. Refresh your app
2. Click on the "INCOMING_REQUESTS" button
3. You should see 2 pending requests
4. Click "ACCEPT()" on one request
5. Confetti should appear
6. Chat panel should automatically open
7. Welcome message should appear: "🎉 Team formed! [Names] are now collaborating..."

## Troubleshooting

- If requests don't appear: Check that `to_user_id` matches your CURRENT_USER_ID
- If accept fails: Verify the request `_id` is correct
- If chat doesn't open: Check browser console for errors
- If welcome message doesn't appear: Check that team was created in MongoDB

