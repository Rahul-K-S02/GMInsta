const Post = require("../models/Post");
const Notification = require("../models/Notification");

const createPost = async (req, res, next) => {
  try {
    const { caption } = req.body;
    if (!req.file) return res.status(400).json({ message: "Post image is required" });
    if (!caption) return res.status(400).json({ message: "Caption is required" });

    const post = await Post.create({
      userId: req.user.id,
      caption,
      image: `/uploads/${req.file.filename}`
    });
    return res.status(201).json(post);
  } catch (error) {
    next(error);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "5", 10);
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username profilePic");

    const totalPosts = await Post.countDocuments();
    return res.json({
      page,
      limit,
      totalPosts,
      totalPages: Math.ceil(totalPosts / limit),
      posts
    });
  } catch (error) {
    next(error);
  }
};

const reactPost = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!["like", "dislike"].includes(action)) return res.status(400).json({ message: "Invalid action" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const uid = req.user.id;
    post.likes = post.likes.filter((id) => String(id) !== uid);
    post.dislikes = post.dislikes.filter((id) => String(id) !== uid);
    if (action === "like") post.likes.push(uid);
    else post.dislikes.push(uid);

    await post.save();

    if (action === "like" && String(post.userId) !== uid) {
      await Notification.create({ userId: post.userId, actorId: uid, postId: post._id, type: "like" });
    }

    return res.json({ message: "Reaction updated", likes: post.likes.length, dislikes: post.dislikes.length });
  } catch (error) {
    next(error);
  }
};

module.exports = { createPost, getFeed, reactPost };
