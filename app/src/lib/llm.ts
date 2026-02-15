import OpenAI from "openai";

const provider = process.env.LLM_PROVIDER || "openai";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function callGodMode(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (provider === "openai") {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });
    return response.choices[0].message.content || "";
  }

  // TODO: Anthropic provider (Opus 4.6)
  throw new Error(`Provider "${provider}" not yet implemented`);
}

export async function callAgentBrain(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (provider === "openai") {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.9,
      max_tokens: 1024,
    });
    return response.choices[0].message.content || "";
  }

  throw new Error(`Provider "${provider}" not yet implemented`);
}
