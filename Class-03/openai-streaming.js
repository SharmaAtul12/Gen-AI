import 'dotenv/config'
import OpenAI from "openai";

const client = new OpenAI();

async function init() {
  const stream = await client.responses.create({
    model: 'gpt-4',
    stream: true,
    input : 'Hey , I am Atul . Describe yourself in 20 words'
  })

  for await (const event of stream) {
    if(event && event.delta) {
      process.stdout.write(event.delta)
    }
  }
}



init();