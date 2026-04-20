# GMinsta

Instagram-like mini social media app using Node.js, Express, MongoDB, JWT, Multer, Socket.io, and Cloudinary.

## What Changed for Image Storage

Images are no longer stored in local `uploads/` for new uploads.

- Post image `public_id`: `posts/<userId>/<postId>`
- Profile image `public_id`: `profiles/<userId>`
- Post document stores:
  - `image` (Cloudinary secure URL)
  - `imagePublicId` (Cloudinary public id)
- User document stores:
  - `profilePic` (Cloudinary secure URL)
  - `profilePicPublicId` (Cloudinary public id)

This guarantees each uploaded image is mapped to the correct MongoDB user and post IDs.

## Setup (Basic, Step by Step)

1. Install dependencies:
   - `npm install`
2. Create your env file:
   - Copy `.env.example` to `.env`
3. Fill required values in `.env`:
   - MongoDB values (`MONGO_URI`, `DB_NAME`)
   - JWT values (`JWT_SECRET`, `JWT_EXPIRES_IN`)
   - Cloudinary values (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
   - Google OAuth values (`GOOGLE_CLIENT_ID`, `CLIENT_SECRET` or `GOOGLE_CLIENT_SECRET`, `CALL_BACK_URL` or `GOOGLE_CALLBACK_PATH`)
4. Start app:
   - `npm run dev`
5. Open:
   - [http://localhost:5000](http://localhost:5000)

## Authentication Options

- Email/password accounts are created from the register form and signed in from the login form.
- Google accounts use the server-side OAuth redirect flow from either auth page.
- Both flows issue the same JWT token and store the same `token` and `user` values in `localStorage`.
- Google-created users are stored in MongoDB with `authProvider: "google"` and a `googleId` value.

## Google Sign-In Setup

1. Create an OAuth 2.0 Client ID in Google Cloud Console.
2. Add the app origin, for example `http://localhost:5000`, to the authorized JavaScript origins.
3. Add the full redirect URI, for example `http://localhost:5000/api/auth/google/callback`, to the authorized redirect URIs.
4. Copy the client ID and client secret into your `.env` file.
5. Keep `CALL_BACK_URL` or `GOOGLE_CALLBACK_PATH` set to the callback path used by the app, for example `/api/auth/google/callback`.
6. Open the site on the exact same origin you authorized, not `127.0.0.1` and not a fallback port.
7. If you use `CANONICAL_HOST`, keep it set to `localhost` unless you also register that host in Google Cloud.
8. Set `PUBLIC_APP_URL` to your deployed origin when you move to production so the callback URL is generated correctly.

## Cloudinary Values (Where to Get)

1. Create/login Cloudinary account.
2. Open Dashboard.
3. Copy:
   - Cloud Name
   - API Key
   - API Secret
4. Paste them into your `.env`.

## Important API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/google`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/auth/config`
- `GET /api/users/me`
- `PUT /api/users/me`
- `POST /api/users/follow/:userId`
- `GET /api/users/search?q=alice`
- `POST /api/posts`
- `GET /api/posts?page=1&limit=5`
- `POST /api/posts/:postId/react`
- `POST /api/comments/:postId`
- `GET /api/comments/:postId`
- `DELETE /api/comments/:commentId`
- `GET /api/messages/:userId`
- `GET /api/notifications`
