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
4. Start app:
   - `npm run dev`
5. Open:
   - [http://localhost:5000](http://localhost:5000)

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
