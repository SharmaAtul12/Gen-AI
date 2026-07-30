import { HARNESS_PROMPT } from "./config.js";
import {OpenAI} from "openai"
import "dotenv/config"

export interface IMessage {
  role: "user" | "assistant" | "developer"
  content: string
}

export interface ITool {
  name : string
  description: string
  doc?: string
  executor: (input:string) => Promise<string>
}

export type Interceptor = (message: IMessage) => void

export class AgentBuilder {
  public instructions : string | undefined
  public toolList : ITool[]

  constructor() {
    this.toolList = []
  }

  public setInstructions(instructions: string) {
    this.instructions = instructions;
    return this
  }

  public tool(t : ITool) {
    this.toolList.push(t)
    return this
  }

  public build() {
    return new Agent(this)
  }
}


export class Agent {
  private instructions : string 
  private messageHistory : IMessage[]
  private toolMap: Map<string, ITool>
  private MAX_LOOPS = 30;
  private openai : OpenAI
  private interceptors: Interceptor[]
  
  constructor(builder:AgentBuilder) {
    this.toolMap = new Map();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.interceptors = []

    for(const t of builder.toolList) {
      this.toolMap.set(t.name, t)
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
      })).join("/n")
      }
      
    `
    this.messageHistory = []
  }

  static builder() {
    return new AgentBuilder()
  }

  public attachInterceptor (interceptor: Interceptor) {
    this.interceptors.push(interceptor)
  }

  //! Notify All Interceptors about a new message
  private notifyInterceptors(message: IMessage) {
    for(const inteceptor of this.interceptors) {
      inteceptor(message)
    }
  }

  public printSystemPrompt () {
    console.log("Final System Prompt : ", this.instructions)
  }

  public async run(query:string) {
    //! Append User Query To Message History
    this.messageHistory.push({role: 'user', content: query})

    for(let i = 0; i < this.MAX_LOOPS; i++) {

      //! LLM Response = Call LLM (SYSTEM_PROMPT + Message History)
      const llmResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {role: 'system', content: this.instructions},
          ...this.messageHistory.map((msg) => ({role: msg.role, content: msg.content}))
        ]
      })

      //! Append LLM Response To Message History
      const rawResponse: string = llmResponse.choices[0].message.content as string
      this.messageHistory.push({role: 'assistant', content: rawResponse})
      this.notifyInterceptors({role: 'assistant', content: rawResponse})

      //! Parse the rawLLM Response to JSON Object
      const parsedResult = JSON.parse(rawResponse)

      //! if LLMResponse.step === "OUTPUT" then break
      if(parsedResult.step.toLowerCase() === "output") {
        return this.messageHistory
      }

      //! if LLMResponse.step === "TOOL_REQUEST" 
      /**
       *  tool = ToolMap.find(LLMResponse.functionName)
       *  toolResult = toolExecutor(LLMResponse.input)
       *  append toolResult to messageHistory
       *  continue
       */

      if(parsedResult.step.toLowerCase() === "tool_request") {
        const {functionName, input} = parsedResult
        const tool = this.toolMap.get(functionName)

        if(!tool) {
          this.messageHistory.push({role: 'developer', content: `Error : function with name ${functionName} does not exist`})
          continue
        }

        const toolResult = await tool.executor(input)
        this.messageHistory.push({
          role: 'developer', 
          content: `Tool Result : ${JSON.stringify({
            functionName,
            input,
            toolResult
          })}`
        });

        this.notifyInterceptors({
          role: 'developer', 
          content: `Tool Result : ${JSON.stringify({
            functionName,
            input,
            toolResult
          })}`
        })
      }

    }
  }
}