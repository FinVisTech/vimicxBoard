import OpenAI from "openai";

export type LlmMessage = {
  role: "system" | "user";
  content: string;
};

export interface LlmClient {
  completeJson(messages: LlmMessage[]): Promise<unknown>;
}

export class OpenAiLlmClient implements LlmClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async completeJson(messages: LlmMessage[]) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await this.client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("LLM returned an empty response");
    }

    return JSON.parse(content);
  }
}

export function getLlmClient(): LlmClient {
  return new OpenAiLlmClient();
}
