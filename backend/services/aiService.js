import dotenv from "dotenv";
import { HfInference } from "@huggingface/inference";

dotenv.config();

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const parseIngredientsJson = (output) => {
  const jsonMatch = String(output || "").match(/\{[\s\S]*\}/);

  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const ingredients = Array.isArray(parsed?.ingredients) ? parsed.ingredients : [];
    return {
      ingredients: ingredients
        .map((item) => {
          if (typeof item === "string") {
            return {
              name: item.trim(),
              quantity: "",
            };
          }

          return {
            name: String(item?.name || "").trim(),
            quantity: String(item?.quantity || "").trim(),
          };
        })
        .filter((item) => item.name),
    };
  } catch {
    return null;
  }
};

const fallbackIngredientParse = (output) => {
  const ingredients = String(output || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const cleaned = line.replace(/^[-*]\s*/, "").trim();
      const withQty = cleaned.match(/^([0-9/.,]+\s+\w+|\d+\s*\w*|\w+\s+\d+)\s+(.+)$/i);

      if (withQty) {
        return {
          quantity: withQty[1].trim(),
          name: withQty[2].trim(),
        };
      }

      return {
        quantity: "",
        name: cleaned,
      };
    })
    .filter((item) => item.name && !item.name.startsWith("{") && !item.name.includes('"ingredients"'));

  return { ingredients };
};

export async function extractIngredients(text) {
  try {
    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        {
          role: "system",
          content: `
Extract ingredients and quantities from recipe text.

Return ONLY JSON in this format:

{
 "ingredients":[
   {"name":"ingredient","quantity":"amount"}
 ]
}

No explanation.
No markdown.
`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 200,
      temperature: 0.1
    });

    const output = response.choices[0].message.content;
    const parsed = parseIngredientsJson(output);
    if (parsed) {
      return parsed;
    }

    return fallbackIngredientParse(output);

  } catch (err) {
    console.error("AI Error:", err);

    return {
      ingredients: []
    };
  }
}

export async function translateText(text, language) {
  try {
    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        {
          role: "system",
          content: "Translate user text to the requested language. Return only translated text.",
        },
        {
          role: "user",
          content: `Target language: ${language}\nText: ${text}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    return response.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("Translate Error:", err);
    return "";
  }
}

export async function extractIngredientsFromImage(imageBuffer) {
  try {
    const caption = await hf.imageToText({
      data: imageBuffer,
      model: "Salesforce/blip-image-captioning-large",
    });

    const text = String(caption?.generated_text || caption?.text || "").trim();
    if (!text) {
      return { ingredients: [] };
    }

    return await extractIngredients(
      `Identify only the visible raw food ingredients from this photo caption and ignore plates, bowls, and background objects: ${text}`
    );
  } catch (err) {
    console.error("Image ingredient extraction error:", err);
    return { ingredients: [] };
  }
}

export async function parseRecipeText(text) {
  try {
    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        {
          role: "system",
          content: `Extract recipe info from user text and return ONLY JSON:
{
  "title": "string",
  "ingredients": ["item1", "item2"],
  "steps": ["step1", "step2"]
}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 600,
      temperature: 0.2,
    });

    const output = response.choices?.[0]?.message?.content || "";
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: String(parsed?.title || "").trim(),
        ingredients: Array.isArray(parsed?.ingredients) ? parsed.ingredients.map((x) => String(x).trim()).filter(Boolean) : [],
        steps: Array.isArray(parsed?.steps) ? parsed.steps.map((x) => String(x).trim()).filter(Boolean) : [],
      };
    }
  } catch (err) {
    console.error("Parse recipe error:", err);
  }

  const chunks = String(text || "")
    .split(/[.\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    title: "Quick Recipe",
    ingredients: chunks.slice(0, 8),
    steps: chunks.slice(0, 6),
  };
}

const parseRecipeGenerationJson = (output) => {
  const jsonMatch = String(output || "").match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const title = String(parsed?.title || "").trim();
    const description = String(parsed?.description || "").trim();
    const cookingTime = String(parsed?.cookingTime || "").trim();
    const servings = String(parsed?.servings || "").trim();
    const dietaryCategory = String(parsed?.dietaryCategory || "").trim();
    const tags = Array.isArray(parsed?.tags)
      ? parsed.tags.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const ingredients = Array.isArray(parsed?.ingredients)
      ? parsed.ingredients.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (!ingredients.length || !steps.length) {
      return null;
    }

    return {
      title: title || "Cooksy AI Recipe Suggestion",
      description,
      cookingTime: cookingTime || "30 min",
      servings: servings || "2",
      dietaryCategory: dietaryCategory || "Any",
      tags,
      ingredients,
      steps,
    };
  } catch {
    return null;
  }
};

export async function generateRecipeFromIngredients({
  ingredients = [],
  time = "30 min",
  diet = "Any",
  title = "Cooksy AI Recipe Suggestion",
  servings = "2",
}) {
  const cleanIngredients = Array.isArray(ingredients)
    ? ingredients.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!cleanIngredients.length) {
    return {
      title,
      description: "",
      cookingTime: time,
      servings,
      dietaryCategory: diet,
      tags: [],
      ingredients: [],
      steps: [],
    };
  }

  try {
    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        {
          role: "system",
          content: `You are a recipe generator.
Return ONLY valid JSON in this exact format:
{
  "title": "string",
  "description": "2 sentence recipe summary",
  "cookingTime": "string",
  "servings": "string",
  "dietaryCategory": "string",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2", "step 3"],
  "tags": ["tag1", "tag2"]
}

Rules:
- Build a practical recipe from the provided ingredients.
- Keep ingredient names clean and human readable.
- Steps must be specific, not generic.
- Do not include markdown.
- Do not include commentary outside JSON.`,
        },
        {
          role: "user",
          content: `Available ingredients: ${cleanIngredients.join(", ")}
Preferred cooking time: ${time}
Diet: ${diet}
Servings: ${servings}
Requested title: ${title}`,
        },
      ],
      max_tokens: 700,
      temperature: 0.5,
    });

    const output = response.choices?.[0]?.message?.content || "";
    const parsed = parseRecipeGenerationJson(output);
    if (parsed) {
      return parsed;
    }
  } catch (err) {
    console.error("Generate recipe error:", err);
  }

  const baseTitle = cleanIngredients.slice(0, 2).join(" and ");
  return {
    title: title || `${baseTitle || "Cooksy"} Recipe`,
    description: `A home-style ${diet.toLowerCase()} recipe built around ${cleanIngredients.slice(0, 4).join(", ")}.`,
    cookingTime: time,
    servings,
    dietaryCategory: diet,
    tags: ["ai-generated", cleanIngredients[0] || "home-cooking"].filter(Boolean),
    ingredients: cleanIngredients,
    steps: [
      `Prep ${cleanIngredients.slice(0, 4).join(", ")} and keep the remaining ingredients ready.`,
      `Heat oil in a pan, start with the aromatics, then cook ${cleanIngredients.slice(0, 2).join(" and ")} until lightly browned.`,
      "Add spices and the remaining ingredients in stages, stirring well so the flavors build instead of steaming together.",
      `Cook on medium heat until everything is tender and cohesive, then adjust seasoning and serve warm for ${servings} people.`,
    ],
  };
}
