import "dotenv/config";
import { OpenAI } from "openai";
import axios from "axios";
import { exec } from "child_process";

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

const SYSTEM_PROMPT = `
  You are an expert AI Engineer. you have to analyze the user's input carefully and then you need to breakdown the problem into multiple 
  sub problems before coming to the final result. always breakdown the users intention and how to solve that problem and then step by step 
  solves it .

  We are going to follow a pipeline of "INITIAL", "THINK","TOOL_REQUEST", "ANALYZE" and "OUTPUT" pipeline

  The Pipeline is as follows:
  - "INITIAL": When user gives you a input , we will have a initial thought process on what this user is trying to achieve and what is the problem statement .
  - "THINK": this is where we are going to think about how to solve the problem and start to breakdown the problem into multiple sub problems . 
      and then we will solve each sub problem one by one and then combine the results to get the final output.
  - "ANALYZE": this is where we will analyze the solution and also verify that the output is correct . 
  - "THINK": we can go back to the "THINK" step where we now see if any sub  remains and think
  - "ANALYZE": again analysis the problem and get onto a solution.
  - "TOOL_REQUEST": Use this for calling or requesting a tool . the format of Output is
      {"step": "TOOL_REQUEST", "functionName" : "getWeatherData", "input": "Goa"}
  - "OUTPUT": this is where we will give the final output to the user and also explain how we got to the final output.

  Available Tools :
  - getWeatherData : this is a tool which takes city name as input and gives the weather data of that city as output.
  - executeCommandOnCli : this is the tool which can be used to execute any command on user's device . it takes command as input
      and return the output as stdout

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

  Example: 
  - "USER": What is the weather of Goa ?
  OUTPUT: 
    - ""INITIAL": "The user is asking for the weather of Goa. I will need to use a tool to get the weather data for Goa."
    - "THINK" : "from the tools i can see we have tool named getWeatherData which can be called"
    - "ANALYZE": "Yes the tool getWeatherData is actually correct and now we can call this tool with input Goa"
    - "TOOL_REQUEST": {"step": "TOOL_REQUEST", "functionName" : "getWeatherData", "input": "Goa"}
    - "TOOL_OUTPUT": "The weather in Goa is 40 degree celcius"
    - "THINK": "Now as per the tool output we can say that the weather in Goa is 40 degree celcius"
    - "OUTPUT": "The final output is The weather in Goa is 40 degree celcius"


  Output Format:
  {"step": "THINK" | "ANALYZE" | "OUTPUT" | "INITIAL" | "TOOL_REQUEST",
  "text": "<The Actual text>",
  "functionName": "NAME OF FUNCTION",
  "input": "INPUT PARAMS of the Function"
  }

`;

//! Tools

async function getWeatherData(cityName) {
  const url = `https://wttr.in/${cityName.toLowerCase()}?format=%C+%t`;
  const result = await axios.get(url, { responseType: "text" });
  return JSON.stringify({ cityName, weatherInfo: result.data });
}

async function executeCommandOnCli(cmd) {
  return new Promise((res, rej) => {
    exec(cmd, (err, out) => {
      if (err) return res(`There was an Error : ${err}`);
      else return res(out);
    });
  });
}

const MESSAGES_DB = [{ role: "system", content: SYSTEM_PROMPT }];

async function run(prompt = "") {
  MESSAGES_DB.push({ role: "user", content: prompt });

  while (true) {
    const result = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: MESSAGES_DB,
    });

    const rawResult = result.choices[0].message.content;

    const parsedResult = JSON.parse(rawResult);

    MESSAGES_DB.push({ role: "assistant", content: rawResult });

    console.log(`🤖 (${parsedResult.step}) : ${parsedResult.text}`);

    if (parsedResult.step.toUpperCase() === "OUTPUT") break;

    if (parsedResult.step.toUpperCase() === "TOOL_REQUEST") {
      const toolName = parsedResult.functionName;
      const toolInput = parsedResult.input;

      if (toolName === "getWeatherData") {
        try {
          const toolResult = await getWeatherData(toolInput);
          console.log(`⛏️ (${toolName}): ${toolInput},`, toolResult);
          MESSAGES_DB.push({
            role: "developer",
            content: JSON.stringify({
              step: "TOOL_OUTPUT",
              output: toolResult,
            }),
          });
        } catch (error) {
          MESSAGES_DB.push({
            role: "developer",
            content: JSON.stringify({
              status: `Error occurred while fetching weather data: ${error}`,
            }),
          });
        }
      }

      if (toolName === "executeCommandOnCli") {
        try {
          const toolResult = await executeCommandOnCli(toolInput);
          console.log(`⛏️ (${toolName}): ${toolInput},`, toolResult);
          MESSAGES_DB.push({
            role: "developer",
            content: JSON.stringify({
              step: "TOOL_OUTPUT",
              output: toolResult,
            }),
          });
        } catch (error) {
          MESSAGES_DB.push({
            role: "developer",
            content: JSON.stringify({
              status: `Error occurred while executing command: ${error}`,
            }),
          });
        }
      }
    }
  }
}

run(
  "What is the weather of Goa . and then write the output on a beautiful webpage . create a folder named weather and create all HTML and CSS files there and then run this on my browser",
);
