# GMInsta

An Instagram-like mini social media app with real-time features, built with Node.js, Express, and MongoDB.

**Live demo:** [gminsta-3.onrender.com](https://gminsta-3.onrender.com/)

> Note: hosted on Render's free tier, so the app may take 30–60 seconds to spin up on first load if it's been idle.

## Features

- Email/password and Google OAuth authentication
- Post creation with image uploads (Cloudinary storage)
- Follow system and user search
- Reactions and comments on posts
- Real-time messaging and notifications (Socket.io)
- Profile management

## Tech Stack

| Layer          | Technology                      |
|----------------|----------------------------------|
| Backend        | Node.js, Express                 |
| Database       | MongoDB                          |
| Auth           | JWT, Google OAuth 2.0            |
| Real-time      | Socket.io                        |
| File Uploads   | Multer, Cloudinary                |

## Image Storage

Images are no longer stored in the local `uploads/` folder. All new uploads go directly to Cloudinary.

| Type          | Cloudinary `public_id` format     |
|---------------|-------------------------------------|
| Post image    | `posts/<userId>/<postId>`          |
| Profile image | `profiles/<userId>`                |

**Post document stores:**
- `image` — Cloudinary secure URL
- `imagePublicId` — Cloudinary public ID

**User document stores:**
- `profilePic` — Cloudinary secure URL
- `profilePicPublicId` — Cloudinary public ID

This mapping guarantees every uploaded image is tied to the correct MongoDB user and post IDs.

## Getting Started

### Prerequisites

- Node.js and npm installed
- A MongoDB instance (local or Atlas)
- A Cloudinary account
- A Google Cloud project (for OAuth)

### Installation

1. **Install dependencies**
```bash
   npm install
```

2. **Create your environment file**
```bash
   cp .env.example .env
```

3. **Fill in the required values** in `.env` (see [Environment Variables](#environment-variables) below).

4. **Start the app**
```bash
   npm run dev
```

5. **Open the app**
   Navigate to [http://localhost:5000](http://localhost:5000)

### Environment Variables

| Variable                                    | Description                                  |
|----------------------------------------------|-----------------------------------------------|
| `MONGO_URI`                                  | MongoDB connection string                     |
| `DB_NAME`                                    | MongoDB database name                         |
| `JWT_SECRET`                                 | Secret key used to sign JWTs                  |
| `JWT_EXPIRES_IN`                             | JWT expiry duration (e.g. `7d`)               |
| `CLOUDINARY_CLOUD_NAME`                      | Cloudinary cloud name                         |
| `CLOUDINARY_API_KEY`                         | Cloudinary API key                            |
| `CLOUDINARY_API_SECRET`                      | Cloudinary API secret                         |
| `GOOGLE_CLIENT_ID`                           | Google OAuth client ID                        |
| `CLIENT_SECRET` / `GOOGLE_CLIENT_SECRET`     | Google OAuth client secret                    |
| `CALL_BACK_URL` / `GOOGLE_CALLBACK_PATH`     | Google OAuth callback path                    |
| `CANONICAL_HOST`                             | Optional. Keep as `localhost` unless registered otherwise in Google Cloud |
| `PUBLIC_APP_URL`                             | Set to your deployed origin in production     |

## Authentication

- **Email/password**: accounts are created via the register form and signed in via the login form.
- **Google OAuth**: uses the server-side redirect flow, available from either auth page.
- Both flows issue the same JWT and store the same `token` and `user` values in `localStorage`.
- Google-created users are stored in MongoDB with `authProvider: "google"` and a `googleId`.

### Google Sign-In Setup

1. Create an OAuth 2.0 Client ID in [Google Cloud Console](https://console.cloud.google.com/).
2. Add your app origin (e.g. `http://localhost:5000`) to **Authorized JavaScript origins**.
3. Add the full redirect URI (e.g. `http://localhost:5000/api/auth/google/callback`) to **Authorized redirect URIs**.
4. Copy the client ID and client secret into `.env`.
5. Keep `CALL_BACK_URL` / `GOOGLE_CALLBACK_PATH` set to the callback path used by the app (e.g. `/api/auth/google/callback`).
6. Open the site on the **exact same origin** you authorized — not `127.0.0.1`, and not a fallback port.
7. If using `CANONICAL_HOST`, keep it set to `localhost` unless that host is also registered in Google Cloud.
8. Set `PUBLIC_APP_URL` to your deployed origin in production so the callback URL is generated correctly.

### Cloudinary Setup

1. Create or log in to a [Cloudinary](https://cloudinary.com/) account.
2. Open the Dashboard.
3. Copy your **Cloud Name**, **API Key**, and **API Secret**.
4. Paste them into `.env`.

## API Reference

### Auth

| Method | Endpoint                       | Description                  |
|--------|---------------------------------|-------------------------------|
| POST   | `/api/auth/register`           | Register with email/password |
| POST   | `/api/auth/login`              | Log in with email/password   |
| GET    | `/api/auth/google`             | Initiate Google OAuth        |
| GET    | `/api/auth/google/start`       | Start Google OAuth flow      |
| GET    | `/api/auth/google/callback`    | Google OAuth callback        |
| GET    | `/api/auth/config`             | Get auth configuration       |

### Users

| Method | Endpoint                          | Description              |
|--------|-------------------------------------|----------------------------|
| GET    | `/api/users/me`                    | Get current user profile |
| PUT    | `/api/users/me`                    | Update current user profile |
| POST   | `/api/users/follow/:userId`        | Follow/unfollow a user   |
| GET    | `/api/users/search?q=alice`        | Search users by query    |

### Posts

| Method | Endpoint                          | Description              |
|--------|-------------------------------------|----------------------------|
| POST   | `/api/posts`                       | Create a new post        |
| GET    | `/api/posts?page=1&limit=5`        | Get paginated posts feed |
| POST   | `/api/posts/:postId/react`         | React to a post          |

### Comments

| Method | Endpoint                          | Description               |
|--------|-------------------------------------|-----------------------------|
| POST   | `/api/comments/:postId`            | Add a comment on a post   |
| GET    | `/api/comments/:postId`            | Get comments for a post   |
| DELETE | `/api/comments/:commentId`         | Delete a comment          |

### Messages & Notifications

| Method | Endpoint                     | Description                |
|--------|--------------------------------|------------------------------|
| GET    | `/api/messages/:userId`       | Get message thread with a user |
| GET    | `/api/notifications`          | Get notifications for current user |

## License

Specify your license here (e.g. MIT).
