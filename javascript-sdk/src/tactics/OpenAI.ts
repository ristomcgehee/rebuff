import { VectorStore } from "langchain/vectorstores/base";
import { RebuffError, TacticResult } from "../interface";
import TacticClass from "./TacticClass";
import { OpenAIApi } from "openai";
import { renderPromptForPiDetection } from "../lib/prompts";


export default class OpenAI extends TacticClass {
  private openai: OpenAIApi;
  private model: string;
  public name: string;

  constructor(threshold: number, openai: OpenAIApi, model: string) {
    super(threshold);
    this.openai = openai;
    this.model = model;
    this.name = "openai_" + model.replaceAll("-", "_");
  }

  async execute(input: string): Promise<TacticResult> {
    try {
      const completion = await this.openai.createChatCompletion({
        model: this.model,
        messages: [{ role: "user", content: renderPromptForPiDetection(input) }],
      });
  
      if (completion.data.choices.length === 0) {
        throw new Error("completion.data.choices.length === 0");
      }
      if (completion.data.choices[0].message === undefined) {
        throw new Error("completion.data.choices[0].message is undefined");
      }

      // FIXME: Handle when parseFloat returns NaN.
      const score = parseFloat(completion.data.choices[0].message.content || "");
      return this.getResult(score);
    } catch (error) {
      console.error("Error in callOpenAiToDetectPI:", error);
      throw new RebuffError("Error in getting score for large language model");
    }
  }
}