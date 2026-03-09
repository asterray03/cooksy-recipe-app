import express from "express";
import { ingredientsFromText, parseRecipeController, translateTextController } from "../controllers/aiController.js";

const router = express.Router();

router.post("/ingredients-from-text", ingredientsFromText);
router.post("/translate", translateTextController);
router.post("/parse-recipe", parseRecipeController);

export default router;
