import dotenv from "dotenv";
import { HfInference } from "@huggingface/inference";

dotenv.config();

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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

    // Try to extract JSON
    const jsonMatch = output.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      } catch (err) {
        console.log("AI returned invalid JSON, using fallback parser");
      }
    }

    // ---------- Fallback parser ----------
    const ingredientLines = output.split("\n");

    const ingredients = ingredientLines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(" ");
        return {
          quantity: parts[0],
          name: parts.slice(1).join(" ")
        };
      });

    return { ingredients };

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
