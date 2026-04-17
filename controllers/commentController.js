const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const User = require("../models/User");
const mongoose = require("mongoose");

const addComment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: "Invalid post id" });
    }

    const commentText = (req.body.commentText || "").trim();
    if (!commentText) return res.status(400).json({ message: "Comment is required" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await Comment.create({
      postId: req.params.postId,
      userId: req.user.id,
      commentText
    });

    const populated = await comment.populate("userId", "username profilePic");
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { "links.comments": comment._id } }).catch((error) => {
      console.error("Unable to attach comment to user links:", error.message);
    });

    if (String(post.userId) !== req.user.id) {
      const notification = await Notification.create({
        userId: post.userId,
        actorId: req.user.id,
        postId: post._id,
        type: "comment"
      }).catch((error) => {
        console.error("Unable to create comment notification:", error.message);
        return null;
      });

      if (notification?._id) {
        await User.findByIdAndUpdate(post.userId, { $addToSet: { "links.notifications": notification._id } }).catch((error) => {
          console.error("Unable to attach notification to user links:", error.message);
        });
      }
    }

    return res.status(201).json({
      ...populated.toObject(),
      likesCount: populated.likesCount ?? populated.likes?.length ?? 0,
      dislikesCount: populated.dislikesCount ?? populated.dislikes?.length ?? 0
    });
  } catch (error) {
    next(error);
  }
};

const getCommentsByPost = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: "Invalid post id" });
    }

    const sortParam = String(req.query.sort || "asc").toLowerCase();
    const sort = sortParam === "desc" ? -1 : 1;
    const limit = Math.max(0, Math.min(parseInt(req.query.limit || "0", 10) || 0, 200));
    const skip = Math.max(0, parseInt(req.query.skip || "0", 10) || 0);

    const [total, comments] = await Promise.all([
      Comment.countDocuments({ postId: req.params.postId }),
      Comment.find({ postId: req.params.postId })
        .sort({ createdAt: sort })
        .skip(skip)
        .limit(limit || 0)
        .populate("userId", "username profilePic")
    ]);

    const normalized = comments.map((comment) => ({
      ...comment.toObject(),
      likesCount: typeof comment.likesCount === "number" ? comment.likesCount : comment.likes.length,
      dislikesCount: typeof comment.dislikesCount === "number" ? comment.dislikesCount : comment.dislikes.length
    }));

    return res.json({ postId: req.params.postId, total, comments: normalized });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (String(comment.userId) !== req.user.id) return res.status(403).json({ message: "Forbidden" });

    await comment.deleteOne();
    await User.findByIdAndUpdate(req.user.id, { $pull: { "links.comments": comment._id } });
    return res.json({ message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
};

const reactComment = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!["like", "dislike"].includes(action)) return res.status(400).json({ message: "Invalid action" });

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const uid = req.user.id;
    comment.likes = comment.likes.filter((id) => String(id) !== uid);
    comment.dislikes = comment.dislikes.filter((id) => String(id) !== uid);
    if (action === "like") comment.likes.push(uid);
    else comment.dislikes.push(uid);

    comment.likesCount = comment.likes.length;
    comment.dislikesCount = comment.dislikes.length;
    await comment.save();

    return res.json({
      message: "Comment reaction updated",
      commentId: comment._id,
      postId: comment.postId,
      likesCount: comment.likesCount,
      dislikesCount: comment.dislikesCount
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { addComment, getCommentsByPost, deleteComment, reactComment };
