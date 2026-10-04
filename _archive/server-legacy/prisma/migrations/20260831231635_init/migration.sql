-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "slogan" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "accentColor" TEXT NOT NULL DEFAULT '#06b6d4',
    "welcomePageHtml" TEXT,
    "footerText" TEXT,
    "systemPrompt" TEXT,
    "behaviorPrompt" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'nl',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "chatStorageMode" TEXT NOT NULL DEFAULT 'server',
    "enableAnonymization" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionDays" INTEGER,
    "enableAuditLogging" BOOLEAN NOT NULL DEFAULT false,
    "userCanChooseStorage" BOOLEAN NOT NULL DEFAULT true,
    "enableE2EEncryption" BOOLEAN NOT NULL DEFAULT true,
    "enableOpenPCC" BOOLEAN NOT NULL DEFAULT false,
    "enableNetworkIsolation" BOOLEAN NOT NULL DEFAULT true,
    "enableExamMode" BOOLEAN NOT NULL DEFAULT false,
    "enableKennisnet" BOOLEAN NOT NULL DEFAULT false,
    "kennisnetClientId" TEXT,
    "kennisnetClientSecret" TEXT,
    "enableLocalAuth" BOOLEAN NOT NULL DEFAULT true,
    "enableGuestAccess" BOOLEAN NOT NULL DEFAULT false,
    "enable2FA" BOOLEAN NOT NULL DEFAULT false,
    "registrationMode" TEXT NOT NULL DEFAULT 'admin',
    "enableRateLimiting" BOOLEAN NOT NULL DEFAULT true,
    "maxPromptsPerDay" INTEGER,
    "maxPromptsPerMonth" INTEGER,
    "maxThinkingPerDay" INTEGER,
    "maxTokensPerRequest" INTEGER NOT NULL DEFAULT 4096,
    "enableSharedChats" BOOLEAN NOT NULL DEFAULT true,
    "enableCollabChats" BOOLEAN NOT NULL DEFAULT true,
    "enableFeedback" BOOLEAN NOT NULL DEFAULT true,
    "enableReporting" BOOLEAN NOT NULL DEFAULT true,
    "enableAttachments" BOOLEAN NOT NULL DEFAULT true,
    "enableWebSearch" BOOLEAN NOT NULL DEFAULT false,
    "enableAPI" BOOLEAN NOT NULL DEFAULT false,
    "enablePlugins" BOOLEAN NOT NULL DEFAULT false,
    "enableCaching" BOOLEAN NOT NULL DEFAULT false,
    "enableAutoUpdate" BOOLEAN NOT NULL DEFAULT true,
    "enableTelemetry" BOOLEAN NOT NULL DEFAULT false,
    "enablePlagiarismCheck" BOOLEAN NOT NULL DEFAULT false,
    "enableWatermark" BOOLEAN NOT NULL DEFAULT true,
    "enableLearningGoals" BOOLEAN NOT NULL DEFAULT false,
    "enableAutoBackup" BOOLEAN NOT NULL DEFAULT false,
    "backupIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 30,
    CONSTRAINT "OrgSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kennisnetId" TEXT,
    "totpSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'nl',
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "storagePreference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nieuw gesprek',
    "folder" TEXT,
    "tags" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "isCollab" BOOLEAN NOT NULL DEFAULT false,
    "modelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentEncrypted" TEXT,
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "responseTimeMs" INTEGER,
    "watermarkKey" TEXT,
    "attachments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstalledModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "ollamaName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "size" BIGINT,
    "quantization" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "routingTier" TEXT NOT NULL DEFAULT 'standard',
    "maxConcurrent" INTEGER NOT NULL DEFAULT 2,
    "serverNode" TEXT,
    "version" TEXT,
    "previousVersions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstalledModel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeBase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeBase_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeBaseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastIndexedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "category" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_licenseKey_key" ON "Organization"("licenseKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_orgId_key" ON "OrgSettings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "User_orgId_email_key" ON "User"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_orgId_username_key" ON "User"("orgId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Group_orgId_name_key" ON "Group"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_shareToken_key" ON "Conversation"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledModel_orgId_ollamaName_key" ON "InstalledModel"("orgId", "ollamaName");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
