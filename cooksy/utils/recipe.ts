export const extractMinutes = (cookingTime?: string) => {
  const raw = String(cookingTime || "");
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

export const getDifficulty = (ingredients: string[] = [], cookingTime?: string) => {
  const count = ingredients.length;
  const minutes = extractMinutes(cookingTime);

  if (count <= 4 && (minutes === 0 || minutes <= 20)) return "Easy";
  if (count <= 8 && (minutes === 0 || minutes <= 40)) return "Medium";
  return "Hard";
};
