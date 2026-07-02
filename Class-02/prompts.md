# Prompting

## Types of Prompting

1. **Zero-shot prompting**  
	The model is given a task without any examples. It must generate an answer based solely on the prompt provided.

2. **Few-shot prompting**  
	The model is given a task along with a few examples of input-output pairs. It uses these examples to generate an answer for a new input. _(This influences the model.)_

3. **Chain-of-thought prompting**  
	This is a technique where the model is prompted to generate intermediate reasoning steps before producing a final answer. This can help improve the model's performance on complex tasks by allowing it to break down the problem into smaller, more manageable parts.

4. **Role-playing prompting**  
	In this approach, the model is prompted to assume a specific role or persona while generating responses. This can help guide the model's behavior and improve its performance on tasks that require a particular perspective or expertise.

## Example

You are an expert AI engineer. Only answer questions related to code and programming.
