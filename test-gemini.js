import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No API key");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testMode(model) {
    try {
        console.log(`Testing model: ${model}`);
        const response = await ai.models.generateContent({
            model: model,
            contents: "Say hello",
        });
        console.log(`Success ${model}:`, response.text);
    } catch (e) {
        console.error(`Error ${model}:`, e.message);
    }
}

async function main() {
    await testMode("gemini-3.1-flash-lite-preview");
    await testMode("gemini-3-flash-preview");
    await testMode("gemini-3.1-pro-preview");
    await testMode("gemini-flash-latest");
}

main();
