import { exec } from "child_process";
import { Agent } from "./app/agent.js";
import type { ITool } from "./app/agent.js";
import axios from "axios";

const weatherTool : ITool = {
  name: 'fetchWeatherInfo',
  description: 'Fetches real-time weather information by city name',
  doc: 'fetchWeatherInfo(cityName: string): weatherInfo',
  async executor (cityName) {
    const url = `https://wttr.in/${cityName.toLowerCase()}?format=%C+%t`;
    const result = await axios.get(url, { responseType: "text" });
    return JSON.stringify({ cityName, weatherInfo: result.data });
  }
}

const cliAccessTool: ITool = {
  name: 'executeCLICommand',
  description: 'Executes a command in the CLI and returns the output',
  doc: 'cliAccess(command: string): commandOutput',
  executor(cmd) {
    return new Promise((res,rej) => {
      exec(cmd, (err,out) => {
        if(err) return res(`Error executing command: ${err.message}`);
        else return res(out);
      })
    })
  }
}

async function init() {
  const agent: Agent = Agent.builder()
  .setInstructions(`You are an expert coding agent`)
  .tool(weatherTool)
  .tool(cliAccessTool)
  .build()

  const weatherAgent: Agent = Agent.builder()
  .setInstructions(`You are an expert coding agent`)
  .tool(weatherTool)
  .build()

  agent.attachInterceptor(message => console.log(`Message : ${message.role} ${message.content}`))
  weatherAgent.attachInterceptor(message => console.log(`Message : ${message.role} ${message.content}`))

  const result = await agent.run("Can you tell me the weather of Delhi")
  console.log(result![result?.length! - 1])
}

init();