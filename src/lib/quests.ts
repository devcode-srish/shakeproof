import { keccak256, toUtf8Bytes } from "ethers";

const DECK = [
  "What's the weirdest thing you've ever shipped (code, product or meme)? One line each.",
  "Pitch each other a hackathon idea in 10 words. Which one would you actually build?",
  "What tab is open in your browser right now that you're slightly embarrassed by?",
  "Name one tool you can't live without and one you secretly hate using.",
  "If your wallet history were a movie, what's the genre?",
  "What's the best bug you've ever caused? Swap stories.",
  "Teach each other one keyboard shortcut or trick the other doesn't know.",
  "What are you building right now, and what is the one thing blocking you?",
  "Describe your ideal weekend hack project in exactly 3 words each.",
  "Which blockchain myth do you wish people would stop repeating?",
  "What's your go-to snack for a 3 a.m. debugging session?",
  "Share a skill you have that has nothing to do with tech.",
  "What's the most useful thing someone taught you at a hackathon?",
  "If you could add one feature to the city you're in right now, what would it be?",
  "What's one thing you want to learn this month? Find out if the other can help.",
  "Rate your current sleep level from 'rested' to 'goblin mode' and explain.",
  "What did you want to be at age 10, and how off were you?",
  "Which app deserves a redesign the most, and what's your one-line fix?",
  "What's your hot take on tabs vs spaces (or something spicier)?",
  "Introduce each other to a song/podcast/channel that gets you into flow.",
];

export type Quest = { prompt: string; id: string };

export function questId(prompt: string): string {
  return keccak256(toUtf8Bytes(prompt));
}

function pickFromDeck(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return DECK[Math.abs(h) % DECK.length];
}

async function generateWithClaude(): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content:
              "Write ONE short, fun icebreaker challenge (max 25 words) for two developers who just met at a hackathon. It must be answerable in one line by each person. Output only the challenge text.",
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text || text.length > 220) return null;
    return text.replace(/^["']|["']$/g, "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Claude-generated when ANTHROPIC_API_KEY is set, curated deck otherwise. */
export async function createQuest(seed: string): Promise<Quest> {
  const prompt = (await generateWithClaude()) ?? pickFromDeck(seed);
  return { prompt, id: questId(prompt) };
}
