import { TacticResult } from "../interface";

export default abstract class Tactic {
    abstract name: string;

    private threshold: number;

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
