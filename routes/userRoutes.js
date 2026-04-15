const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { getMyProfile, getUserProfile, updateProfile, followOrUnfollow, searchUsers, discoverUsers } = require("../controllers/userController");

const router = express.Router();
router.get("/me", auth, getMyProfile);
router.put("/me", auth, upload.single("profilePic"), updateProfile);
router.post("/follow/:userId", auth, followOrUnfollow);
router.get("/search", auth, searchUsers);
router.get("/discover", auth, discoverUsers);
router.get("/:userId", auth, getUserProfile);

module.exports = router;
