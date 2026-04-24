import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// adjective-noun-NN codes. Teen-friendly; feels better than alphanumeric.
const ADJECTIVES = [
  "cosmic", "funky", "zesty", "neon", "wild", "sneaky", "chill", "cozy",
  "spicy", "dreamy", "sparkly", "groovy", "sunny", "mellow", "jazzy",
  "quirky", "silky", "mystic", "lucky", "breezy", "glitchy", "toasty",
  "snazzy", "moody", "vibey", "retro", "fluffy", "punchy", "sleepy",
  "zippy",
];
const NOUNS = [
  "pizza", "taco", "waffle", "bagel", "donut", "mango", "melon", "sushi",
  "nacho", "cupcake", "panda", "sloth", "otter", "tiger", "dragon", "whale",
  "fox", "owl", "koala", "axolotl", "comet", "rocket", "planet", "moon",
  "nebula", "orbit", "wave", "aurora", "mountain", "forest", "river",
  "cactus", "piano", "guitar", "ukulele", "bonsai", "cloud", "ember",
  "phoenix", "tundra",
];

export function generateCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${adj}-${noun}-${num}`;
}
