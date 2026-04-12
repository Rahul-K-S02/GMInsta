const User = require("../models/User");

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password").populate("followers following", "username profilePic");
    return res.json(user);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const updates = {
      bio: req.body.bio
    };
    if (req.file) updates.profilePic = `/uploads/${req.file.filename}`;

    const updated = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
    return res.json({ message: "Profile updated", user: updated });
  } catch (error) {
    next(error);
  }
};

const followOrUnfollow = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (targetUserId === req.user.id) return res.status(400).json({ message: "You cannot follow yourself" });

    const me = await User.findById(req.user.id);
    const target = await User.findById(targetUserId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyFollowing = me.following.map(String).includes(targetUserId);
    if (alreadyFollowing) {
      me.following = me.following.filter((id) => String(id) !== targetUserId);
      target.followers = target.followers.filter((id) => String(id) !== req.user.id);
    } else {
      me.following.push(targetUserId);
      target.followers.push(req.user.id);
    }

    await me.save();
    await target.save();
    return res.json({ message: alreadyFollowing ? "Unfollowed successfully" : "Followed successfully" });
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q || "";
    const users = await User.find({
      $or: [{ username: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }]
    })
      .select("username email profilePic bio")
      .limit(20);
    return res.json(users);
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyProfile, updateProfile, followOrUnfollow, searchUsers };
