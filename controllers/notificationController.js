const Notification = require("../models/Notification");

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("actorId", "username profilePic")
      .populate("postId", "caption image");
    return res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { $set: { isRead: true } });
    return res.json({ message: "Notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markAsRead };
