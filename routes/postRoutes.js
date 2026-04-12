const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { createPost, getFeed, reactPost } = require("../controllers/postController");

const router = express.Router();
router.post("/", auth, upload.single("image"), createPost);
router.get("/", auth, getFeed);
router.post("/:postId/react", auth, reactPost);

module.exports = router;
