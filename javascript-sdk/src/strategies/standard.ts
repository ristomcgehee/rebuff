import Strategy from "./strategy";
import Heuristic from "../tactics/heuristic";

export default class StandardStrategy implements Strategy {
  tactics = [
    {
      tactic: new Heuristic(),
      scoreThreshold: 0.75,
    },
  ];
}