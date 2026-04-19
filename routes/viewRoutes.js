const path = require("path");
const express = require("express");

const router = express.Router();

router.get("/", (req, res) => res.sendFile(path.join(__dirname, "../views/login.html")));
router.get("/register", (req, res) => res.sendFile(path.join(__dirname, "../views/register.html")));
router.get("/home", (req, res) => res.sendFile(path.join(__dirname, "../views/home.html")));
router.get("/create", (req, res) => res.sendFile(path.join(__dirname, "../views/create.html")));
router.get("/discover", (req, res) => res.sendFile(path.join(__dirname, "../views/discover.html")));
router.get("/reels", (req, res) => res.sendFile(path.join(__dirname, "../views/reels.html")));
router.get("/events", (req, res) => res.sendFile(path.join(__dirname, "../views/events.html")));
router.get("/profile", (req, res) => res.sendFile(path.join(__dirname, "../views/profile.html")));
router.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "../views/chat.html")));

module.exports = router;
