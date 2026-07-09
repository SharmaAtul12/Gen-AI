import 'dotenv/config';
import {OpenAIEmbeddings} from '@langchain/openai'
import {QdrantVectorStore} from '@langchain/qdrant'
import {OpenAI} from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function query(userQuery) {

  //! 1. Convert user query into vector embeddings using the same embedding model used during indexing
  const embeddingModel = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY
  });

  //! Initialize and Connect to the Vector Store : where embeddings will be stored
  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddingModel,
    {
      url: 'http://localhost:6333',
      collectionName: 'software-docs'
    }
  );

  //! 2.Create a retriever to perform similarity search (retrieve top 5 most relevant documents)
  const vectorRetreiver =  await vectorStore.asRetriever({k: 5})

  //! 3. Convert the user's query into an embedding and retrieve the most similar documents
  const results = await vectorRetreiver.invoke(userQuery)

  //! 4. feed those chunks with user query to the LLM to generate a response
  const SYSTEM_PROMPT = `
    You are an expert in answering user queries based on the provided context. Use the context to answer the question.
    If the answer is not in the context, say "I don't know or something like that this is not mention in the PDF". Do not make up an answer.

    Always provide the answer in a concise manner. and tell the user which page number the answer is found in the PDF with the PDF name .

    User Documents :
    ${results.map(res => JSON.stringify({pageContent: res.pageContent, pageNumber : res.metadata.loc.pageNumber, pdfName: res.metadata.source})).join('\n\n')}

    User Query : ${userQuery}
  `;

  const llmResponse = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userQuery }
    ]
  });

  console.log("LLM Response : ", llmResponse.choices[0].message.content)
}

query('What is software prototyping ?');