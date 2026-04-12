const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { getMyProfile, updateProfile, followOrUnfollow, searchUsers } = require("../controllers/userController");

const router = express.Router();
router.get("/me", auth, getMyProfile);
router.put("/me", auth, upload.single("profilePic"), updateProfile);
router.post("/follow/:userId", auth, followOrUnfollow);
router.get("/search", auth, searchUsers);

module.exports = router;
