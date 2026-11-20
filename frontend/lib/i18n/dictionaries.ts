import en from "./en.json";
import ar from "./ar.json";
import type { Locale } from "./config";

export const dictionaries: Record<Locale, Record<string, string>> = { en, ar };
