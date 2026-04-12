const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (user) =>
  jwt.sign({ id: user._id, username: user.username, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });
    const token = signToken(user);

    return res.status(201).json({
      message: "Registration successful",
      token,
      user: { id: user._id, username: user.username, email: user.email, bio: user.bio, profilePic: user.profilePic }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);
    return res.json({
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username, email: user.email, bio: user.bio, profilePic: user.profilePic }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };
