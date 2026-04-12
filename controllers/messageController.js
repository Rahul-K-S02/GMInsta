const Message = require("../models/Message");

const getConversation = async (req, res, next) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;

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
