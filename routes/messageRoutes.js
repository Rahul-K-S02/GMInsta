const express = require("express");
const auth = require("../middleware/auth");
const { getConversation, getConversations, sendMessage } = require("../controllers/messageController");

const router = express.Router();
router.get("/conversations", auth, getConversations);
router.get("/:userId", auth, getConversation);
router.post("/", auth, sendMessage);

module.exports = router;
