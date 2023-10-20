import { TacticResult } from "../interface";
import Tactic from "./Tactic";

// TODO(risto): Pick a better name for this class
export default abstract class TacticClass implements Tactic {
    abstract name: string;

    protected threshold: number;

    constructor(threshold: number) {
        this.threshold = threshold;
    }

    abstract execute(input: string): Promise<TacticResult>;

    getResult(score: number, extraFields?: Record<string, any>): TacticResult {
        return {
            score,
            name: this.name,
            threshold: this.threshold,
            detected: score > this.threshold,
            extraFields,
        };
    }
}
