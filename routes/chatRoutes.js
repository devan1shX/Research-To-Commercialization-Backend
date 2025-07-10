const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const Study = require("../models/study");
const { verifyFirebaseToken } = require("../middleware/auth");
const { logChatHistory } = require('../utils/logger'); 

const router = express.Router();

router.post("/chat-with-paper", verifyFirebaseToken, async (req, res) => {
    const { prompt, studyId, chatHistory } = req.body;
    const user = req.user; 

    if (!prompt || !studyId) {
        return res
            .status(400)
            .json({ message: "Prompt and studyId are required." });
    }

    try {
        const study = await Study.findById(studyId);
        if (!study) {
            return res.status(404).json({ message: "Study not found." });
        }

        const scriptDir = path.resolve(
            __dirname,
            "..", 
            "..", 
            "TechTransfer_Chatbot-Image_Worthiness_Removed"
        );
        const pythonScriptPath = path.join(scriptDir, "live_chat_handler.py");

        if (!fs.existsSync(pythonScriptPath)) {
            console.error("Chatbot script not found at:", pythonScriptPath);
            return res.status(500).json({ message: "Chatbot script not found on the server." });
        }

        const pythonProcess = spawn("python", [
            pythonScriptPath,
            "--prompt",
            prompt,
            "--thesis_text",
            study.abstract, 
            "--chat_history",
            JSON.stringify(chatHistory || []), 
        ]);

        let responseData = "";
        let errorData = "";

        pythonProcess.stdout.on("data", (data) => {
            responseData += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            console.error(`[Python Script STDERR]: ${data.toString()}`);
            errorData += data.toString();
        });

        pythonProcess.on("close", (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}. Error: ${errorData}`);
                return res
                    .status(500)
                    .json({
                        message: "An error occurred in the chatbot script.",
                        error: errorData
                    });
            }
            
            try {
                const jsonMatch = responseData.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No valid JSON object found in the script's output.");
                }

                const parsedData = JSON.parse(jsonMatch[0]);
                
                const fullChatHistory = [
                    ...(chatHistory || []),
                    { sender: 'user', text: prompt, timestamp: new Date().toLocaleTimeString() },
                    { sender: 'bot', text: parsedData.instant_answer, timestamp: new Date().toLocaleTimeString() }
                ];
                logChatHistory(user, studyId, fullChatHistory);

                res.json(parsedData);

            } catch (e) {
                console.error("Failed to parse JSON from Python script. Raw response was:", responseData);
                res
                    .status(500)
                    .json({ 
                        message: "Failed to parse the response from the chatbot script.",
                        rawResponse: responseData 
                    });
            }
        });

    } catch (error) {
        console.error("Server error in /chat-with-paper route:", error);
        res
            .status(500)
            .json({ message: `An unexpected server error occurred: ${error.message}` });
    }
});

module.exports = router;