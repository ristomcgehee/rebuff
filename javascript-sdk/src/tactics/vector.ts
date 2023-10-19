import { VectorStore } from "langchain/vectorstores/base";
import { RebuffError, TacticResult } from "../interface";
import Tactic from "./tactic";


export default class Vector extends Tactic {
  name = "vector";

  private vectorStore: VectorStore;

  constructor(threshold: number, vectorStore: VectorStore) {
    super(threshold);
    this.vectorStore = vectorStore;
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
  
        if (score >= this.threshold && score > topScore) {
          countOverMaxVectorScore++;
        }
      }
  
      return this.getResult(topScore, { countOverMaxVectorScore });
    } catch (error) {
      throw new RebuffError(`Error in getting score for vector tactic: ${error}`);
    }
  }
}