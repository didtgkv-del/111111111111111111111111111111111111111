import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  bio: text("bio"),
  avatar: text("avatar"),
  banner: text("banner"),
  rank: integer("rank").default(0),
  theme: text("theme").default("default"),
  isPrivate: boolean("is_private").default(false),
  emailVerified: boolean("email_verified").default(false),
  verificationCode: text("verification_code"),
  resetCode: text("reset_code"),
  resetCodeExpires: timestamp("reset_code_expires"),
  profileVisibility: text("profile_visibility").default("public"),
  showEmail: boolean("show_email").default(false),
  showOnlineStatus: boolean("show_online_status").default(true),
  allowMessages: boolean("allow_messages").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  isAdmin: boolean("is_admin").default(false),
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"),
  fileUrl: text("file_url"),
  isDeleted: boolean("is_deleted").default(false),
  isReported: boolean("is_reported").default(false),
  reportCount: integer("report_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id"),
  reporterId: integer("reporter_id").notNull(),
  reportedUserId: integer("reported_user_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("pending"), // pending, reviewed, resolved
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by"),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // like, comment, follow, mention, system
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: text("data"), // JSON data for additional info
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(), // login, logout, post_create, post_delete, user_ban, user_unban
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const follows = pgTable("follows", {
  followerId: integer("follower_id").notNull(),
  followingId: integer("following_id").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followerId, t.followingId] }),
}));

export const likes = pgTable("likes", {
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.postId] }),
}));

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversationMembers = pgTable("conversation_members", {
  conversationId: integer("conversation_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.conversationId, t.userId] }),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  type: text("type").notNull().default("text"),
  content: text("content"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  followers: many(follows, { relationName: "follower" }),
  following: many(follows, { relationName: "following" }),
  likes: many(likes),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [likes.postId],
    references: [posts.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  likes: many(likes),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, rank: true, emailVerified: true, verificationCode: true });
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;

export type UpdateProfileRequest = Partial<Pick<User, 'username' | 'bio' | 'avatar' | 'banner' | 'theme' | 'isPrivate' | 'profileVisibility' | 'showEmail' | 'showOnlineStatus' | 'allowMessages'>>;
export type UpdatePasswordRequest = { currentPassword: string; newPassword: string };
export type VerifyEmailRequest = { code: string };
export type PasswordResetRequest = { email: string };
export type PasswordResetConfirmRequest = { code: string; newPassword: string };
export type SearchUsersRequest = { query: string };
export type SearchPostsRequest = { query: string };
