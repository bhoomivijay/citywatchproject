// =================================================================
// FINAL BYPASS CODE - functions/index.js
// This code uses a direct API call to Gemini, bypassing the
// problematic Vertex AI library.
// =================================================================

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const axios = require("axios"); // Library for making web requests
const {defineSecret} = require("firebase-functions/params");

// Initialize Firebase Admin so we can write back to the database
initializeApp();

// Load the secret API Key that we stored using the Firebase CLI
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// For development, you can also use a direct API key (not recommended for production)
// const geminiApiKey = "your_gemini_api_key_here";

// Define the Cloud Function
exports.analyzeIncident = onDocumentCreated(
    // Configuration object:
    {
        document: "incidents/{incidentId}", // Listen to the 'incidents' collection
        region: "us-central1",              // Run this function in the US datacenter
        secrets: [geminiApiKey],            // Give this function access to our secret key
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) {
            console.log("No data associated with the event. Exiting.");
            return;
        }

        const newIncident = snapshot.data();
        const incidentText = newIncident.text;

        // A standard, reliable model available through the direct API
        const model = "gemini-2.0-flash";

        // The URL for the Gemini API. We pass the model name and our secret key in the URL.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.value()}`;

        // The clear, detailed prompt for the AI
        const prompt = `You are PulseAI, a city management assistant. Analyze the following citizen report: "${incidentText}". Respond in a strict JSON format with no extra text, comments, or markdown ticks before or after the JSON object. The JSON must have "summary" (string), "category" (string from 'Traffic', 'Power Outage', 'Water Issue', 'Public Unrest', 'Infrastructure', 'Other'), and "severity" (number from 1-5). Severity scale: 1=Low, 2=Medium, 3=High, 4=Critical, 5=Emergency. Example: { "summary": "Flooding on Main St.", "category": "Water Issue", "severity": 4 }`;

        // The body of our web request
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        try {
            console.log("Making direct API call to Gemini...");
            const response = await axios.post(url, requestBody);

            // Extract the text from the AI's response
            const aiResponseText = response.data.candidates[0].content.parts[0].text;
            console.log("Received raw response:", aiResponseText);

            // Clean up the response to ensure it's valid JSON
            const cleanedResponse = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanedResponse);

            // Write the successful analysis back to the database
            console.log("Successfully parsed AI analysis:", aiData);
            return snapshot.ref.set({ aiAnalysis: aiData }, { merge: true });

        } catch (error) {
            // If anything goes wrong, log the detailed error and write an error message to the database
            if (error.response) {
                console.error("Critical API Error:", error.response.status, error.response.data);
            } else {
                console.error("Critical error during direct API call:", error.message);
            }
            return snapshot.ref.set({ aiAnalysis: { error: "Failed to analyze incident via direct API." } }, { merge: true });
        }
    }
);
