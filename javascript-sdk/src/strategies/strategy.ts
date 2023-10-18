import Tactic from "../tactics/tactic";

export default interface Strategy {
  tactics: {
    tactic: Tactic,
    scoreThreshold: number,
  }[]
}
