# Demo Request - MongoDB Insert Command

## Quick Insert for Demo

Run this in MongoDB Compass (or mongo shell) to create one incoming request for your demo:

```javascript
db.requests.insertOne({
  "from_user_id": "6958c084d6d4ea1f109dad71",
  "fromUserId": "6958c084d6d4ea1f109dad71",
  "to_user_id": "6958c084d6d4ea1f109dad70",
  "toUserId": "6958c084d6d4ea1f109dad70",
  "hackathon_id": "69595cc4050b63ae29083b97",
  "hackathonId": "69595cc4050b63ae29083b97",
  "status": "pending",
  "message": "Hey! I saw your profile and think we'd make a great team. Want to collaborate?",
  "createdAt": new Date()
})
```

## What This Does:

- **from_user_id/fromUserId**: The sender's user ID (Elena or another user)
- **to_user_id/toUserId**: Your user ID (`6958c084d6d4ea1f109dad70`) - this is who receives the request
- **hackathon_id/hackathonId**: The hackathon ID you're registered for
- **status**: `"pending"` - so it shows up in incoming requests
- **message**: A friendly message that will appear in the request card

## After Inserting:

1. Refresh your app
2. Click the "INCOMING_REQUESTS()" button
3. You should see one request from the sender
4. Click "ACCEPT()" to accept and form a team

## Alternative: Use an Existing User ID

If you want to use a different sender, replace `"6958c084d6d4ea1f109dad71"` with any valid user ID from your `users` collection.

