const express = require("express");
const {
	register,
	login,
	getGoogleConfig,
	startGoogleAuth,
} = require("../controllers/authController");

const router = express.Router();
router.get("/config", getGoogleConfig);
router.get("/google", startGoogleAuth);
router.get("/google/start", startGoogleAuth);
router.post("/register", register);
router.post("/login", login);

module.exports = router;
