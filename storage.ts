import { users, posts, follows, likes, conversations, conversationMembers, messages, type User, type InsertUser, type Post, type InsertPost, type Conversation, type Message } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  
  createPost(post: InsertPost): Promise<Post>;
  getPosts(): Promise<(Post & { author: User, likesCount: number, isLiked: boolean })[]>;
  getPost(id: number): Promise<Post | undefined>;
  
  toggleLike(userId: number, postId: number): Promise<void>;
  followUser(followerId: number, followingId: number): Promise<void>;

  isMutualFollow(userA: number, userB: number): Promise<boolean>;
  getFollowRelationship(viewerId: number, otherUserId: number): Promise<{ isFollowing: boolean; isFollowedBy: boolean }>;
  searchUsers(query: string, viewerId: number): Promise<Array<{ id: number; username: string; bio: string | null; avatar: string | null; followersCount: number; isFollowing: boolean; isFollowedBy: boolean }>>;

  getOrCreateConversation(userA: number, userB: number): Promise<Conversation>;
  isConversationMember(conversationId: number, userId: number): Promise<boolean>;
  getConversationOtherUserId(conversationId: number, userId: number): Promise<number | null>;
  listConversations(userId: number): Promise<Array<{ id: number; otherUser: { id: number; username: string; avatar: string | null }; lastMessage: { type: string; content: string | null; createdAt: Date | null } | null }>>;
  listMessages(conversationId: number, userId: number): Promise<Message[]>;
  sendMessage(conversationId: number, senderId: number, input: { type?: string; content?: string | null; fileUrl?: string | null }): Promise<Message>;
  
  getLeaderboard(): Promise<(User & { followersCount: number })[]>;
  getUserStats(userId: number): Promise<{ followersCount: number, followingCount: number }>;
  
  // Password reset functionality
  setResetCode(email: string, code: string): Promise<void>;
  validateResetCode(email: string, code: string): Promise<boolean>;
  updatePassword(email: string, newPassword: string): Promise<void>;
  
  // Admin functions
  getAllUsers(): Promise<User[]>;
  banUser(userId: number, banReason: string, banExpires?: Date): Promise<void>;
  unbanUser(userId: number): Promise<void>;
  getAllPosts(): Promise<Post[]>;
  deletePost(id: number): Promise<void>;
  createReport(reportData: InsertReport): Promise<any>;
  getAllReports(): Promise<any[]>;
  updateReportStatus(reportId: number, status: string, reviewedBy: number): Promise<void>;
  createAuditLog(logData: InsertAuditLog): Promise<any>;
  getAuditLogs(): Promise<any[]>;

  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Creating user with verification code:", verificationCode);
    const [user] = await db.insert(users).values({
      ...insertUser,
      verificationCode,
    }).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async createPost(post: InsertPost): Promise<Post> {
    const [newPost] = await db.insert(posts).values(post).returning();
    return newPost;
  }

  async getPosts(): Promise<(Post & { author: User, likesCount: number, isLiked: boolean, fileUrl?: string })[]> {
    const result = await db.query.posts.findMany({
      orderBy: [desc(posts.createdAt)],
      with: {
        author: true,
        likes: true,
      },
    });

    return result.map(post => ({
      ...post,
      fileUrl: post.fileUrl, // Include fileUrl in response
      likesCount: post.likes.length,
      isLiked: false,
    }));
  }

  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async toggleLike(userId: number, postId: number): Promise<void> {
    const [existing] = await db.select().from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    
    if (existing) {
      await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    } else {
      await db.insert(likes).values({ userId, postId });
    }
  }

  async isMutualFollow(userA: number, userB: number): Promise<boolean> {
    if (userA === userB) return false;
    const rows = await db.select({ followerId: follows.followerId, followingId: follows.followingId }).from(follows)
      .where(or(
        and(eq(follows.followerId, userA), eq(follows.followingId, userB)),
        and(eq(follows.followerId, userB), eq(follows.followingId, userA))
      ));
    let aToB = false;
    let bToA = false;
    for (const r of rows) {
      if (r.followerId === userA && r.followingId === userB) aToB = true;
      if (r.followerId === userB && r.followingId === userA) bToA = true;
    }
    return aToB && bToA;
  }

  async getFollowRelationship(viewerId: number, otherUserId: number): Promise<{ isFollowing: boolean; isFollowedBy: boolean }> {
    if (viewerId === otherUserId) return { isFollowing: false, isFollowedBy: false };

    const edges = await db.select({ followerId: follows.followerId, followingId: follows.followingId }).from(follows)
      .where(or(
        and(eq(follows.followerId, viewerId), eq(follows.followingId, otherUserId)),
        and(eq(follows.followerId, otherUserId), eq(follows.followingId, viewerId))
      ));

    let isFollowing = false;
    let isFollowedBy = false;
    for (const e of edges) {
      if (e.followerId === viewerId && e.followingId === otherUserId) isFollowing = true;
      if (e.followerId === otherUserId && e.followingId === viewerId) isFollowedBy = true;
    }
    return { isFollowing, isFollowedBy };
  }

  async searchUsers(query: string, viewerId: number): Promise<Array<{ id: number; username: string; bio: string | null; avatar: string | null; followersCount: number; isFollowing: boolean; isFollowedBy: boolean }>> {
    const q = query.trim();
    if (!q) return [];

    const candidates = await db.select({
      id: users.id,
      username: users.username,
      bio: users.bio,
      avatar: users.avatar,
    }).from(users)
      .where(and(
        sql`${users.username} ILIKE ${'%' + q + '%'}`,
        sql`${users.id} != ${viewerId}`
      ))
      .limit(20);

    const ids = candidates.map(u => u.id);
    if (ids.length === 0) return [];

    const followEdges = await db.select({ followerId: follows.followerId, followingId: follows.followingId })
      .from(follows)
      .where(or(
        and(eq(follows.followerId, viewerId), inArray(follows.followingId, ids)),
        and(inArray(follows.followerId, ids), eq(follows.followingId, viewerId))
      ));

    const followersCounts = await db.select({
      userId: follows.followingId,
      count: sql<number>`count(*)`,
    }).from(follows)
      .where(inArray(follows.followingId, ids))
      .groupBy(follows.followingId);

    const followersCountMap = new Map<number, number>();
    for (const r of followersCounts) followersCountMap.set(r.userId, Number(r.count || 0));

    const isFollowingSet = new Set<number>();
    const isFollowedBySet = new Set<number>();
    for (const e of followEdges) {
      if (e.followerId === viewerId) isFollowingSet.add(e.followingId);
      if (e.followingId === viewerId) isFollowedBySet.add(e.followerId);
    }

    return candidates.map(u => ({
      ...u,
      followersCount: followersCountMap.get(u.id) ?? 0,
      isFollowing: isFollowingSet.has(u.id),
      isFollowedBy: isFollowedBySet.has(u.id),
    }));
  }

  async isConversationMember(conversationId: number, userId: number): Promise<boolean> {
    const [row] = await db.select({ conversationId: conversationMembers.conversationId }).from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    return !!row;
  }

  async getConversationOtherUserId(conversationId: number, userId: number): Promise<number | null> {
    const rows = await db.select({ userId: conversationMembers.userId }).from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
    const other = rows.find(r => r.userId !== userId);
    return other ? other.userId : null;
  }

  async getOrCreateConversation(userA: number, userB: number): Promise<Conversation> {
    const my = await db.select({ conversationId: conversationMembers.conversationId }).from(conversationMembers)
      .where(eq(conversationMembers.userId, userA));
    const myIds = my.map(r => r.conversationId);

    if (myIds.length > 0) {
      const [existing] = await db.select({ conversationId: conversationMembers.conversationId }).from(conversationMembers)
        .where(and(eq(conversationMembers.userId, userB), inArray(conversationMembers.conversationId, myIds)));
      if (existing) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, existing.conversationId));
        if (conv) return conv;
      }
    }

    const [conv] = await db.insert(conversations).values({}).returning();
    await db.insert(conversationMembers).values([
      { conversationId: conv.id, userId: userA },
      { conversationId: conv.id, userId: userB },
    ]);
    return conv;
  }

  async listConversations(userId: number): Promise<Array<{ id: number; otherUser: { id: number; username: string; avatar: string | null }; lastMessage: { type: string; content: string | null; createdAt: Date | null } | null }>> {
    const memberships = await db.select({ conversationId: conversationMembers.conversationId }).from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    const ids = memberships.map(m => m.conversationId);
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map(async (id) => {
      const others = await db.select({ id: users.id, username: users.username, avatar: users.avatar })
        .from(conversationMembers)
        .innerJoin(users, eq(conversationMembers.userId, users.id))
        .where(and(eq(conversationMembers.conversationId, id), sql`${users.id} != ${userId}`))
        .limit(1);
      const other = others[0];

      const last = await db.select({ type: messages.type, content: messages.content, createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        id,
        otherUser: {
          id: other?.id ?? 0,
          username: other?.username ?? "",
          avatar: other?.avatar ?? null,
        },
        lastMessage: last[0] ? { type: last[0].type, content: last[0].content ?? null, createdAt: last[0].createdAt ?? null } : null,
      };
    }));

    return results.filter(r => r.otherUser.id !== 0);
  }

  async listMessages(conversationId: number, userId: number): Promise<Message[]> {
    const isMember = await this.isConversationMember(conversationId, userId);
    if (!isMember) return [];

    return db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async sendMessage(conversationId: number, senderId: number, input: { type?: string; content?: string | null; fileUrl?: string | null }): Promise<Message> {
    const isMember = await this.isConversationMember(conversationId, senderId);
    if (!isMember) {
      throw new Error("NOT_FOUND");
    }

    const messageType = input.type || "text";
    const content = input.content ?? null;
    const fileUrl = input.fileUrl ?? null;

    const [msg] = await db.insert(messages).values({
      conversationId,
      senderId,
      type: messageType,
      content,
      fileUrl,
    }).returning();
    return msg;
  }

  async followUser(followerId: number, followingId: number): Promise<void> {
    if (followerId === followingId) return;
    
    const [existing] = await db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      
    if (existing) {
      await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    } else {
      await db.insert(follows).values({ followerId, followingId });
      await db.execute(sql`UPDATE users SET rank = rank + 1 WHERE id = ${followingId}`);
    }
  }

  async getLeaderboard(): Promise<(User & { followersCount: number })[]> {
    const result = await db.select().from(users).orderBy(desc(users.rank)).limit(10);
    return result.map(u => ({ ...u, followersCount: u.rank || 0 }));
  }

  async getUserStats(userId: number): Promise<{ followersCount: number, followingCount: number }> {
    const followers = await db.select({ count: sql<number>`count(*)` }).from(follows).where(eq(follows.followingId, userId));
    const following = await db.select({ count: sql<number>`count(*)` }).from(follows).where(eq(follows.followerId, userId));
    
    return {
      followersCount: Number(followers[0]?.count || 0),
      followingCount: Number(following[0]?.count || 0),
    };
  }

  // Password reset functionality
  async setResetCode(email: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db.update(users).set({ 
      resetCode: code,
      resetCodeExpires: expiresAt
    }).where(eq(users.email, email));
  }

  async validateResetCode(email: string, code: string): Promise<boolean> {
    const [user] = await db.select().from(users)
      .where(and(
        eq(users.email, email), 
        eq(users.resetCode, code),
        sql`${users.resetCodeExpires} > NOW()`
      ));
    return !!user;
  }

  async updatePassword(email: string, newPassword: string): Promise<void> {
    await db.update(users).set({ 
      password: newPassword,
      resetCode: null,
      resetCodeExpires: null
    }).where(eq(users.email, email));
  }
}

export const storage = new DatabaseStorage();
