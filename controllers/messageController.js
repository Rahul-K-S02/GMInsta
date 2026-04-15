const Message = require("../models/Message");
const User = require("../models/User");

const getConversation = async (req, res, next) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;

    const isConnected = await User.exists({
      _id: me,
      $or: [{ following: other }, { followers: other }]
    });
    if (!isConnected) {
      return res.status(403).json({ message: "You can only view conversations with connected users." });
    }

    const messages = await Message.find({
      $or: [
        { senderId: me, receiverId: other },
        { senderId: other, receiverId: me }
      ]
    })
      .sort({ sentAt: 1 })
      .populate("senderId receiverId", "username profilePic");

    return res.json(messages);
  } catch (error) {
    next(error);
  }
};

module.exports = { getConversation };
