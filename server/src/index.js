const express =require('express');
const cors = require('cors');
require('dotenv').config();

const app=express();
app.use(cors());
app.use(express.json());

app.get("/api/health",(req,res)=>{
    res.json(
        {
            status:"ok",
            message:"Prompt-to-app backend is running",
        }
    );
});

app.post("/api/generate", (req, res) => {
  const { prompt } = req.body;

  console.log("Received prompt:", prompt);

  res.json({
    success: true,
    message: "Prompt received successfully",
    prompt: prompt,
  });
});

const PORT=process.env.PORT || 5000;

app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});

