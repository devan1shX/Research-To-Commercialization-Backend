const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const Study = require("../models/study");
const { verifyFirebaseToken } = require("../middleware/auth");

const router = express.Router();

router.post("/chat-with-paper", verifyFirebaseToken, async (req, res) => {
  const { prompt, studyId, chatHistory } = req.body;

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

    // Correctly resolve the path to the Python scripts directory
    const scriptDir = path.resolve(
      __dirname,
      "..", // Move up from /routes to /backend
      "..", // Move up from /backend to the project root
      "TechTransfer_Chatbot-Image_Worthiness_Removed" // Enter the chatbot script directory
    );
    const pythonScriptPath = path.join(scriptDir, "live_chat_handler.py");

    // Check if the Python script exists before attempting to run it
    if (!fs.existsSync(pythonScriptPath)) {
      console.error("Chatbot script not found at:", pythonScriptPath);
      return res.status(500).json({ message: "Chatbot script not found on the server." });
    }

    // Spawn the Python process
    const pythonProcess = spawn("python", [
      pythonScriptPath,
      "--prompt",
      prompt,
      "--thesis_text",
      study.abstract, // Using the study's abstract as context
      "--chat_history",
      JSON.stringify(chatHistory || []), // Pass chat history, ensuring it's always an array
    ]);

    let responseData = "";
    let errorData = "";

    // Listen for data on stdout
    pythonProcess.stdout.on("data", (data) => {
      responseData += data.toString();
    });

    // Listen for data on stderr to capture errors from the Python script
    pythonProcess.stderr.on("data", (data) => {
      console.error(`[Python Script STDERR]: ${data.toString()}`);
      errorData += data.toString();
    });

    // Handle the closing of the process
    pythonProcess.on("close", (code) => {
      // If the script exited with an error code, send a server error response
      if (code !== 0) {
        console.error(`Python script exited with code ${code}. Error: ${errorData}`);
        return res
          .status(500)
          .json({ 
            message: "An error occurred in the chatbot script.",
            error: errorData // Send back the captured error for debugging
          });
      }
      
      // --- MODIFIED & ROBUST JSON PARSING ---
      try {
        // Log the raw output from the python script for debugging purposes.
        // This is crucial to see if there's any extra text besides the JSON.
        console.log("Raw response from Python script:", responseData);

        // Find the JSON object within the response string.
        // This regex looks for the first '{' to the last '}' in the string,
        // which helps to ignore any leading/trailing text or warnings.
        const jsonMatch = responseData.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            // If no JSON object is found, throw an error.
            throw new Error("No valid JSON object found in the script's output.");
        }

        // Parse the extracted JSON string.
        const parsedData = JSON.parse(jsonMatch[0]);
        
        // Send the successfully parsed data to the client.
        res.json(parsedData);

      } catch (e) {
        // If parsing fails, log the error and the raw data that caused it.
        console.error("Failed to parse JSON from Python script. Raw response was:", responseData);
        res
          .status(500)
          .json({ 
            message: "Failed to parse the response from the chatbot script.",
            // It's helpful to send the raw response to the frontend during development.
            // In production, you might want to remove the 'rawResponse' field.
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