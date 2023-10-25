import { VectorStore } from "langchain/vectorstores/base";
import { RebuffError } from "../interface";
import Tactic, { TacticExecution } from "./Tactic";


export default class Vector implements Tactic {
  name = "vector";
  defaultThreshold: number;

  private vectorStore: VectorStore;

  constructor(threshold: number, vectorStore: VectorStore) {
    this.defaultThreshold = threshold;
    this.vectorStore = vectorStore;
  }

  async execute(input: string, thresholdOverride?: number): Promise<TacticExecution> {
    const threshold = thresholdOverride || this.defaultThreshold;
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
  
        if (score >= threshold && score > topScore) {
          countOverMaxVectorScore++;
        }
      }
  
      return { score: topScore, extraFields: { countOverMaxVectorScore } } as TacticExecution;
    } catch (error) {
      throw new RebuffError(`Error in getting score for vector tactic: ${error}`);
    }
  }
}