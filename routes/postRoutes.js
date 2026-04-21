const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
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
} = require("../controllers/postController");

const router = express.Router();
router.post("/", auth, upload.single("image"), createPost);
router.post("/stories", auth, upload.single("image"), createStory);
router.get("/stories", auth, listStories);
router.get("/stories/:userId", auth, getStoriesByUser);
router.post("/stories/:storyId/view", auth, markStoryViewed);
router.get("/", auth, getFeed);
router.get("/user/:userId", auth, getUserPosts);
router.get("/reels", auth, getReels);
router.get("/:postId/verify", auth, verifyPostImage);
router.post("/:postId/react", auth, reactPost);
router.delete("/:postId", auth, deletePost);

module.exports = router;
