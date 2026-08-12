import { Router } from "express";
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/", getProducts);
router.use(authenticate);
router.use(requireRole("SELLER"));
router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
