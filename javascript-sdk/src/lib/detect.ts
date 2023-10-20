
import { OpenAIApi } from "openai";
import { RebuffError } from "../interface";

export async function callOpenAiToDetectPI(
  promptToDetectPiUsingOpenAI: string,
  openai: OpenAIApi,
  model = "gpt-3.5-turbo"
): Promise<{ completion: string; error?: string }> {
  try {
    const completion = await openai.createChatCompletion({
      model,
      messages: [{ role: "user", content: promptToDetectPiUsingOpenAI }],
    });

    if (completion.data.choices[0].message === undefined) {
      console.log("completion.data.choices[0].message is undefined");
      return { completion: "", error: "server_error" };
    }

    if (completion.data.choices.length === 0) {
      console.log("completion.data.choices.length === 0");
      return { completion: "", error: "server_error" };
    }

    return {
      completion: completion.data.choices[0].message.content || "",
      error: undefined,
    };
  } catch (error) {
    console.error("Error in callOpenAiToDetectPI:", error);
    return { completion: "", error: "server_error" };
  }
}
