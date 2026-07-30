import { Agent } from "./app/agent.js";
const weatherTool = {
    name: 'fetchWeatherInfo',
    description: 'Fetches real-time weather information by city name',
    doc: 'fetchWeatherInfo(cityName: string): weatherInfo',
    async executor() {
        return 'I am Weather Tool';
    }
};
async function init() {
    const agent = Agent.builder()
        .setInstructions(`You are an expert maths agent`)
        .tool(weatherTool)
        .build();
    agent.printSystemPrompt();
}
init();
