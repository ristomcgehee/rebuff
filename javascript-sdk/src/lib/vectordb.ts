import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { VectorStore } from "langchain/vectorstores/base";
import { PineconeClient } from "@pinecone-database/pinecone";
import { createClient } from "@supabase/supabase-js";
import { SdkConfig } from "./config";


async function initPinecone(
  environment: string,
  apiKey: string,
  index: string,
  openaiEmbeddings: OpenAIEmbeddings,
): Promise<PineconeStore> {
  try {
    const pinecone = new PineconeClient();

    await pinecone.init({
      environment,
      apiKey,
    });
    const pineconeIndex = pinecone.Index(index);
    const vectorStore = await PineconeStore.fromExistingIndex(
      openaiEmbeddings,
      { pineconeIndex }
    );

    return vectorStore;
  } catch (error) {
    console.log("error", error);
    throw new Error("Failed to initialize Pinecone Client");
  }
}

async function initSupabase(
  serviceKey: string,
  url: string,
  openaiEmbeddings: OpenAIEmbeddings,
): Promise<SupabaseVectorStore> {
  try {
    const client = createClient(url, serviceKey);
    const vectorStore = new SupabaseVectorStore(openaiEmbeddings, {
      client,
      tableName: "documents",
    });

    return vectorStore;
  } catch (error) {
    console.log("error", error);
    throw new Error("Failed to initialize Supabase client");
  }
}

export default async function initVectorStore(
  config: SdkConfig
): Promise<VectorStore> {
  const openaiEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openai.apikey,
    modelName: "text-embedding-ada-002" 
  });
  const vectorStore = config.vectorStore ?? 'pinecone';
  switch (vectorStore) {
    case "pinecone":
      if (!config.pinecone?.environment) {
        throw new Error("Pinecone environment definition missing");
      }
      if (!config.pinecone?.apikey) {
        throw new Error("Pinecone apikey definition missing");
      }
      if (!config.pinecone?.index) {
        throw new Error("Pinecone index definition missing");
      }
      return await initPinecone(
        config.pinecone.environment,
        config.pinecone.apikey,
        config.pinecone.index,
        openaiEmbeddings
      );
    case "supabase":
      if (!config.supabase?.serviceKey) {
        throw new Error("Supabase service key definition missing");
      }
      if (!config.supabase?.url) {
        throw new Error("Supabase URL definition missing");
      }
      return await initSupabase(
        config.supabase.serviceKey,
        config.supabase.url,
        openaiEmbeddings
      );
    default:
      throw new Error("Unsupported vector store: " + config.vectorStore);
  }
}
