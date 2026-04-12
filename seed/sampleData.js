require("dotenv").config();
const bcrypt = require("bcrypt");
const connectDB = require("../config/db");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Message = require("../models/Message");

const run = async () => {
  await connectDB();
  await Promise.all([User.deleteMany({}), Post.deleteMany({}), Comment.deleteMany({}), Message.deleteMany({})]);

  const pass = await bcrypt.hash("123456", 10);
  const [u1, u2] = await User.create([
    { username: "alice", email: "alice@gminsta.com", password: pass, bio: "Travel + coffee" },
    { username: "bob", email: "bob@gminsta.com", password: pass, bio: "Code and gym" }
  ]);

  const post = await Post.create({
    userId: u1._id,
    caption: "Welcome to GMinsta sample post",
    image: "/public/images/default-avatar.svg"
  });

  await Comment.create({ postId: post._id, userId: u2._id, commentText: "Looks great!" });
  await Message.create({ senderId: u1._id, receiverId: u2._id, messageText: "Hey Bob!" });

  console.log("Sample data inserted.");
  process.exit(0);
};

run();
