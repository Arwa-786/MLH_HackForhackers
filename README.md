# Hackathon Team Matching - HackConnect

A React application for matching hackathon team members with AI-generated compatibility scores.

## Features

- Fetch user profiles from MongoDB
- Display user cards with name, skills, GitHub, and school
- AI-generated match scores (strong/good/okay/bad)
- Send team requests with a limit of 5 requests per user
- Beautiful UI built with Tailwind CSS

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Axios

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your API endpoint:
   - Update `API_BASE_URL` in `src/pages/TeamMatching.jsx`
   - Or set `REACT_APP_API_URL` environment variable

3. Run the development server:
```bash
npm run dev
```

## API Endpoints Expected

The application expects the following backend endpoints:

- `GET /api/users` - Fetch all user profiles
- `POST /api/requests` - Send a team request
  - Body: `{ targetUserId: string }`

## Project Structure

```
src/
  ├── components/
  │   └── UserCard.jsx      # User profile card component
  ├── pages/
  │   └── TeamMatching.jsx  # Main team matching page
  ├── App.jsx               # Root component
  ├── main.jsx              # Entry point
  └── index.css             # Global styles with Tailwind
```

## Notes

- Request limit is tracked in localStorage
- Mock data is included for development/testing
- Match scores are currently simulated (replace with actual AI service)

