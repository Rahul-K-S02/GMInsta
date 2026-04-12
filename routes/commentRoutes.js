const express = require("express");
const auth = require("../middleware/auth");
const { addComment, getCommentsByPost, deleteComment } = require("../controllers/commentController");

const router = express.Router();
router.post("/:postId", auth, addComment);
router.get("/:postId", auth, getCommentsByPost);
router.delete("/:commentId", auth, deleteComment);

module.exports = router;
