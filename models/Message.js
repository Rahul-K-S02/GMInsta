const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messageText: { type: String, required: true, trim: true, maxlength: 1000 },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
