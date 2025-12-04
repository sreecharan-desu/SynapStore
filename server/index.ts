import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Middleware
app.use(express.json({ limit: "10mb" })); // Increase limit to 10MB
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello from backend");
});

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Listening on Port number ${process.env.PORT}`);
});
