const express = require("express");
const auth = require("../middleware/auth");
const { getNotifications, markAsRead } = require("../controllers/notificationController");

const router = express.Router();
router.get("/", auth, getNotifications);
router.patch("/read", auth, markAsRead);

module.exports = router;
