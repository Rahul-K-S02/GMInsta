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
    mediaType === "video"
      ? mediaFallback || "/public/images/default-avatar.svg"
      : buildOptimizedAssetUrl({
          publicId: mediaPublicId,
          fallbackUrl: mediaFallback,
          resourceType: "image"
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

const normalizeUserProfilePic = (user) => {
  if (!user) return "/public/images/default-avatar.svg";
  return (
    user.profilePic ||
    buildOptimizedImageUrl({
      publicId: user.profilePicPublicId,
      fallbackUrl: user.profilePic
    }) ||
    "/public/images/default-avatar.svg"
  );
};

const toStoryPayload = (post, viewerId) => {
  const normalized = normalizePostMedia(post);
  const viewedBy = Array.isArray(post.storyViewedBy) ? post.storyViewedBy : [];
  const likes = Array.isArray(post.likes) ? post.likes : [];
  return {
    _id: normalized._id,
    userId: normalized.userId,
    mediaType: normalized.mediaType,
    mediaUrl: normalized.mediaUrl,
    mediaPublicId: normalized.mediaPublicId,
    caption: normalized.caption || "",
    createdAt: normalized.createdAt,
    storyExpiresAt: normalized.storyExpiresAt,
    likesCount: typeof post.likesCount === "number" ? post.likesCount : likes.length,
    isLiked: viewerId ? likes.some((id) => String(id) === String(viewerId)) : false,
    isViewed: viewerId ? viewedBy.some((id) => String(id) === String(viewerId)) : false
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

    const posts = await Post.find({ isStory: { $ne: true } })
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

    const totalPosts = await Post.countDocuments({ isStory: { $ne: true } });
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

    const posts = await Post.find({ userId: requestedUserId, isStory: { $ne: true } })
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

    const totalPosts = await Post.countDocuments({ userId: requestedUserId, isStory: { $ne: true } });
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

const deletePost = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: "Invalid post id" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (String(post.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only delete your own posts" });
    }

    const mediaPublicId = post.mediaPublicId || post.imagePublicId || null;
    const mediaType = post.mediaType === "video" ? "video" : "image";

    const [commentIds, notificationIds] = await Promise.all([
      Comment.find({ postId: post._id }).distinct("_id"),
      Notification.find({ postId: post._id }).distinct("_id")
    ]);

    await Promise.all([
      Comment.deleteMany({ postId: post._id }),
      Notification.deleteMany({ postId: post._id }),
      User.updateMany({}, { $pull: { "links.comments": { $in: commentIds } } }),
      User.updateMany({}, { $pull: { "links.notifications": { $in: notificationIds } } }),
      User.findByIdAndUpdate(req.user.id, { $pull: { "links.posts": post._id } }),
      post.deleteOne()
    ]);

    if (mediaPublicId) {
      await deleteFromCloudinary(mediaPublicId, mediaType).catch(() => {});
    }

    return res.json({ message: "Post deleted", postId: post._id });
  } catch (error) {
    next(error);
  }
};

const getReels = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "8", 10);
    const skip = (page - 1) * limit;

    const posts = await Post.find({ mediaType: "video", isStory: { $ne: true } })
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

    const totalPosts = await Post.countDocuments({ mediaType: "video", isStory: { $ne: true } });
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

const createStory = async (req, res, next) => {
  let uploadedPublicId = null;
  let resourceType = "image";
  try {
    if (!req.file) return res.status(400).json({ message: "Story media (image/video) is required" });

    const postId = new mongoose.Types.ObjectId();
    const isVideo = String(req.file.mimetype || "").toLowerCase().startsWith("video/");
    resourceType = isVideo ? "video" : "image";
    uploadedPublicId = `${isVideo ? "stories_video" : "stories"}/${postId.toString()}`;

    const uploadedMedia = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      publicId: uploadedPublicId,
      resourceType
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await Post.create({
      _id: postId,
      userId: req.user.id,
      caption: (req.body.caption || "").trim() || "Story",
      mediaType: isVideo ? "video" : "image",
      mediaUrl: uploadedMedia.secure_url,
      mediaPublicId: uploadedMedia.public_id,
      image: isVideo ? undefined : uploadedMedia.secure_url,
      imagePublicId: isVideo ? undefined : uploadedMedia.public_id,
      isStory: true,
      storyExpiresAt: expiresAt,
      storyViewedBy: [req.user.id]
    });

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { "links.posts": story._id } });

    const populated = await Post.findById(story._id).populate("userId", "username profilePic profilePicPublicId");
    const payload = toStoryPayload(populated.toObject(), req.user.id);

    const io = req.app.get("io");
    if (io) io.emit("story_created", { userId: req.user.id, storyId: String(story._id) });

    return res.status(201).json(payload);
  } catch (error) {
    if (uploadedPublicId) {
      await deleteFromCloudinary(uploadedPublicId, resourceType).catch(() => {});
    }
    next(error);
  }
};

const listStories = async (req, res, next) => {
  try {
    const now = new Date();

    const stories = await Post.find({ isStory: true, storyExpiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic profilePicPublicId")
      .lean();

    const grouped = new Map();
    for (const story of stories) {
      const user = story.userId;
      if (!user?._id) continue;
      const key = String(user._id);
      const entry = grouped.get(key) || {
        userId: user._id,
        username: user.username,
        profilePic: normalizeUserProfilePic(user),
        latestCreatedAt: story.createdAt,
        stories: [],
        seenCount: 0
      };
      const payload = toStoryPayload(story, req.user.id);
      if (payload.isViewed) entry.seenCount += 1;
      entry.stories.push(payload);
      if (new Date(story.createdAt) > new Date(entry.latestCreatedAt)) {
        entry.latestCreatedAt = story.createdAt;
      }
      grouped.set(key, entry);
    }

    const result = Array.from(grouped.values())
      .map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        profilePic: entry.profilePic,
        latestCreatedAt: entry.latestCreatedAt,
        storiesCount: entry.stories.length,
        hasUnseen: entry.seenCount < entry.stories.length
      }))
      .sort((a, b) => {
        if (String(a.userId) === String(req.user.id)) return -1;
        if (String(b.userId) === String(req.user.id)) return 1;
        return new Date(b.latestCreatedAt) - new Date(a.latestCreatedAt);
      });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

const getStoriesByUser = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const now = new Date();
    const stories = await Post.find({
      userId: req.params.userId,
      isStory: true,
      storyExpiresAt: { $gt: now }
    })
      .sort({ createdAt: 1 })
      .populate("userId", "username profilePic profilePicPublicId");

    return res.json(stories.map((story) => toStoryPayload(story.toObject(), req.user.id)));
  } catch (error) {
    next(error);
  }
};

const markStoryViewed = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storyId)) {
      return res.status(400).json({ message: "Invalid story id" });
    }

    const story = await Post.findOne({
      _id: req.params.storyId,
      isStory: true,
      storyExpiresAt: { $gt: new Date() }
    });

    if (!story) return res.status(404).json({ message: "Story not found or expired" });
    story.storyViewedBy = Array.isArray(story.storyViewedBy) ? story.storyViewedBy : [];
    if (!story.storyViewedBy.some((id) => String(id) === String(req.user.id))) {
      story.storyViewedBy.push(req.user.id);
      await story.save();
    }

    return res.json({ message: "Story marked viewed", storyId: story._id });
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

module.exports = {
  createPost,
  createStory,
  listStories,
  getStoriesByUser,
  markStoryViewed,
  getFeed,
  getUserPosts,
  getReels,
  reactPost,
  deletePost,
  verifyPostImage
};
