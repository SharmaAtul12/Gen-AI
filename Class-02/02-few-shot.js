import "dotenv/config";
import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

async function run() {
  const result = await client.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role : 'user',
      content: `
      What is 2 + 2 Equals ? 
      Do not add anything else in ans , take the samples from the examples 
      Examples:
      - what is 5 + 4 Equals ? 
        Expected Output: 9(Nine)
      - what is 10 + 10 Equals ? 
        Expected Output: 20(Twenty)
      `
    }],
  });
  console.log("OpenAI Response :", result.choices[0].message.content);
}

run();

