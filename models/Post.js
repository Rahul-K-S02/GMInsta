const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    caption: { type: String, required: true, trim: true, maxlength: 300 },
    // New unified media fields (image or video)
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    mediaUrl: { type: String },
    mediaPublicId: { type: String, unique: true, sparse: true },

    // Backwards-compatible image fields (older docs / older client code)
    image: { type: String },
    imagePublicId: { type: String, unique: true, sparse: true },
    isStory: { type: Boolean, default: false },
    storyExpiresAt: { type: Date, default: null },
    storyViewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 }
  },
  { timestamps: true, collection: "Posts" }
);

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ mediaType: 1, createdAt: -1 });
postSchema.index({ isStory: 1, storyExpiresAt: -1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
