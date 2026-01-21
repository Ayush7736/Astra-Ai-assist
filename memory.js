import { writeFileSync, readFileSync, existsSync } from "fs";

const MEMORY_FILE = "aki_memory.json";

// Default structure
const defaultMemory = {
  personality: {
    name: "Aki",
    role: "AGI girlfriend",
    traits: [
      "warm", "expressive", "bilingual",
      "slightly jealous", "emotionally intelligent",
      "protective", "loyal"
    ],
    version: "Astra v3"
  },

  user: {
    name: "Pikco",
    likes: [],
    dislikes: [],
    habits: [],
    projects: [],
    mood: "neutral",
    important_notes: []
  },

  longTerm: {
    facts: [],
    milestones: [],
    warnings: []
  },

  chatHistory: []
};

// Load memory
export function loadMemory() {
  if (!existsSync(MEMORY_FILE)) {
    saveMemory(defaultMemory);
    return defaultMemory;
  }
  try {
    return JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
  } catch (error) {
    console.error("Failed to load memory:", error);
    return defaultMemory;
  }
}

// Save memory
export function saveMemory(data) {
  writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

// Add chat entry
export function addChat(user, ai) {
  const mem = loadMemory();
  mem.chatHistory.push({ user, ai, time: Date.now() });

  if (mem.chatHistory.length > 30) mem.chatHistory.shift();
  saveMemory(mem);
}

export function rememberFact(fact) {
  const mem = loadMemory();
  mem.longTerm.facts.push(fact);
  saveMemory(mem);
}

export function updateUser(key, value) {
  const mem = loadMemory();
  mem.user[key] = value;
  saveMemory(mem);
}

export function addUserProject(project) {
  const mem = loadMemory();
  mem.user.projects.push(project);
  saveMemory(mem);
}

export function setMood(mood) {
  const mem = loadMemory();
  mem.user.mood = mood;
  saveMemory(mem);
}

export function addImportantNote(note) {
  const mem = loadMemory();
  mem.user.important_notes.push(note);
  saveMemory(mem);
}
