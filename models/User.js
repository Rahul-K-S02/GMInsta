const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" },
    profilePic: { type: String, default: "/public/images/default-avatar.svg" },
    profilePicPublicId: { type: String, unique: true, sparse: true },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    links: {
      posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
      comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
      messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
      notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notification" }]
    }
  },
  { timestamps: true, collection: "User" }
);

module.exports = mongoose.model("User", userSchema);
