const Post = require("../models/Post");
const Notification = require("../models/Notification");
const User = require("../models/User");
const mongoose = require("mongoose");
const { uploadBufferToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary");

const createPost = async (req, res, next) => {
  let imagePublicId = null;
  try {
    const caption = (req.body.caption || "").trim();
    if (!req.file) return res.status(400).json({ message: "Post image is required" });
    if (!caption) return res.status(400).json({ message: "Caption is required" });

    const postId = new mongoose.Types.ObjectId();
    imagePublicId = `posts/${req.user.id}/${postId.toString()}`;
    const uploadedImage = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      publicId: imagePublicId
    });

    const post = await Post.create({
      _id: postId,
      userId: req.user.id,
      caption,
      image: uploadedImage.secure_url,
      imagePublicId: uploadedImage.public_id
    });

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { "links.posts": post._id } });
    return res.status(201).json(post);
  } catch (error) {
    if (imagePublicId) await deleteFromCloudinary(imagePublicId).catch(() => {});
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
    if (action !== "like") return res.status(400).json({ message: "Invalid action" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const uid = req.user.id;
    const isLiked = post.likes.some((id) => String(id) === uid);

    if (isLiked) {
      // Unlike: remove from likes
      post.likes = post.likes.filter((id) => String(id) !== uid);
    } else {
      // Like: add to likes
      post.likes.push(uid);
    }

    await post.save();

    if (!isLiked && String(post.userId) !== uid) {
      const notification = await Notification.create({ userId: post.userId, actorId: uid, postId: post._id, type: "like" });
      await User.findByIdAndUpdate(post.userId, { $addToSet: { "links.notifications": notification._id } });
    }

    return res.json({ message: "Reaction updated", likes: post.likes.length, isLiked: !isLiked });
  } catch (error) {
    next(error);
  }
};

module.exports = { createPost, getFeed, reactPost };
