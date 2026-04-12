const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messageText: { type: String, required: true, trim: true, maxlength: 1000 },
  sentAt: { type: Date, default: Date.now }
}, { collection: "Message" });

messageSchema.index({ senderId: 1, receiverId: 1, sentAt: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, sentAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
