import Constants from "expo-constants";

type EnvValue = string | undefined;

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, EnvValue>;

export const getEnv = (key: string): EnvValue => {
  const processValue = process.env[key];
  if (processValue) return processValue;

  const extraValue = extra[key];
  if (typeof extraValue === "string" && extraValue.length > 0) {
    return extraValue;
  }

  return undefined;
};

export const requireEnv = (key: string): string => {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};
