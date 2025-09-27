import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config'; // Make sure to install dotenv: npm install dotenv

// Get your API key from the .env file
const genAI = new GoogleGenerativeAI("AIzaSyBnxTj0FVXdLmqOiPH3adn1M_5GsVmlejA");

async function runTest() {
    try {
        // Get a specific model (e.g., the latest flash model)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = "Write a short, encouraging message for a developer who is learning to use APIs.";

        console.log("Sending a test prompt to the Gemini API...");
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log("✅ Success! API Response:");
        console.log(text);

    } catch (error) {
        console.error("❌ Error testing the API key:", error);
    }
}

runTest();