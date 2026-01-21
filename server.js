import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  GoogleGenAI,
  Modality,
  MediaResolution
} from "@google/genai";

import {
  loadMemory,
  addChat,
} from "./memory.js";

import { Buffer } from "buffer";

dotenv.config();

// ---------------------
// EXPRESS SERVER
// ---------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// ---------------------
// GEMINI CLIENT
// ---------------------
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ---------------------
// API ROUTE
// ---------------------
app.post("/chat", async (req, res) => {
  try {
    const userInput = req.body.message || "";
    const memory = loadMemory();

    // Connect to Gemini Live
    const session = await ai.live.connect({
      model: "models/gemini-2.5-flash-native-audio-preview-12-2025",

      config: {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" }
          }
        }
      }
    });

    let textOutput = "";
    let audioChunks = [];

    session.callbacks = {
      onmessage(msg) {
        const part = msg.serverContent?.modelTurn?.parts?.[0];
        if (!part) return;

        if (part.text) textOutput += part.text;
        if (part.inlineData) {
          audioChunks.push(Buffer.from(part.inlineData.data, "base64"));
        }
      },
    };

    session.sendClientContent({
      turns: [
        `SYSTEM_PERSONALITY: ${JSON.stringify(memory.personality)}`,
        `USER_PROFILE: ${JSON.stringify(memory.user)}`,
        `LONG_TERM_MEMORY: ${JSON.stringify(memory.longTerm)}`,
        `RECENT_CHAT: ${JSON.stringify(memory.chatHistory)}`,
        `USER: ${userInput}`,
      ]
    });

    await new Promise((resolve) => setTimeout(resolve, 2500));
    session.close();

    const finalAudio = Buffer.concat(audioChunks).toString("base64");

    addChat(userInput, textOutput);

    return res.json({
      success: true,
      text: textOutput,
      audio: finalAudio
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// ---------------------
// START SERVER
// ---------------------
app.listen(PORT, () => {
  console.log(`Aki v3 Backend running on port ${PORT}`);
});
