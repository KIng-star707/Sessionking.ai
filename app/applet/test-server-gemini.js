const { GoogleGenAI } = require("@google/genai");

async function test() {
  try {
    let aiOptions = {};
    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (envKey && envKey.length > 5) {
       aiOptions.apiKey = envKey;
    }
    
    console.log("Key extracted:", envKey?.substring(0, 8), "Len:", envKey?.length);
    const ai = new GoogleGenAI(aiOptions);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hi",
      config: {}
    });
    console.log("Success", response.text);
  } catch (error) {
    console.error("Gemini error:", error);
  }
}
test();
