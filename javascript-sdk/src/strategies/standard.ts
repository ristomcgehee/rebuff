import Strategy from "./strategy";
import Heuristic from "../tactics/heuristic";
import Tactic from "../tactics/tactic";
import Vector from "../tactics/vector";
import { VectorStore } from "langchain/vectorstores/base";

export default class StandardStrategy implements Strategy {
  public tactics: Tactic[];
  
  constructor(vectorStore: VectorStore) {
    const heuristicScoreThreshold = 0.75;
    const vectorScoreThreshold = 0.9;
    this.tactics = [
      new Heuristic(heuristicScoreThreshold),
      new Vector(vectorStore, vectorScoreThreshold),
    ];
  }

}