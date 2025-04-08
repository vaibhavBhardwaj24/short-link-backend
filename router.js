import express from "express";
import {
  createLink,
  getDashboardStats,
  getLink,
  getLinkStats,
} from "./controller.js";
const router = express.Router();

router.get("/link/:id", getLink);
router.post("/link", createLink);
router.get("/dashboard", getDashboardStats);
router.get("/dashboard/link/:id", getLinkStats);
export default router;
