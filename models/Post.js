const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    caption: { type: String, required: true, trim: true, maxlength: 300 },
    image: { type: String, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
