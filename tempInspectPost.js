require('dotenv').config();
const connectDB = require('./config/db');
const Post = require('./models/Post');
const User = require('./models/User');

async function run() {
  try {
    await connectDB();
    const users = await User.find().limit(5).lean();
    const post = await Post.findOne().sort({ createdAt: -1 }).lean();
    console.log('users:', JSON.stringify(users, null, 2));
    console.log('latest post:', JSON.stringify(post, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();