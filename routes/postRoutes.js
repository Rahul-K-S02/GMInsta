const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { createPost, getFeed, getUserPosts, getReels, reactPost, verifyPostImage } = require("../controllers/postController");

const router = express.Router();
router.post("/", auth, upload.single("image"), createPost);
router.get("/", auth, getFeed);
router.get("/user/:userId", auth, getUserPosts);
router.get("/reels", auth, getReels);
router.get("/:postId/verify", auth, verifyPostImage);
router.post("/:postId/react", auth, reactPost);

module.exports = router;
