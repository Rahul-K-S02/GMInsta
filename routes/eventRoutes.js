const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const upload = require("../middleware/upload");
const { listEvents, createEvent, registerForEvent } = require("../controllers/eventController");

const router = express.Router();
router.get("/", auth, listEvents);
router.post("/", auth, requireAdmin, upload.single("poster"), createEvent);
router.post("/:eventId/register", auth, registerForEvent);

module.exports = router;
