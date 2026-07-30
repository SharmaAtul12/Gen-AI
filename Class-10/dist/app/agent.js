import { HARNESS_PROMPT } from "./config.js";
export class AgentBuilder {
    instructions;
    toolList;
    constructor() {
        this.toolList = [];
    }
    setInstructions(instructions) {
        this.instructions = instructions;
        return this;
    }
    tool(t) {
        this.toolList.push(t);
        return this;
    }
    build() {
        return new Agent(this);
    }
}
export class Agent {
    instructions;
    messageHistory;
    toolMap;
    constructor(builder) {
        this.toolMap = new Map();
        for (const t of builder.toolList) {
            this.toolMap.set(t.name, t);
        }
        this.instructions =
            `
      ${HARNESS_PROMPT} \n\n

      System Prompt : 
      ${builder.instructions}

      Available Tools :
      ${builder.toolList.map(t => JSON.stringify({
                functionName: t.name,
                functionDescription: t.description,
                functionDoc: t.doc
            })).join("/n")}
      
    `;
        this.messageHistory = [];
    }
    static builder() {
        return new AgentBuilder();
    }
    printSystemPrompt() {
        console.log("Final System Prompt : ", this.instructions);
    }
    async run(query) {
        console.log(`This is the function to run Agent with Query :`, query);
    }
}
