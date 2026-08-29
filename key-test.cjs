const { GoogleGenAI } = require("@google/genai");
console.log(process.env.GEMINI_API_KEY ? "key len " + process.env.GEMINI_API_KEY.length : "NO KEY");
