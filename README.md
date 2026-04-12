# GMinsta

Instagram-like mini social media app using Node.js, Express, MongoDB, JWT, Multer, and Socket.io.

## Folder Structure

```txt
GMinsta/
├── config/
├── controllers/
├── middleware/
├── models/
├── public/
│   ├── css/
│   ├── images/
│   └── js/
├── routes/
├── seed/
├── uploads/
├── views/
├── .env.example
├── app.js
└── package.json
```

## Features

- Authentication (register/login) with JWT + bcrypt
- User profile, bio, profile image upload
- Follow/unfollow users
- Create post with image upload (Multer)
- Feed with pagination and infinite scroll
- Like/dislike posts
- Comment add/view/delete
- Notification feed for likes/comments
- Search users
- One-to-one real-time chat via Socket.io
- Security middleware: Helmet, CORS, rate limit
- Dark mode UI

## Setup (Step-by-Step)

1. Install dependencies:
   - `npm install`
2. Create `.env` from `.env.example` and update values.
3. Ensure MongoDB is running locally or use Atlas URI.
4. Optional sample data:
   - `npm run seed`
5. Start app:
   - `npm run dev`
6. Open:
   - [http://localhost:5000](http://localhost:5000)

## Important API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `PUT /api/users/me`
- `POST /api/users/follow/:userId`
- `GET /api/users/search?q=alice`
- `POST /api/posts`
- `GET /api/posts?page=1&limit=5`
- `POST /api/posts/:postId/react` (body: `{ "action": "like" }`)
- `POST /api/comments/:postId`
- `GET /api/comments/:postId`
- `DELETE /api/comments/:commentId`
- `GET /api/messages/:userId`
- `GET /api/notifications`

## Sample Login Data (after seed)

- `alice@gminsta.com` / `123456`
- `bob@gminsta.com` / `123456`
