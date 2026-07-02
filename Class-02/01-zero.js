import "dotenv/config";
import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

async function run() {
  const result = await client.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: 'You are an expert tell me what is 2 + 2 ?' }],
  });
  console.log("OpenAI Response : ", result.choices[0].message.content);
}

run();
