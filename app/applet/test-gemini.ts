import { GoogleGenAI } from "@google/genai";
console.log("Key length:", process.env.GEMINI_API_KEY?.length);
const ai = new GoogleGenAI({});
ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Hello"
}).then(res => console.log(res.text)).catch(console.error);
