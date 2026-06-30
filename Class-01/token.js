import { get_encoding } from "tiktoken";

const encoderForGpt2 = get_encoding("gpt2");

//! Encoded Step 
const encoded = encoderForGpt2.encode("Hello , I am Atul");
console.log(encoded);

//! Decoded Step 
const decoded = encoderForGpt2.decode(encoded)
console.log(new TextDecoder().decode(decoded))


