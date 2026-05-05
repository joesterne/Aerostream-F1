import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

process.on("uncaughtException", (err) => {
  fs.writeFileSync('server_crash.log', 'uncaughtException: ' + (err.stack || err.message));
  console.error("uncaughtException", err);
});
process.on("unhandledRejection", (err: any) => {
  fs.writeFileSync('server_crash2.log', 'unhandledRejection: ' + (err?.stack || err?.message || err));
  console.error("unhandledRejection", err);
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;
  
  io.on("connection", (socket) => {
    console.log("Telemetry client connected:", socket.id);
    
    // Send initial state
    socket.emit("telemetry:stream", {
      speed: 0,
      downforce: 0,
      drag: 0,
      tireTemp: { fl: 90, fr: 90, rl: 90, rr: 90 },
      ers: 100,
      timestamp: Date.now()
    });

    socket.on("disconnect", () => {
      console.log("Telemetry client disconnected");
    });
  });

  // API routes FIRST
  app.use(express.json());
  
  app.get("/api/test-env", (req, res) => {
    res.json({ hasKey: !!process.env.GEMINI_API_KEY, prefix: String(process.env.GEMINI_API_KEY).substring(0, 5) });
  });

  app.post("/api/advice", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is required." });
      }
      const ai = new GoogleGenAI({ apiKey });
      const prompt = req.body.prompt;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", 
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text;
      if (!responseText) {
        return res.status(500).json({ error: "No response from AI" });
      }
      const cleanedText = responseText.replace(/```json|```/g, '').trim();
      res.json(JSON.parse(cleanedText));
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate advice: " + (error?.message || String(error)) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
