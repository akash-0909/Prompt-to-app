import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System prompt instructing Gemini to return structural project steps
const SYSTEM_INSTRUCTION = `
You are an expert AI developer workspace assistant.
When a user asks to generate or update a web application, break down the project into explicit files and shell commands.

Return your response strictly wrapped inside the following XML tag format:

<project>
  <file path="src/App.jsx">
    <![CDATA[
    // File content here
    ]]>
  </file>
  <file path="package.json">
    <![CDATA[
    // Package.json content here
    ]]>
  </file>
  <command>
    npm install
  </command>
</project>

Rules:
1. Always return a complete, runnable React application styled with Tailwind CSS.
2. Ensure file paths are relative to the project root.
3. Keep external dependencies minimal so WebContainers can install them quickly.
`;

// Route to generate app files based on user prompt
router.post('/chat', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to generate code with Gemini API.' });
  }
});

export default router;