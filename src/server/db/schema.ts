import {
  pgTable,
  text,
  integer,
  timestamp,
  pgEnum,
  uuid,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Better Auth managed tables ────────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Application enums ─────────────────────────────────────────────────────────
export const inputModeEnum = pgEnum("input_mode", [
  "zip",
  "files",
  "folder_path",
  "multi_folder",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const edgeTypeEnum = pgEnum("edge_type", [
  "import",
  "call",
  "reexport",
]);

// ─── Projects ──────────────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  inputMode: inputModeEnum("input_mode").notNull(),
  status: projectStatusEnum("status").notNull().default("pending"),
  totalFiles: integer("total_files").notNull().default(0),
  processedFiles: integer("processed_files").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Files ─────────────────────────────────────────────────────────────────────
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  relativePath: text("relative_path").notNull(),
  language: text("language").notNull(),
  linesOfCode: integer("lines_of_code").notNull().default(0),
  fileHash: text("file_hash").notNull(),
  importCount: integer("import_count").notNull().default(0),
  exportCount: integer("export_count").notNull().default(0),
});

// ─── Edges ─────────────────────────────────────────────────────────────────────
export const edges = pgTable("edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sourceFileId: uuid("source_file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  targetFileId: uuid("target_file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  edgeType: edgeTypeEnum("edge_type").notNull().default("import"),
});

// ─── Analyses ──────────────────────────────────────────────────────────────────
export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  workflow: jsonb("workflow").$type<string[]>().notNull(),
  imports: jsonb("imports").$type<string[]>().notNull(),
  exports: jsonb("exports").$type<string[]>().notNull(),
  cachedAt: timestamp("cached_at").notNull().defaultNow(),
});

// ─── Type exports ──────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type File = typeof files.$inferSelect;
export type Edge = typeof edges.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type NewFile = typeof files.$inferInsert;
export type NewEdge = typeof edges.$inferInsert;
export type NewAnalysis = typeof analyses.$inferInsert;
