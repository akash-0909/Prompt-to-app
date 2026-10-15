const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Prompt-to-App backend is running",
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    console.log("Received prompt:", prompt);

    // Tell browser that this response is an SSE stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",

      config: {
        systemInstruction: `
You are an expert full-stack application generator.

Your task is to generate a complete web application
based on the user's request.

IMPORTANT RULES:

1. Return ONLY files.
2. Do NOT explain the code.
3. Do NOT use Markdown code fences.
4. Every file must use this exact format:

<file path="path/to/file">
FILE CONTENT
</file>

5. Generate all required files for the application.
6. Make the application runnable with npm.
7. Include package.json when dependencies are required.
8. Use valid file paths relative to the project root.

Example:

<file path="package.json">
{
  "scripts": {
    "dev": "vite --host 0.0.0.0"
  }
}
</file>

<file path="src/App.tsx">
export default function App() {
  return <h1>Hello</h1>;
}
</file>
`,
      },

      contents: prompt,
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;

      if (text) {
        res.write(`data: ${JSON.stringify(text)}\n\n`);
      }
    }

    // Tell frontend that generation is finished
    res.write(`data: [DONE]\n\n`);

    res.end();

    console.log("Gemini stream finished!");

  } catch (error) {
    console.error("Gemini error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: error.message,
        })}\n\n`
      );

      res.end();
    }
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});