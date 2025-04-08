import mongoose from "mongoose";
import { nanoid } from "nanoid";
const LinkSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => nanoid(8),
    required: true,
    unique: true,
    immutable: true,
  },
  originalURL: {
    type: String,
    required: true,
  },
  alias: {
    type: String,
    required: false,
    trim: true,
    minlength: [3, "Alias must be at least 3 characters"],
    maxlength: [20, "Alias cannot exceed 20 characters"],
  },
  expDate: {
    type: Date,
    required: false,
    validate: {
      validator: function (v) {
        return !v || v > new Date();
      },
      message: "Expiration date must be in the future",
    },
  },
  createdAt: { type: Date, required: true, default: Date.now() },
});

export default mongoose.model("Link", LinkSchema);
