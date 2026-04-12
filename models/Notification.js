const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    type: { type: String, enum: ["like", "comment"], required: true },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
