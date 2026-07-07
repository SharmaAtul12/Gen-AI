import 'dotenv/config';
import {GoogleGenAI} from '@google/genai';

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function init() {
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Hello , How are you gemini ?'
  });

  console.log(response.text)
}

init();
