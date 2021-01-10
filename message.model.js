const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    message: String,
    gif: String,
    sender_id: String,
    sender_name: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Message", messageSchema);
