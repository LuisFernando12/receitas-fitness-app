import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    service: "receitasapp",
  },
  redact: {
    paths: [
      "apiKey",
      "GEMINI_API_KEY",
      "*.apiKey",
      "*.GEMINI_API_KEY",
      "*.headers.authorization",
      "*.headers.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
