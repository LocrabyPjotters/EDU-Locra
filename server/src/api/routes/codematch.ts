import { FastifyInstance } from 'fastify';
import { prisma } from '../../index';
import { requireAuth } from '../../middleware/auth';
import { generateToken, verifyToken } from '../../utils/crypto';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import { ollamaClient } from '../../services/ollama';
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API = 'https://api.github.com';

export default async function codematchRoutes(fastify: FastifyInstance) {

  // ── 1. Check CodeMatch Access ──────────────────────────
  fastify.get('/access', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const org = await prisma.orgSettings.findUnique({
        where: { orgId: request.user!.orgId }
      });

      if (!org || !org.enableCodeMatch) {
        return reply.status(403).send({ error: 'CodeMatch is uitgeschakeld voor deze organisatie.' });
      }

      if (org.codeMatchAccessMode === 'restricted') {
        const allowedClasses = JSON.parse(org.codeMatchAllowedClasses || '[]');
        const allowedGroups = JSON.parse(org.codeMatchAllowedGroups || '[]');
        
        if (!['admin', 'superadmin', 'teacher'].includes(request.user!.role)) {
          const userWithGroups = await prisma.user.findUnique({
            where: { id: request.user!.id },
            include: { groupMemberships: true, studentClasses: true }
          });
          
          const hasGroupAccess = userWithGroups?.groupMemberships.some(g => allowedGroups.includes(g.groupId));
          const hasClassAccess = userWithGroups?.studentClasses.some(c => allowedClasses.includes(c.classId));
          
          if (!hasGroupAccess && !hasClassAccess) {
            return reply.status(403).send({ error: 'Je hebt geen toegang tot CodeMatch.' });
          }
        }
      }

      // Check if GitHub is configured by admin
      const githubConfigured = !!(org.githubClientId && org.githubClientSecret);

      return { access: true, githubConfigured };
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: 'Interne server fout' });
    }
  });

  // ── 2. GitHub OAuth: Start Login ───────────────────────
  // Returns the GitHub authorize URL. Frontend redirects user there.
  fastify.get('/github/login', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const org = await prisma.orgSettings.findUnique({
        where: { orgId: request.user!.orgId }
      });

      if (!org?.githubClientId || !org?.githubClientSecret) {
        return reply.status(400).send({ 
          error: 'GitHub OAuth is niet geconfigureerd. Vraag je beheerder om dit in te stellen via het CodeMatch instellingenpaneel.' 
        });
      }

      // Determine the public-facing origin (important behind reverse proxies like Cloudflare or Vite dev proxy)
      const { origin } = request.query as { origin?: string };
      const forwardedProto = request.headers['x-forwarded-proto'] || request.protocol;
      const forwardedHost = request.headers['x-forwarded-host'] || request.hostname;
      const rawOrigin = origin || `${forwardedProto}://${forwardedHost}`;
      const publicOrigin = rawOrigin.replace(/\/$/, '');

      // Encode user identity and public origin in the state parameter (JWT) so the callback knows who it is and where to return
      const state = generateToken(
        { userId: request.user!.id, orgId: request.user!.orgId, origin: publicOrigin },
        300 // 5 min expiry
      );

      const params = new URLSearchParams({
        client_id: org.githubClientId,
        redirect_uri: `${publicOrigin}/api/codematch/github/callback`,
        scope: 'repo user:email read:org',
        state
      });

      return { url: `${GITHUB_AUTH_URL}?${params.toString()}` };
    } catch (error) {
      console.error('GitHub login error:', error);
      return reply.status(500).send({ error: 'Kon GitHub login niet starten.' });
    }
  });

  // ── 3. GitHub OAuth: Callback ──────────────────────────
  // This is called by GitHub after user authorizes. No Bearer token here — we use the state JWT.
  fastify.get('/github/callback', async (request, reply) => {
    let returnOrigin = '';
    try {
      const { code, state } = request.query as { code: string; state: string };

      if (!code || !state) {
        return reply.status(400).send({ error: 'Ontbrekende code of state parameter.' });
      }

      // Decode the state to get the user and origin
      let decoded: any;
      try {
        decoded = verifyToken(state);
        returnOrigin = decoded.origin || '';
      } catch {
        return reply.status(400).send({ error: 'Ongeldige of verlopen state. Probeer opnieuw in te loggen.' });
      }

      const { userId, orgId } = decoded;

      // Get the org's GitHub credentials
      const org = await prisma.orgSettings.findUnique({ where: { orgId } });
      if (!org?.githubClientId || !org?.githubClientSecret) {
        return reply.status(400).send({ error: 'GitHub OAuth configuratie ontbreekt.' });
      }

      // Exchange the code for an access token
      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: org.githubClientId,
          client_secret: org.githubClientSecret,
          code
        })
      });

      const tokenData = await tokenRes.json() as any;

      if (tokenData.error) {
        console.error('GitHub token exchange error:', tokenData);
        return reply.redirect(`${returnOrigin}/codematch?error=${encodeURIComponent('GitHub fout: ' + (tokenData.error_description || tokenData.error))}`);
      }

      const accessToken = tokenData.access_token;

      // Fetch the GitHub user profile
      const userRes = await fetch(`${GITHUB_API}/user`, {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Locra-CodeMatch'
        }
      });
      const githubUser = await userRes.json() as any;

      // Optionally check org membership
      if (org.codeMatchOrgRequirement) {
        const orgCheckRes = await fetch(
          `${GITHUB_API}/orgs/${org.codeMatchOrgRequirement}/members/${githubUser.login}`,
          { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Locra-CodeMatch' } }
        );
        if (orgCheckRes.status !== 204) {
          return reply.redirect(`${returnOrigin}/codematch?error=${encodeURIComponent(`Je moet lid zijn van de GitHub organisatie '${org.codeMatchOrgRequirement}'.`)}`);
        }
      }

      // Save the GitHub token and username to the user record
      await prisma.user.update({
        where: { id: userId },
        data: {
          githubToken: accessToken,
          githubUsername: githubUser.login
        }
      });

      // Redirect back to CodeMatch
      return reply.redirect(`${returnOrigin}/codematch?connected=true`);
    } catch (error) {
      console.error('GitHub callback error:', error);
      return reply.redirect(`${returnOrigin}/codematch?error=${encodeURIComponent('Er is een fout opgetreden bij het koppelen.')}`);
    }
  });

  // ── 4. GitHub: Disconnect ──────────────────────────────
  fastify.post('/github/disconnect', { preHandler: requireAuth }, async (request, reply) => {
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { githubToken: null, githubUsername: null }
    });
    return { success: true };
  });

  // ── 5. GitHub: Get Profile ─────────────────────────────
  fastify.get('/github/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) {
      return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });
    }

    const res = await fetch(`${GITHUB_API}/user`, {
      headers: { Authorization: `Bearer ${user.githubToken}`, 'User-Agent': 'Locra-CodeMatch' }
    });

    if (!res.ok) {
      // Token may be revoked
      await prisma.user.update({
        where: { id: request.user!.id },
        data: { githubToken: null, githubUsername: null }
      });
      return reply.status(401).send({ error: 'GitHub token verlopen. Koppel opnieuw.' });
    }

    return await res.json();
  });

  // ── 6. GitHub: List Repos ──────────────────────────────
  fastify.get('/github/repos', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { sort, per_page, page } = request.query as any;
    
    const params = new URLSearchParams({
      sort: sort || 'updated',
      per_page: per_page || '30',
      page: page || '1',
      affiliation: 'owner,collaborator'
    });

    const res = await fetch(`${GITHUB_API}/user/repos?${params}`, {
      headers: { Authorization: `Bearer ${user.githubToken}`, 'User-Agent': 'Locra-CodeMatch' }
    });

    if (!res.ok) return reply.status(res.status).send({ error: 'Kon repos niet ophalen.' });
    return await res.json();
  });

  // ── 7. GitHub: Create Repo ─────────────────────────────
  fastify.post('/github/repos', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { name, description, isPrivate } = request.body as any;

    const res = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Locra-CodeMatch'
      },
      body: JSON.stringify({
        name,
        description: description || `Created with Locra CodeMatch`,
        private: isPrivate ?? true,
        auto_init: true
      })
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return reply.status(res.status).send({ error: err.message || 'Kon repository niet aanmaken.' });
    }
    return await res.json();
  });

  // ── 8. GitHub: Get Repo Contents (file tree) ───────────
  fastify.get('/github/repos/:owner/:repo/contents', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { owner, repo } = request.params as { owner: string; repo: string };
    const { path: filePath, ref } = request.query as { path?: string; ref?: string };

    const apiPath = filePath ? `/repos/${owner}/${repo}/contents/${filePath}` : `/repos/${owner}/${repo}/contents`;
    const params = ref ? `?ref=${ref}` : '';

    const res = await fetch(`${GITHUB_API}${apiPath}${params}`, {
      headers: { Authorization: `Bearer ${user.githubToken}`, 'User-Agent': 'Locra-CodeMatch' }
    });

    if (!res.ok) {
      return reply.status(res.status).send({ error: 'Kon bestandsinhoud niet ophalen.' });
    }
    return await res.json();
  });

  // ── 9. GitHub: Get File Content ────────────────────────
  fastify.get('/github/repos/:owner/:repo/file', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { owner, repo } = request.params as { owner: string; repo: string };
    const { path: filePath } = request.query as { path: string };

    if (!filePath) return reply.status(400).send({ error: 'Pad is verplicht.' });

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: { 
        Authorization: `Bearer ${user.githubToken}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Locra-CodeMatch' 
      }
    });

    if (!res.ok) return reply.status(res.status).send({ error: 'Bestand niet gevonden.' });
    
    const data = await res.json() as any;
    
    // Decode base64 content
    const content = data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : '';
    
    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      content,
      encoding: 'utf-8'
    };
  });

  // ── 10. GitHub: Update/Create File ─────────────────────
  fastify.put('/github/repos/:owner/:repo/file', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { owner, repo } = request.params as { owner: string; repo: string };
    const { path: filePath, content, message, sha } = request.body as {
      path: string;
      content: string;
      message?: string;
      sha?: string; // Required for updates, not for creates
    };

    if (!filePath || content === undefined) {
      return reply.status(400).send({ error: 'Pad en inhoud zijn verplicht.' });
    }

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${user.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Locra-CodeMatch'
      },
      body: JSON.stringify({
        message: message || `Update ${filePath} via Locra CodeMatch`,
        content: Buffer.from(content).toString('base64'),
        ...(sha && { sha })
      })
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return reply.status(res.status).send({ error: err.message || 'Kon bestand niet opslaan.' });
    }
    return await res.json();
  });

  // ── 11. GitHub: Delete File ────────────────────────────
  fastify.delete('/github/repos/:owner/:repo/file', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { owner, repo } = request.params as { owner: string; repo: string };
    const { path: filePath, sha, message } = request.body as { path: string; sha: string; message?: string };

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Locra-CodeMatch'
      },
      body: JSON.stringify({
        message: message || `Delete ${filePath} via Locra CodeMatch`,
        sha
      })
    });

    if (!res.ok) {
      const err = await res.json() as any;
      return reply.status(res.status).send({ error: err.message || 'Kon bestand niet verwijderen.' });
    }
    return { success: true };
  });

  // ── 12. GitHub: Get Repo Tree (recursive) ──────────────
  fastify.get('/github/repos/:owner/:repo/tree', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.githubToken) return reply.status(401).send({ error: 'GitHub niet gekoppeld.' });

    const { owner, repo } = request.params as { owner: string; repo: string };
    const { ref } = request.query as { ref?: string };

    const branch = ref || 'main';

    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      headers: { Authorization: `Bearer ${user.githubToken}`, 'User-Agent': 'Locra-CodeMatch' }
    });

    if (!res.ok) {
      // Probeer 'master' als 'main' niet bestaat
      const res2 = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/master?recursive=1`, {
        headers: { Authorization: `Bearer ${user.githubToken}`, 'User-Agent': 'Locra-CodeMatch' }
      });
      if (!res2.ok) return reply.status(404).send({ error: 'Kon bestanden niet ophalen.' });
      return await res2.json();
    }
    return await res.json();
  });

  // ── 13. GitHub: AI Chat ───────────────────────────────
  fastify.post('/github/chat', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    const orgSettings = await prisma.orgSettings.findUnique({ where: { orgId: user!.orgId! } });
    const { content, systemPrompt, model, conversationId } = request.body as any;

    let targetConvId = conversationId;
    if (!targetConvId || targetConvId.startsWith('codematch-')) {
      const newConv = await prisma.conversation.create({
        data: {
          userId: user!.id,
          title: content.slice(0, 30) + '...',
          folder: 'CodeMatch',
          modelId: model || 'default'
        }
      });
      targetConvId = newConv.id;
    }

    // save user message
    await prisma.message.create({
      data: {
        conversationId: targetConvId,
        content: content,
        role: 'user',
      }
    });

    const targetModelRecord = await prisma.installedModel.findFirst({
      where: { orgId: user!.orgId!, ollamaName: model, isActive: true }
    }) || await prisma.installedModel.findFirst({
      where: { orgId: user!.orgId!, isActive: true, isDefault: true }
    });

    const provider = targetModelRecord?.provider || 'ollama';
    let assistantResponse = '';

    // fetch past messages
    const pastMessages = await prisma.message.findMany({
      where: { conversationId: targetConvId },
      orderBy: { createdAt: 'asc' },
      take: 10
    });
    
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...pastMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    if (provider === 'openrouter' || provider === 'openai' || provider === 'anthropic') {
       let apiKey: string | undefined;
       let baseURL = 'https://api.openai.com/v1';
       if (provider === 'openrouter') {
         apiKey = orgSettings?.openRouterApiKey || undefined;
         baseURL = 'https://openrouter.ai/api/v1';
       } else if (provider === 'openai') {
         apiKey = orgSettings?.openAiApiKey || undefined;
       } else if (provider === 'anthropic') {
         apiKey = orgSettings?.anthropicApiKey || undefined;
         baseURL = 'https://api.anthropic.com'; 
       }
       if (!apiKey) return reply.status(400).send({ error: 'API key niet ingesteld.' });
       
       const client = new OpenAI({ baseURL, apiKey });
       const chatCompletion = await client.chat.completions.create({
          model: targetModelRecord!.ollamaName,
          messages: apiMessages as any
       });
       assistantResponse = chatCompletion.choices[0].message.content || '';
    } else {
       // Ollama (stream: false for simple REST response)
       const res = await ollamaClient.generate(content, targetModelRecord?.ollamaName || 'llama3', systemPrompt, false);
       if (res.ok) {
         const data = await res.json();
         assistantResponse = data.response;
       } else {
         return reply.status(500).send({ error: 'Ollama generate mislukt' });
       }
    }
    
    // save assistant message
    await prisma.message.create({
      data: {
        conversationId: targetConvId,
        content: assistantResponse,
        role: 'assistant',
      }
    });

    return { reply: assistantResponse, conversationId: targetConvId };
  });
}
