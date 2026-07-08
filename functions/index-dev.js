// =================================================================
// DEVELOPMENT VERSION - functions/index-dev.js
// This version uses a direct API key for local development
// =================================================================

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const axios = require("axios");

// Initialize Firebase Admin
initializeApp();

// Direct API key for development (NOT for production)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "your_gemini_api_key_here";

// Define the Cloud Function
exports.analyzeIncident = onDocumentCreated(
    {
        document: "incidents/{incidentId}",
        region: "us-central1",
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            console.log("No data associated with the event. Exiting.");
            return;
        }

        const newIncident = snapshot.data();
        const incidentText = newIncident.text;

        // Use Gemini 1.5 Flash model
        const model = "gemini-2.0-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        // AI prompt for incident analysis
        const prompt = `You are PulseAI, a city management assistant. Analyze the following citizen report: "${incidentText}". Respond in a strict JSON format with no extra text, comments, or markdown ticks before or after the JSON object. The JSON must have "summary" (string), "category" (string from 'Traffic', 'Power Outage', 'Water Issue', 'Public Unrest', 'Infrastructure', 'Other'), and "severity" (number from 1-5). Severity scale: 1=Low, 2=Medium, 3=High, 4=Critical, 5=Emergency. Example: { "summary": "Flooding on Main St.", "category": "Water Issue", "severity": 4 }`;

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        try {
            console.log("Making API call to Gemini...");
            const response = await axios.post(url, requestBody);

            const aiResponseText = response.data.candidates[0].content.parts[0].text;
            console.log("Received raw response:", aiResponseText);

            // Clean up the response to ensure it's valid JSON
            const cleanedResponse = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanedResponse);

            console.log("Successfully parsed AI analysis:", aiData);
            return snapshot.ref.set({ aiAnalysis: aiData }, { merge: true });

        } catch (error) {
            console.error("Error during AI analysis:", error);
            if (error.response) {
                console.error("API Error:", error.response.status, error.response.data);
            }
            return snapshot.ref.set({ 
                aiAnalysis: { 
                    error: "Failed to analyze incident. Please try again." 
                } 
            }, { merge: true });
        }
    }
);
