import { VectorStore } from "langchain/vectorstores/base";
import { RebuffError } from "../interface";
import Tactic, { TacticResult } from "./tactic";


export default class Vector implements Tactic {
  name = "vector";

  private vectorStore: VectorStore;
  private similarityThreshold: number;

  constructor(vectorStore: VectorStore, similarityThreshold: number) {
    this.vectorStore = vectorStore;
    this.similarityThreshold = similarityThreshold;
  }

  async execute(input: string): Promise<TacticResult> {
    try {
      const topK = 20;
      const results = await this.vectorStore.similaritySearchWithScore(input, topK);
  
      let topScore = 0;
      let countOverMaxVectorScore = 0;
  
      for (const [_, score] of results) {
        if (score == undefined) {
          continue;
        }
  
        if (score > topScore) {
          topScore = score;
        }
  
        if (score >= this.similarityThreshold && score > topScore) {
          countOverMaxVectorScore++;
        }
      }
  
      return { score: topScore, extraFields: { countOverMaxVectorScore } };
    } catch (error) {
      throw new RebuffError(`Error in getting score for vector tactic: ${error}`);
    }
  }
}