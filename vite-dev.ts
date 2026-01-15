import { type Express } from "express";
import express from "express";
import { type Server } from "http";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

export async function setupVite(server: Server, app: Express) {
  // Simple static file serving for development
  app.use(express.static('client/dist'));
  
  app.use("*", async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(
        process.cwd(),
        "client",
        "dist",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      next(e);
    }
  });
}
