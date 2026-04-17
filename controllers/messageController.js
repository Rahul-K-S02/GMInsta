const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

const getConversations = async (req, res, next) => {
  try {
    const me = req.user.id;
    const messages = await Message.find({
      $or: [{ senderId: me }, { receiverId: me }]
    })
      .sort({ sentAt: -1 })
      .populate("senderId receiverId", "username profilePic");

    const conversations = {};
    messages.forEach((msg) => {
      const partner = String(msg.senderId._id) === me ? msg.receiverId : msg.senderId;
      const partnerId = String(partner._id);

      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          userId: partner._id,
          username: partner.username,
          profilePic: partner.profilePic,
          lastMessage: msg.messageText,
          lastSentAt: msg.sentAt,
          lastSenderId: msg.senderId._id,
          unreadCount: 0
        };
      }

      if (!msg.readAt && String(msg.receiverId._id) === me) {
        conversations[partnerId].unreadCount += 1;
      }
    });

    return res.json(Object.values(conversations));
  } catch (error) {
    next(error);
  }
};

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

    await Message.updateMany(
      { senderId: other, receiverId: me, readAt: null },
      { readAt: new Date() }
    );

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

const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { receiverId, messageText } = req.body;

    if (!receiverId || !messageText || !messageText.trim()) {
      return res.status(400).json({ message: "Receiver and message text are required." });
    }
    if (receiverId === senderId) {
      return res.status(400).json({ message: "You cannot send a message to yourself." });
    }

    const isConnected = await User.exists({
      _id: senderId,
      $or: [{ following: receiverId }, { followers: receiverId }]
    });
    if (!isConnected) {
      return res.status(403).json({ message: "You can only message connected users." });
    }

    const message = await Message.create({
      senderId,
      receiverId,
      messageText: messageText.trim()
    });

    await Promise.all([
      User.findByIdAndUpdate(senderId, { $addToSet: { "links.messages": message._id } }),
      User.findByIdAndUpdate(receiverId, { $addToSet: { "links.messages": message._id } })
    ]);

    const populated = await message.populate("senderId receiverId", "username profilePic");

    const io = req.app.get("io");
    if (io && io.onlineUsers) {
      const receiverSocketId = io.onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message_received", populated);
      }
    }

    return res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

module.exports = { getConversation, getConversations, sendMessage };
