const { GoogleGenAI } = require("@google/genai");
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json(
        {
            status: "ok",
            message: "Prompt-to-app backend is running",
        }
    );
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    console.log("Received prompt:", prompt);

    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: prompt,
    });

    console.log("Gemini response received!");

    res.json({
      success: true,
      response: interaction.output_text,
    });

  } catch (error) {
    console.error("Gemini error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

