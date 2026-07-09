import 'dotenv/config';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {OpenAIEmbeddings} from '@langchain/openai'
import {QdrantVectorStore} from '@langchain/qdrant'



async function indexPDF(filePath) {

  //! Load the PDF Content as document Using Langchain
  const loader = new PDFLoader(filePath);

  //! Parse the PDF and return an array of Document objects (one per page by default)
  const document = await loader.load();

  //! Initialize the embedding model that converts text into vector embeddings
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

  //! Generate embeddings for each document and store them in the Qdrant collection
  await vectorStore.addDocuments(document)

  console.log(`All the documents are Indexed ...................`)
}

indexPDF('./software.pdf')