import { extractIngredients, extractIngredientsFromImage, parseRecipeText, translateText } from "../services/aiService.js";

export async function ingredientsFromText(req, res) {

  try {

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Text is required"
      });
    }

    const result = await extractIngredients(text);

    res.json({
      success: true,
      ingredients: result.ingredients
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "AI processing failed"
    });

  }
}

export async function translateTextController(req, res) {
  try {
    const { text, language } = req.body;

    if (!text || !language) {
      return res.status(400).json({
        success: false,
        message: "Text and language are required",
      });
    }

    const translated = await translateText(text, language);

    return res.json({
      success: true,
      text: translated,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Translation failed",
    });
  }
}

export async function ingredientsFromImage(req, res) {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const cleaned = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    const imageBuffer = Buffer.from(cleaned, "base64");
    const result = await extractIngredientsFromImage(imageBuffer);

    return res.json({
      success: true,
      ingredients: result.ingredients,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Image ingredient detection failed",
    });
  }
}

export async function parseRecipeController(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Text is required",
      });
    }

    const data = await parseRecipeText(text);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Recipe parse failed",
    });
  }
}
