require("dotenv").config();
const bcrypt = require("bcrypt");
const connectDB = require("../config/db");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

const run = async () => {
  await connectDB();
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({})
  ]);

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

  await Notification.create([
    {
      userId: u1._id,
      actorId: u1._id,
      type: "event",
      isRead: false,
      event: {
        title: "Startup Pitch Competition",
        description: "Present your startup idea to a panel of investors and mentors. Top 3 ideas get seed funding.",
        category: "competition",
        dateLabel: "May 20",
        timeLabel: "11:00 AM",
        location: "Business School Auditorium",
        totalSpots: 30,
        posterUrl: "",
        posterPublicId: "",
        registeredUsers: []
      }
    },
    {
      userId: u1._id,
      actorId: u1._id,
      type: "event",
      isRead: false,
      event: {
        title: "Campus Cultural Fest - Euphoria 2026",
        description: "Three days of music, dance, drama, and art. Open to all departments. Register for individual events.",
        category: "cultural",
        dateLabel: "May 15",
        timeLabel: "10:00 AM",
        location: "Main Auditorium",
        totalSpots: 500,
        posterUrl: "",
        posterPublicId: "",
        registeredUsers: []
      }
    },
    {
      userId: u1._id,
      actorId: u1._id,
      type: "event",
      isRead: false,
      event: {
        title: "HackCampus 2026 - 24hr Hackathon",
        description: "Build innovative solutions for campus problems. Prizes worth $50,000. Teams of 2-4.",
        category: "hackathon",
        dateLabel: "May 10",
        timeLabel: "9:00 AM",
        location: "Innovation Lab, Block A",
        totalSpots: 200,
        posterUrl: "",
        posterPublicId: "",
        registeredUsers: []
      }
    },
    {
      userId: u1._id,
      actorId: u1._id,
      type: "event",
      isRead: false,
      event: {
        title: "Inter-Department Cricket Tournament",
        description: "Annual cricket tournament between all departments. Register your team now!",
        category: "sports",
        dateLabel: "May 1",
        timeLabel: "7:00 AM",
        location: "College Sports Ground",
        totalSpots: 88,
        posterUrl: "",
        posterPublicId: "",
        registeredUsers: []
      }
    },
    {
      userId: u1._id,
      actorId: u1._id,
      type: "event",
      isRead: false,
      event: {
        title: "UI/UX Workshop - Figma to Prototype",
        description: "Hands-on workshop covering wireframes, design systems, and interactive prototyping.",
        category: "workshop",
        dateLabel: "Apr 25",
        timeLabel: "3:00 PM",
        location: "Computer Lab 2",
        totalSpots: 60,
        posterUrl: "",
        posterPublicId: "",
        registeredUsers: []
      }
    }
  ]);

  console.log("Sample data inserted.");
  process.exit(0);
};

run();
