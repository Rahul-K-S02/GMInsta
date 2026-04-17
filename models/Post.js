const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    caption: { type: String, required: true, trim: true, maxlength: 300 },
    image: { type: String, required: true },
    imagePublicId: { type: String, unique: true, sparse: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 }
  },
  { timestamps: true, collection: "Posts" }
);

postSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
