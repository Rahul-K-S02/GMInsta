const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

const onlineUsers = new Map();

const setupSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Auth token missing"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized socket"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);

    socket.on("private_message", async ({ receiverId, messageText }) => {
      if (!receiverId || !messageText) return;

      const message = await Message.create({
        senderId: userId,
        receiverId,
        messageText
      });

      const populated = await message.populate("senderId receiverId", "username profilePic");
      socket.emit("message_sent", populated);

      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message_received", populated);
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
    });
  });
};

module.exports = setupSocket;
