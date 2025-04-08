import express from "express";
import cors from "cors";
import connectDB from "./db.js";
import "dotenv/config";
import router from "./router.js";

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use("/api", router);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
