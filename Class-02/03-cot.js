import "dotenv/config";
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chain of thought prompting
const SYSTEM_PROMPT = `
  You are an expert AI Engineer. you have to analyze the user's input carefully and then you need to breakdown the problem into multiple 
  sub problems before coming to the final result. always breakdown the users intention and how to solve that problem and then step by step 
  solves it .

  We are going to follow a pipeline of "INITIAL", "THINK", "ANALYZE" and "OUTPUT" pipeline

  The Pipeline is as follows:
  - "INITIAL": When user gives you a input , we will have a initial thought process on what this user is trying to achieve and what is the problem statement .
  - "THINK": this is where we are going to think about how to solve the problem and start to breakdown the problem into multiple sub problems . 
      and then we will solve each sub problem one by one and then combine the results to get the final output.
  - "ANALYZE": this is where we will analyze the solution and also verify that the output is correct . 
  - "THINK": we can go back to the "THINK" step where we now see if any sub  remains and think
  - "ANALYZE": again analysis the problem and get onto a solution.
  - "OUTPUT": this is where we will give the final output to the user and also explain how we got to the final output.

  Rules : 
  - Always output one step at a time and wait for the next step to be called.
  - Always maintain the sequence of the pipeline as given in example
  -  Always follow JSON output format strictly . 

  Example: 
  - "USER" : What is 2 + 2 - 5 * 10 / 3 ?
  OUTPUT:
  - "INITIAL": The user is asking for a mathematical expression to be evaluated. The expression is 2 + 2 - 5 * 10 / 3.
  - "THINK": "To solve this expression, I will use the bodmas formula and based on that i should multiply 5 * 10 which is 50"
  - "ANALYZE": "Yes the bodmas is actually correct and now equation is 2 + 2 - 50 / 3"
  - "THINK": "Now as per bodmas we should divide 50 / 3 which is 16.666666666666668"
  - "ANALYZE": "Yes the bodmas is actually correct and now equation is 2 + 2 - 16.666666666666668"
  - "THINK": "Now as per bodmas we should add 2 + 2 which is 4 and new equation is 4 - 16.666666666666668"
  - "ANALYZE": "Yes the bodmas is actually correct and now just do the final step which is 4 - 16.666666666666668"
  - "THINK": "Now as per bodmas we should subtract 4 - 16.666666666666668 which is -12.666666666666668"
  - "OUTPUT": "The final output is -12.666666666666668"

  Output Format:
  {"step": "THINK" | "ANALYZE" | "OUTPUT" | "INITIAL,
  "text": "<The Actual text>"
  }

`;

const MESSAGES_DB = [{ role: "system", content: SYSTEM_PROMPT }];

async function run(prompt = "") {
  MESSAGES_DB.push({ role: "user", content: prompt });

  while (true) {
    const result = await client.chat.completions.create({
      model: "gpt-4",
      messages: MESSAGES_DB,
    });

    // rawResult is JSON as We told LLM to give us the output in JSON format
    const rawResult = result.choices[0].message.content;

    // Converting Raw Json into JS Object
    const parsedResult = JSON.parse(rawResult);

    // Har ek step ka result ko MESSAGES_DB me push karna h taki agle step me model ko ye mile ki humne kya bola tha
    MESSAGES_DB.push({ role: "assistant", content: rawResult });

    console.log(`🤖 (${parsedResult.step}) : ${parsedResult.text}`);

    if (parsedResult.step.toUpperCase() === "THINK") {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("⚠️ Skipping Claude validation because ANTHROPIC_API_KEY is not set.");
      } else {
        const validationPrompt = `Review the following reasoning and decide whether it is logically sound. Respond with a short JSON object in this exact format: {"isCorrect": true|false, "feedback": "..."}\n\nReasoning:\n${parsedResult.text}`;

        const validationResult = await claude.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 256,
          messages: [{ role: "user", content: validationPrompt }],
        });

        const validationText = validationResult.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        MESSAGES_DB.push({ role: "assistant", content: `Claude validation: ${validationText}` });
        console.log(`🧠 Claude validation: ${validationText}`);
      }
    }

    if (parsedResult.step.toUpperCase() === "OUTPUT") break;
  }
}

run("What is meaning of Life ?");
