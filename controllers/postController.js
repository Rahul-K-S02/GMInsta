const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const User = require("../models/User");
const mongoose = require("mongoose");
const {
  uploadBufferToCloudinary,
  buildOptimizedAssetUrl,
  buildOptimizedImageUrl,
  deleteFromCloudinary,
  getCloudinaryResource
} = require("../utils/cloudinary");

const normalizePostMedia = (post) => {
  const mediaType = post.mediaType || "image";
  const mediaPublicId = post.mediaPublicId || post.imagePublicId || null;
  const mediaFallback = post.mediaUrl || post.image || null;
  const mediaUrl =
    buildOptimizedAssetUrl({
      publicId: mediaPublicId,
      fallbackUrl: mediaFallback,
      resourceType: mediaType === "video" ? "video" : "image"
    }) || "/public/images/default-avatar.svg";

  return {
    ...post,
    mediaType,
    mediaUrl,
    mediaPublicId,
    userId: post.userId
      ? {
          ...post.userId,
          profilePic:
            post.userId.profilePic ||
            buildOptimizedImageUrl({
              publicId: post.userId.profilePicPublicId,
              fallbackUrl: post.userId.profilePic
            }) ||
            "/public/images/default-avatar.svg"
        }
      : { username: "Unknown", profilePic: "/public/images/default-avatar.svg" }
  };
};

const createPost = async (req, res, next) => {
  let uploadedPublicId = null;
  let resourceType = "image";
  try {
    const caption = (req.body.caption || "").trim();
    if (!req.file) return res.status(400).json({ message: "Post media (image/video) is required" });
    if (!caption) return res.status(400).json({ message: "Caption is required" });

    const postId = new mongoose.Types.ObjectId();
    const isVideo = String(req.file.mimetype || "").toLowerCase().startsWith("video/");
    resourceType = isVideo ? "video" : "image";
    uploadedPublicId = `${isVideo ? "reels" : "posts"}/${postId.toString()}`;
    const uploadedImage = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      publicId: uploadedPublicId,
      resourceType
    });

    const post = await Post.create({
      _id: postId,
      userId: req.user.id,
      caption,
      mediaType: isVideo ? "video" : "image",
      mediaUrl: uploadedImage.secure_url,
      mediaPublicId: uploadedImage.public_id,
      image: isVideo ? undefined : uploadedImage.secure_url,
      imagePublicId: isVideo ? undefined : uploadedImage.public_id
    });

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { "links.posts": post._id } });
    return res.status(201).json(normalizePostMedia(post.toObject()));
  } catch (error) {
    if (uploadedPublicId) {
      await deleteFromCloudinary(uploadedPublicId, resourceType).catch(() => {});
    }

    console.error("Post upload failed", {
      userId: req.user?.id,
      postId: req.params?.postId,
      uploadedPublicId,
      fileName: req.file?.originalname,
      caption: req.body?.caption,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    });

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Image upload failed.",
        details: error.message
      });
    }

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
      .populate("userId", "username profilePic profilePicPublicId");

    const uid = req.user.id;
    const postsWithLikeStatus = posts.map(post => ({
      ...normalizePostMedia(post.toObject()),
      likesCount: typeof post.likesCount === "number" ? post.likesCount : post.likes.length,
      dislikesCount: typeof post.dislikesCount === "number" ? post.dislikesCount : post.dislikes.length,
      isLiked: post.likes.some(id => String(id) === uid),
      isDisliked: post.dislikes.some(id => String(id) === uid)
    }));

    const totalPosts = await Post.countDocuments();
    return res.json({
      page,
      limit,
      totalPosts,
      totalPages: Math.ceil(totalPosts / limit),
      posts: postsWithLikeStatus
    });
  } catch (error) {
    next(error);
  }
};

const getUserPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = Math.min(60, parseInt(req.query.limit || "30", 10));
    const skip = (page - 1) * limit;

    const requestedUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const posts = await Post.find({ userId: requestedUserId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username profilePic profilePicPublicId");

    const postIds = posts.map((post) => post._id);
    const commentStats = postIds.length
      ? await Comment.aggregate([
          { $match: { postId: { $in: postIds } } },
          { $group: { _id: "$postId", count: { $sum: 1 } } }
        ])
      : [];
    const commentCountMap = new Map(commentStats.map((item) => [String(item._id), item.count]));

    const uid = req.user.id;
    const postsWithLikeStatus = posts.map((post) => ({
      ...normalizePostMedia(post.toObject()),
      likesCount: typeof post.likesCount === "number" ? post.likesCount : post.likes.length,
      dislikesCount: typeof post.dislikesCount === "number" ? post.dislikesCount : post.dislikes.length,
      commentsCount: commentCountMap.get(String(post._id)) || 0,
      isLiked: post.likes.some((id) => String(id) === uid),
      isDisliked: post.dislikes.some((id) => String(id) === uid)
    }));

    const totalPosts = await Post.countDocuments({ userId: requestedUserId });
    return res.json({
      page,
      limit,
      totalPosts,
      totalPages: Math.ceil(totalPosts / limit),
      posts: postsWithLikeStatus
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
    const wasLiked = post.likes.some((id) => String(id) === uid);
    const wasDisliked = post.dislikes.some((id) => String(id) === uid);

    if (action === "like") {
      if (wasLiked) {
        post.likes = post.likes.filter((id) => String(id) !== uid);
      } else {
        post.likes.addToSet(uid);
        post.dislikes = post.dislikes.filter((id) => String(id) !== uid);
      }
    } else {
      if (wasDisliked) {
        post.dislikes = post.dislikes.filter((id) => String(id) !== uid);
      } else {
        post.dislikes.addToSet(uid);
        post.likes = post.likes.filter((id) => String(id) !== uid);
      }
    }

    post.likesCount = post.likes.length;
    post.dislikesCount = post.dislikes.length;
    await post.save();

    const isLiked = post.likes.some((id) => String(id) === uid);
    const isDisliked = post.dislikes.some((id) => String(id) === uid);

    if (action === "like" && !wasLiked && String(post.userId) !== uid) {
      const notification = await Notification.create({ userId: post.userId, actorId: uid, postId: post._id, type: "like" });
      await User.findByIdAndUpdate(post.userId, { $addToSet: { "links.notifications": notification._id } });
    }

    return res.json({
      message: "Reaction updated",
      postId: post._id,
      likesCount: post.likesCount,
      dislikesCount: post.dislikesCount,
      isLiked,
      isDisliked
    });
  } catch (error) {
    next(error);
  }
};

const getReels = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "8", 10);
    const skip = (page - 1) * limit;

    const posts = await Post.find({ mediaType: "video" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username profilePic profilePicPublicId");

    const uid = req.user.id;
    const reels = posts.map(post => ({
      ...normalizePostMedia(post.toObject()),
      likesCount: typeof post.likesCount === "number" ? post.likesCount : post.likes.length,
      dislikesCount: typeof post.dislikesCount === "number" ? post.dislikesCount : post.dislikes.length,
      isLiked: post.likes.some(id => String(id) === uid),
      isDisliked: post.dislikes.some(id => String(id) === uid)
    }));

    const totalPosts = await Post.countDocuments({ mediaType: "video" });
    return res.json({
      page,
      limit,
      totalPosts,
      totalPages: Math.ceil(totalPosts / limit),
      reels
    });
  } catch (error) {
    next(error);
  }
};

const verifyPostImage = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId).select("mediaType mediaUrl mediaPublicId image imagePublicId");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const mediaType = post.mediaType || "image";
    const publicId = post.mediaPublicId || post.imagePublicId || null;

    if (!publicId) {
      return res.json({
        exists: false,
        postId: post._id,
        publicId: null,
        message: "This post has no Cloudinary public id saved."
      });
    }

    try {
      const resource = await getCloudinaryResource(publicId, mediaType === "video" ? "video" : "image");
      return res.json({
        exists: true,
        postId: post._id,
        publicId,
        secureUrl: resource.secure_url,
        bytes: resource.bytes,
        createdAt: resource.created_at
      });
    } catch (error) {
      const httpCode = error?.http_code || error?.error?.http_code;
      if (httpCode === 404) {
        return res.json({
          exists: false,
          postId: post._id,
          publicId,
          message: "Cloudinary resource not found (404)."
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { createPost, getFeed, getUserPosts, getReels, reactPost, verifyPostImage };
