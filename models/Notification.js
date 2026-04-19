const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    type: { type: String, enum: ["like", "comment", "event"], required: true },
    isRead: { type: Boolean, default: false }
    ,
    // Event Hub payload (stored in Notification collection; only used when type === "event")
    event: {
      title: { type: String, trim: true, maxlength: 120 },
      description: { type: String, trim: true, maxlength: 600 },
      category: { type: String, enum: ["hackathon", "workshop", "competition", "cultural", "sports"] },
      dateLabel: { type: String, trim: true, maxlength: 40 },
      timeLabel: { type: String, trim: true, maxlength: 40 },
      location: { type: String, trim: true, maxlength: 120 },
      totalSpots: { type: Number, min: 0, max: 100000 },
      posterUrl: { type: String, trim: true },
      posterPublicId: { type: String, trim: true },
      registeredUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
    }
  },
  { timestamps: true, collection: "Notification" }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
