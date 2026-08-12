import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/errorHandler";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.use(errorHandler);

app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
