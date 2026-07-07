import 'dotenv/config'
import OpenAI from "openai";

const client = new OpenAI();

async function init() {
  const result = await client.responses.create({
    model: 'gpt-4',
    input : 'Hey , I am Atul'
  })

  console.log("Result :", result.output_text)
}



init();