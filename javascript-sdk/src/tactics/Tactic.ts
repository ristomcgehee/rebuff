import { TacticResult } from "../interface";

export default interface Tactic {
    execute(input: string): Promise<TacticResult>;
}
