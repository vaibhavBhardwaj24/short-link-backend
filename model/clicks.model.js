import mongoose from "mongoose";

const ClickSchema = new mongoose.Schema(
  {
    linkId: {
      type: String,
      ref: "Link",
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: String,
    deviceType: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "bot", "other"],
      default: "other",
    },
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String,
    deviceVendor: String,
    deviceModel: String,
    country: String,
    region: String,
    city: String,
    timezone: String,
    referrer: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Click", ClickSchema);
