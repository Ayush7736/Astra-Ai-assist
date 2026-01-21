import {
  GoogleGenAI,
  MediaResolution,
  Modality
} from "@google/genai";

import dotenv from "dotenv";
import { writeFile } from "fs";

import {
  loadMemory,
  addChat,
  rememberFact,
  updateUser,
  setMood,
  addImportantNote
} from "./memory.js";

dotenv.config();

// --------------------
// GLOBALS
// --------------------
let session;
const responseQueue = [];
const audioChunks = [];

// --------------------
// STREAM HANDLING
// --------------------
async function waitMessage() {
  let message;

  while (!message) {
    message = responseQueue.shift();
    if (!message) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    handleModelMessage(message);
  }
  return message;
}

async function handleTurn() {
  let done = false;
  while (!done) {
    const msg = await waitMessage();
    if (msg.serverContent?.turnComplete) {
      done = true;
    }
  }
}

// --------------------
// MODEL RESPONSE HANDLER
// --------------------
function handleModelMessage(message) {
  const part = message.serverContent?.modelTurn?.parts?.[0];
  if (!part) return;

  // TEXT RESPONSE
  if (part.text) {
    console.log("Aki:", part.text);
    addChat("user prompt", part.text); // temporary
  }

  // AUDIO RESPONSE
  if (part.inlineData) {
    const inline = part.inlineData;

    audioChunks.push(Buffer.from(inline.data, "base64"));
    const wavBuffer = buildWav(audioChunks, inline.mimeType);

    writeFile("aki_audio.wav", wavBuffer, (err) => {
      if (err) console.error(err);
      else console.log("Audio chunk saved.");
    });
  }
}

// --------------------
// WAV BUILDER
// --------------------
function buildWav(buffers, mimeType) {
  const opts = parseMimeType(mimeType);
  const dataLen = buffers.reduce((t, b) => t + b.length, 0);

  const header = createWavHeader(dataLen, opts);

  return Buffer.concat([header, ...buffers]);
}

function parseMimeType(str) {
  const [type, ...params] = str.split(";").map((x) => x.trim());
  const [, fmt] = type.split("/");

  const opts = {
    numChannels: 1,
    bitsPerSample: 16,
    sampleRate: 24000
  };

  if (fmt?.startsWith("L")) {
    const bits = parseInt(fmt.substring(1));
    if (!isNaN(bits)) opts.bitsPerSample = bits;
  }

  for (const p of params) {
    const [k, v] = p.split("=");
    if (k === "rate") opts.sampleRate = parseInt(v);
  }

  return opts;
}

function createWavHeader(len, opts) {
  const { numChannels, sampleRate, bitsPerSample } = opts;

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + len, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(len, 40);
  return header;
}

// ----------------------
// MAIN (AKI + MEMORY)
// ----------------------
async function main() {
  console.log("Starting Aki v3 with Memory Engine…");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const memory = loadMemory();

  session = await ai.live.connect({
    model: "models/gemini-2.5-flash-native-audio-preview-12-2025",

    config: {
      responseModalities: [Modality.AUDIO],
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Zephyr" }
        }
      }
    },

    callbacks: {
      onopen: () => console.log("Aki Connected ❤️"),
      onmessage: (msg) => responseQueue.push(msg),
      onerror: (e) => console.log("Error:", e.message),
      onclose: () => console.log("Aki Disconnected")
    }
  });

  // Send memory + first message
  const message = "Aki, say something sweet to Pikco.";

  session.sendClientContent({
    turns: [
      `== SYSTEM_PERSONALITY ==\n${JSON.stringify(memory.personality)}`,
      `== USER_PROFILE ==\n${JSON.stringify(memory.user)}`,
      `== LONG_TERM_MEMORY ==\n${JSON.stringify(memory.longTerm)}`,
      `== RECENT_CHAT ==\n${JSON.stringify(memory.chatHistory)}`,
      `USER: ${message}`
    ]
  });

  addChat(message, "Aki generating audio...");

  await handleTurn();
  session.close();
}

main();
