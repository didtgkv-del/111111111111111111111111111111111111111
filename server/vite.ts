import { type Express } from "express";
import { createServer } from "vite";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import express from "express";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(server: Server, app: Express) {
  const viteServer = await createServer({
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true,
    },
    appType: "custom",
  });

  app.use(viteServer.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientIndex = path.resolve(process.cwd(), "client", "index.html");
      let template = await fs.promises.readFile(clientIndex, "utf-8");
      
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      
      const page = await viteServer.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      if (e instanceof Error) {
        viteServer.ssrFixStacktrace(e);
      }
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    const fallbackPath = path.resolve(process.cwd(), "client", "dist");
    if (fs.existsSync(fallbackPath)) {
        app.use(express.static(fallbackPath));
        app.use("*", (_req, res) => {
            res.sendFile(path.resolve(fallbackPath, "index.html"));
        });
        return;
    }
    
    const devPath = path.resolve(process.cwd(), "client");
    if (fs.existsSync(devPath)) {
        app.use(express.static(devPath));
        app.use("*", (_req, res) => {
            res.sendFile(path.resolve(devPath, "index.html"));
        });
        return;
    }

    throw new Error(
      `Could not find the build directory. Searched in ${distPath} and ${fallbackPath}`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
