const express = require("express");
const auth = require("../middleware/auth");
const { getConversation } = require("../controllers/messageController");

const router = express.Router();
router.get("/:userId", auth, getConversation);

module.exports = router;
