import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process. env.GEMINI_API_KEY });

async function runTest() {
  console.log("Sending prompt to Gemini...\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Create a simple React counter component with increment and decrement buttons.",
      config: {
        systemInstruction: `You are an AI assistant that generates code files for web applications. 
Return your output structured as XML steps:
<project>
  <file path="src/App.jsx">
    [code here]
  </file>
</project>`,
      },
    });

    console.log("--- GEMINI RESPONSE ---");
    console.log(response.text);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
  }
}

runTest();
