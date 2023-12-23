import Strategy from "./Strategy";
import Heuristic from "../tactics/Heuristic";
import Tactic from "../tactics/Tactic";
import Vector from "../tactics/Vector";
import { VectorStore } from "langchain/vectorstores/base";
import { OpenAIApi } from "openai";
import OpenAI from "../tactics/OpenAI";

export default class StandardStrategy implements Strategy {
  public tactics: Tactic[];
  
  constructor(vectorStore: VectorStore, openai: OpenAIApi, model: string) {
    const heuristicScoreThreshold = 0.75;
    const vectorScoreThreshold = 0.9;
    const openaiScoreThreshold = 0.9;
    this.tactics = [
      new Heuristic(heuristicScoreThreshold),
      new Vector(vectorScoreThreshold, vectorStore),
      new OpenAI(openaiScoreThreshold, model, openai),
    ];
  }

}
