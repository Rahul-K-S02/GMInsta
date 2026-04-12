const express = require("express");
const auth = require("../middleware/auth");
const { addComment, getCommentsByPost, deleteComment, reactComment } = require("../controllers/commentController");

const router = express.Router();
router.post("/:postId", auth, addComment);
router.get("/:postId", auth, getCommentsByPost);
router.post("/:commentId/react", auth, reactComment);
router.delete("/:commentId", auth, deleteComment);

module.exports = router;
