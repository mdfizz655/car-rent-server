# DriveFleet Server

## Setup & Run

1. Install dependencies:
```
npm install
```

2. Create `.env` file:
```
DB_USER=your_mongodb_atlas_username
DB_PASS=your_mongodb_atlas_password
ACCESS_TOKEN_SECRET=any_random_strong_string
PORT=8000
```

3. Run locally:
```
npm run dev
```

## Deploy to Render
- Build command: `npm install`
- Start command: `npm start`
- Add all `.env` variables in Render dashboard → Environment
