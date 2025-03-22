const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  displayName: String,
  email: String,
  avatar: String,
  accessToken: {
    type: String,
    required: true,
  },
  repositories: [
    {
      name: String,
      fullName: String,
      description: String,
      private: Boolean,
      updatedAt: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
