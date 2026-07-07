import "dotenv/config";

import {OpenAI} from "openai"

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY
});

// Completions API , which is deprecated now . 
client.chat.completions.create({
  model: "gpt-4",
  messages: [{role: 'user', content: "hello , how are you ?"}]
}).then((response) => {
  console.log(response.choices[0].message.content)
});