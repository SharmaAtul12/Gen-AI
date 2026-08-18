import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "my-app" });

// My Functions -> 
const helloAgentFunction = inngest.createFunction(
  {
    id: "hello-agent",
    triggers: [{event: 'chai/hello.agent'}],
  },
  async function ({step,event}) {

    await step.run('collect-user-input', async () => {
      console.log("I am running and collecting user input");
      return {name: "Atul", lastname: "Sharma"}
    });

    await step.sleep('wait-for-research', '5s');

    await step.run('notification-agent', async () => {
      console.log("This Is the notification agent that will send a notification to the user");
      const zeroOrOne = Math.random() < 0.5 ? 0 : 1;
      if(zeroOrOne === 0) throw new Error("Something went wrong in the notification agent");
      console.log("Notification sent successfully");
      return {emailAck: true}
    })
  }

)


export const functions = [helloAgentFunction];