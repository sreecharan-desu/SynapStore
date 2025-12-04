import express from "express";
import cors from "cors";

import dotenv from "dotenv";
import v1Router from "./routes/v1";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cors());

app.use("/api/v1", v1Router);

app.get("/", async (req, res) => {
  res.send("Hello from backend");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on Port number ${process.env.PORT || 3000}`);
});
