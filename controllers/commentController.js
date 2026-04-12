const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Notification = require("../models/Notification");

const addComment = async (req, res, next) => {
  try {
    const { commentText } = req.body;
    if (!commentText) return res.status(400).json({ message: "Comment is required" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await Comment.create({
      postId: req.params.postId,
      userId: req.user.id,
      commentText
    });
    const populated = await comment.populate("userId", "username profilePic");

    if (String(post.userId) !== req.user.id) {
      await Notification.create({ userId: post.userId, actorId: req.user.id, postId: post._id, type: "comment" });
    }

    return res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

const getCommentsByPost = async (req, res, next) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .sort({ createdAt: -1 })
      .populate("userId", "username profilePic");
    return res.json(comments);
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
    return res.json({ message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = { addComment, getCommentsByPost, deleteComment };
