import { GoogleGenAI } from "@google/genai";
async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // Changed back to correct model
        contents: "test",
        config: {
          responseMimeType: "application/json"
        }
      });
    console.log(response.text);
  } catch (e) {
    console.error(e);
  }
}
test();
