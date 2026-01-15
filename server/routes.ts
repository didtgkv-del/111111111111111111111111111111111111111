import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth } from "./auth";
import { z } from "zod";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";

declare module "express" {
  interface Request {
    file?: Express.Multer.File;
  }
}

const EMAIL = "beloralcgo@gmail.com";
const APP_PASSWORD = "shbadswueozfwwjq";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL,
    pass: APP_PASSWORD,
  },
});

async function sendVerificationEmail(to: string, code: string) {
  console.log(`Sending verification email to ${to} with code ${code}`);
  try {
    await transporter.sendMail({
      from: `"ONMS Support" <${EMAIL}>`,
      to,
      subject: "Your ONMS Verification Code",
      text: `Your verification code is: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #333; text-align: center; margin-bottom: 20px;">ONMS Email Verification</h1>
            <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${code}
            </div>
            <p style="color: #666; text-align: center; margin-top: 20px; font-size: 16px;">
              This is your verification code. Enter it on the verification page to complete your registration.
            </p>
            <p style="color: #999; text-align: center; margin-top: 30px; font-size: 14px;">
              This code will expire in 24 hours. If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const { hashPassword, comparePasswords, sendPasswordResetEmail, generateResetCode } = setupAuth(app) as any;

  // Configure multer for avatar uploads
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), "uploads/avatars");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  // Configure multer for post image uploads
  const postImageUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), "uploads/posts");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });
  const bannerUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), "uploads/banners");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed"));
      }
    },
  });

  // Helper function to check if user is authenticated
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Auth Routes
  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);

      if (!input.email.endsWith("@gmail.com")) {
        return res.status(400).json({ message: "Email must end with @gmail.com" });
      }
      if (input.password !== input.confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }
      if (input.username.length < 3 || input.username.length > 7) {
         return res.status(400).json({ message: "Username must be 3-7 characters" });
      }
      if (!/^[a-zA-Z0-9]+$/.test(input.username)) {
        return res.status(400).json({ message: "Username must contain only English letters and numbers" });
      }

      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(input.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
        email: input.email,
        bio: input.bio,
        avatar: input.avatar,
        theme: input.theme,
        isPrivate: input.isPrivate,
        profileVisibility: input.profileVisibility,
        showEmail: input.showEmail,
        showOnlineStatus: input.showOnlineStatus,
        allowMessages: input.allowMessages,
      });

      await sendVerificationEmail(user.email, user.verificationCode!);

      res.status(201).json({ 
        message: "Registration successful. Please check your email for verification code.",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        next(err);
      }
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    const result = api.auth.login.input.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid input" });
    }
    next();
  }, (req, res, next) => {
    import("passport").then((passport) => {
      passport.default.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        if (!user.emailVerified) return res.status(403).json({ message: "Please verify your email first" });
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(200).json(user);
        });
      })(req, res, next);
    });
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Password Reset Routes
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const resetCode = generateResetCode();
      await storage.setResetCode(email, resetCode);
      
      const emailSent = await sendPasswordResetEmail(email, resetCode);
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send reset email" });
      }

      res.json({ message: "Password reset code sent to your email" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/auth/verify-reset-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const isValid = await storage.validateResetCode(email, code);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      res.json({ message: "Reset code verified" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, code, and new password are required" });
      }

      const isValid = await storage.validateResetCode(email, code);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updatePassword(email, hashedPassword);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Avatar Upload Route
  app.post("/api/upload-avatar", upload.single("avatar"), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await storage.updateUser((req.user as any).id, { avatar: avatarUrl });
      res.json({ url: avatarUrl });
    } catch (err) {
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(200).json(null);
    }

    const user = req.user as any;
    if (!user?.emailVerified) {
      return res.status(200).json(null);
    }

    res.json(user);
  });

  // Settings Routes
  app.patch(api.settings.updateProfile.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const updates = api.settings.updateProfile.input.parse(req.body);
      const updatedUser = await storage.updateUser((req.user as any).id, updates);
      res.json(updatedUser);
    } catch (err) {
       res.status(400).json({ message: "Invalid updates" });
    }
  });

  app.patch(api.settings.updatePassword.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const { currentPassword, newPassword } = api.settings.updatePassword.input.parse(req.body);
    const user = req.user as any;
    
    if (!(await comparePasswords(currentPassword, user.password))) {
      return res.status(400).json({ message: "Incorrect current password" });
    }
    
    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: hashedPassword });
    res.sendStatus(200);
  });

  // Email Verification Routes
  app.post("/api/verify-email", async (req, res) => {
    try {
      console.log("Verification request body:", req.body);
      const { email, code } = req.body;
      
      if (!email || !code) {
        console.log("Missing email or code");
        return res.status(400).json({ message: "Email and code are required" });
      }

      const user = await storage.getUserByEmail(email);
      console.log("Found user:", user ? user.id : "not found");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Comparing codes:", user.verificationCode, "vs", code);
      
      if (user.verificationCode !== code) {
        console.log("Code mismatch");
        return res.status(400).json({ message: "Invalid verification code" });
      }

      await storage.updateUser(user.id, { emailVerified: true, verificationCode: null });
      console.log("Email verified successfully");
      
      // Auto-login after verification
      req.login(user, (err) => {
        if (err) {
          console.error("Auto-login error:", err);
          return res.status(500).json({ message: "Verification successful but login failed" });
        }
        console.log("Auto-login successful");
        res.json({ message: "Email verified successfully", user: { id: user.id, username: user.username, email: user.email } });
      });
    } catch (err) {
      console.error("Verification error:", err);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post(api.auth.resend.path, async (req, res) => {
    try {
      const { email } = api.auth.resend.input.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.emailVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      await storage.updateUser(user.id, { verificationCode: newCode });
      
      await sendVerificationEmail(email, newCode);
      
      res.json({ message: "Verification code sent" });
    } catch (err) {
      res.status(500).json({ message: "Failed to resend code" });
    }
  });

  // Forgot Password Routes
  app.post(api.auth.forgotPassword.path, async (req, res) => {
    try {
      const { email } = api.auth.forgotPassword.input.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      await storage.setResetCode(email, resetCode);
      
      await sendPasswordResetEmail(email, resetCode);
      
      res.json({ message: "Password reset code sent to your email" });
    } catch (err) {
      res.status(500).json({ message: "Failed to send reset code" });
    }
  });

  app.post(api.auth.verifyResetCode.path, async (req, res) => {
    try {
      const { email, code } = api.auth.verifyResetCode.input.parse(req.body);
      const isValid = await storage.validateResetCode(email, code);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }
      res.json({ message: "Code verified, you can now reset your password" });
    } catch (err) {
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  app.post(api.auth.resetPassword.path, async (req, res) => {
    try {
      const { email, code, newPassword } = api.auth.resetPassword.input.parse(req.body);
      const isValid = await storage.validateResetCode(email, code);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updatePassword(email, hashedPassword);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Banner Upload Route
  app.post("/api/upload-banner", bannerUpload.single("banner"), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const bannerUrl = `/uploads/banners/${req.file.filename}`;
      await storage.updateUser((req.user as any).id, { banner: bannerUrl });
      res.json({ url: bannerUrl });
    } catch (err) {
      res.status(500).json({ message: "Failed to upload banner" });
    }
  });

  // Admin Routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users/:id/ban", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const { banReason, banExpires } = req.body;
      await storage.banUser(parseInt(req.params.id), banReason, banExpires);
      res.json({ message: "User banned successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.post("/api/admin/users/:id/unban", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      await storage.unbanUser(parseInt(req.params.id));
      res.json({ message: "User unbanned successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  app.get("/api/admin/posts", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const posts = await storage.getAllPosts();
      res.json(posts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.delete("/api/admin/posts/:id", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      await storage.deletePost(parseInt(req.params.id));
      res.json({ message: "Post deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  app.get("/api/admin/reports", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const reports = await storage.getAllReports();
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.post("/api/admin/reports/:id/review", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const { status } = req.body;
      await storage.updateReportStatus(parseInt(req.params.id), status, (req.user as any).id);
      res.json({ message: "Report reviewed successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to review report" });
    }
  });

  app.get("/api/admin/audit-logs", async (req, res) => {
    if (!req.isAuthenticated() || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // User Routes
  app.get(api.users.search.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const raw = (req.query.q ?? req.query.query ?? "") as string;
    const results = await storage.searchUsers(String(raw || ""), (req.user as any).id);
    res.json(results);
  });

  app.get(api.users.get.path, async (req, res) => {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    const stats = await storage.getUserStats(user.id);
    const viewerId = req.isAuthenticated() ? (req.user as any).id : null;
    if (viewerId) {
      const relationship = await storage.getFollowRelationship(viewerId, user.id);
      const isMutualFollow = relationship.isFollowing && relationship.isFollowedBy;
      return res.json({ ...user, ...stats, ...relationship, isMutualFollow });
    }
    res.json({ ...user, ...stats, isFollowing: false, isFollowedBy: false, isMutualFollow: false });
  });

  app.post(api.users.follow.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });

    if ((req.user as any).id === user.id) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }
    
    await storage.followUser((req.user as any).id, user.id);
    res.sendStatus(200);
  });

  app.get(api.users.leaderboard.path, async (req, res) => {
    const users = await storage.getLeaderboard();
    res.json(users);
  });

  app.get(api.conversations.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const convs = await storage.listConversations(userId);
    res.json(convs.map(c => ({
      ...c,
      lastMessage: c.lastMessage ? {
        ...c.lastMessage,
        createdAt: c.lastMessage.createdAt ? c.lastMessage.createdAt.toISOString() : null,
      } : null,
    })));
  });

  app.post(api.conversations.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const input = api.conversations.create.input.parse(req.body);
      const userId = (req.user as any).id;
      const other = await storage.getUser(Number(input.userId));
      if (!other) return res.status(404).json({ message: "User not found" });

      const mutual = await storage.isMutualFollow(userId, other.id);
      if (!mutual) return res.status(403).json({ message: "Mutual follow required" });

      const conv = await storage.getOrCreateConversation(userId, other.id);
      res.json({ id: conv.id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.conversations.messages.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const conversationId = Number(req.params.id);
    const isMember = await storage.isConversationMember(conversationId, userId);
    if (!isMember) return res.status(404).json({ message: "Conversation not found" });

    const otherUserId = await storage.getConversationOtherUserId(conversationId, userId);
    if (!otherUserId) return res.status(404).json({ message: "Conversation not found" });

    const mutual = await storage.isMutualFollow(userId, otherUserId);
    if (!mutual) return res.status(403).json({ message: "Mutual follow required" });

    const msgs = await storage.listMessages(conversationId, userId);
    res.json(msgs.map(m => ({
      ...m,
      createdAt: m.createdAt ? m.createdAt.toISOString() : null,
    })));
  });

  app.post(api.conversations.messages.send.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = (req.user as any).id;
    const conversationId = Number(req.params.id);
    try {
      const input = api.conversations.messages.send.input.parse(req.body);

      const isMember = await storage.isConversationMember(conversationId, userId);
      if (!isMember) return res.status(404).json({ message: "Conversation not found" });

      const otherUserId = await storage.getConversationOtherUserId(conversationId, userId);
      if (!otherUserId) return res.status(404).json({ message: "Conversation not found" });

      const mutual = await storage.isMutualFollow(userId, otherUserId);
      if (!mutual) return res.status(403).json({ message: "Mutual follow required" });

      const msg = await storage.sendMessage(conversationId, userId, { type: input.type, content: input.content });
      res.status(201).json({
        ...msg,
        createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Post Routes
  app.get(api.posts.list.path, async (req, res) => {
    const posts = await storage.getPosts();
    res.json(posts);
  });

  app.post(api.posts.create.path, postImageUpload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    try {
      const content = req.body.content;
      const type = req.body.type || "text";
      
      if (!content && !req.file) {
        return res.status(400).json({ message: "Content or image is required" });
      }

      let fileUrl = null;
      if (req.file) {
        fileUrl = `/uploads/posts/${req.file.filename}`;
      }

      const post = await storage.createPost({
        userId: (req.user as any).id,
        content: content,
        type,
        fileUrl
      });
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

  app.post(api.posts.like.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    await storage.toggleLike((req.user as any).id, Number(req.params.id));
    res.sendStatus(200);
  });

  return httpServer;
}
