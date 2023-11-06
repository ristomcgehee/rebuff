import Tactic from "../tactics/Tactic";

export default interface Strategy {
  tactics: Tactic[];
}
