const fs = require('fs');
const path = require('path');
const chatFile = path.join(__dirname, 'server/src/api/routes/chat.ts');
let content = fs.readFileSync(chatFile, 'utf8');

const targetStr = `            let isThinkingPhase = false;`;

// We will split the file here
const startIndex = content.indexOf(targetStr);
const endStr = `            } catch (err: any) {`;
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

const replacement = `            let isThinkingPhase = false;
            let evalCount = 0;

            const handleChunk = (chunkContent: string) => {
              if (chunkContent) {
                if (assistantResponse === '') {
                  clearInterval(thinkingInterval);
                  connection.send(JSON.stringify({ type: 'thinking', message: null }));
                }

                const isWatermarkActive = Boolean(
                  orgSettings?.enableWatermark && 
                  orgSettings?.licenseTier && 
                  ['edu-plus', 'enterprise'].includes(orgSettings.licenseTier)
                );

                let streamedChunk = chunkContent;
                if (isWatermarkActive && /[.!?]\\s*$/.test(chunkContent)) {
                  streamedChunk += SENTENCE_SIGNATURE;
                }

                assistantResponse += streamedChunk;
                connection.send(JSON.stringify({ type: 'chunk', content: streamedChunk }));
              }
            };

            if (targetModelRecord && targetModelRecord.provider === 'openrouter') {
              if (!orgSettings?.openRouterApiKey) throw new Error("OpenRouter API key is niet geconfigureerd in de instellingen.");
              
              const client = new OpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: orgSettings.openRouterApiKey,
              });

              const messages = chatMsgs.map(m => ({ role: m.role as any, content: m.content }));
              messages.push({ role: 'user', content: prompt });
              messages.unshift({ role: 'system', content: finalSystemPrompt });

              const stream = await client.chat.completions.create({
                model: targetModel,
                messages,
                stream: true,
                ...(useThinking ? { reasoning: { enabled: true } } : {})
              } as any);

              for await (const chunk of stream) {
                let chunkContent = '';
                const delta = chunk.choices[0]?.delta as any;
                if (!delta) continue;
                
                if (delta.reasoning_details || delta.reasoning) {
                  if (!isThinkingPhase) {
                    chunkContent += '<think>\\n';
                    isThinkingPhase = true;
                  }
                  chunkContent += (delta.reasoning_details || delta.reasoning);
                }
                
                if (delta.content) {
                  if (isThinkingPhase) {
                    chunkContent += '\\n</think>\\n';
                    isThinkingPhase = false;
                  }
                  chunkContent += delta.content;
                }
                
                handleChunk(chunkContent);
              }
            } else {
              const res = await ollamaClient.generate(fullContext, targetModel, finalSystemPrompt, true, data.images, useThinking);
              if (!res.body) throw new Error('No response body from AI');
              
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\\n').filter(Boolean);
                
                for (const line of lines) {
                  const parsed = JSON.parse(line);
                  let chunkContent = '';
                  
                  if (parsed.thinking) {
                    if (!isThinkingPhase) {
                      chunkContent += '<think>\\n';
                      isThinkingPhase = true;
                    }
                    chunkContent += parsed.thinking;
                  }
                  
                  if (parsed.response) {
                    if (isThinkingPhase) {
                      chunkContent += '\\n</think>\\n';
                      isThinkingPhase = false;
                    }
                    chunkContent += parsed.response;
                  }
                  
                  handleChunk(chunkContent);
                  
                  if (parsed.done) {
                    evalCount = parsed.eval_count || 0;
                  }
                }
              }
            }

            // --- END OF STREAM LOGIC ---
            const responseTimeMs = Date.now() - streamStartTime;
            const metadata = {
              model: targetModel,
              responseTimeMs,
              tokensUsed: evalCount,
              tokensPerSecond: evalCount && responseTimeMs > 0 ? Math.round((evalCount / responseTimeMs) * 1000) : 0,
              storage: data.saveToServer !== false ? 'server' : 'local',
              ragUsed: ragUsed,
              routingMode: model === 'auto' ? 'auto' : 'manual'
            };

            if (orgSettings?.enableWatermark && orgSettings?.licenseTier && ['edu-plus', 'enterprise'].includes(orgSettings.licenseTier)) {
              assistantResponse = watermarkService.injectWatermark(
                assistantResponse,
                authUser.orgId,
                'Locra EDU'
              );
            }

            if (data.saveToServer !== false) {
              let finalAssContent = assistantResponse;
              let finalAssContentEncrypted = null;
              
              if (orgSettings?.enableE2EEncryption) {
                const { encryptMessage } = require('../../utils/crypto');
                finalAssContentEncrypted = encryptMessage(assistantResponse);
                finalAssContent = '[Versleuteld Bericht]';
              }

              const savedMsg = await prisma.message.create({
                data: {
                  conversationId,
                  userId: null,
                  role: 'assistant',
                  content: finalAssContent,
                  contentEncrypted: finalAssContentEncrypted,
                  modelUsed: targetModel,
                  responseTimeMs,
                  tokensUsed: evalCount
                }
              });
              connection.send(JSON.stringify({ type: 'done', messageId: savedMsg.id, metadata, model: targetModel, finalContent: assistantResponse }));

              const currentConv = await prisma.conversation.findUnique({ where: { id: conversationId } });
              const msgCount = await prisma.message.count({ where: { conversationId } });
              
              if (currentConv && (currentConv.title === 'Nieuw gesprek' || msgCount <= 3)) {
                try {
                  connection.send(JSON.stringify({ type: 'status', message: 'Titel wordt gegenereerd...' }));
                  const titlePrompt = \`Geef een korte, beschrijvende titel (max 6 woorden, GEEN aanhalingstekens) voor dit gesprek. Gebruiker vroeg: "\${prompt.substring(0, 200)}". Antwoord ALLEEN met de titel, niets anders.\`;
                  
                  // Auto title using the same target model
                  if (targetModelRecord && targetModelRecord.provider === 'openrouter') {
                    const client = new OpenAI({
                      baseURL: 'https://openrouter.ai/api/v1',
                      apiKey: orgSettings.openRouterApiKey,
                    });
                    const titleRes = await client.chat.completions.create({
                      model: targetModel,
                      messages: [{ role: 'user', content: titlePrompt }]
                    });
                    let generatedTitle = (titleRes.choices[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '').substring(0, 60);
                    if (generatedTitle && generatedTitle.length > 2) {
                      await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { title: generatedTitle }
                      });
                      connection.send(JSON.stringify({ type: 'title_update', conversationId, title: generatedTitle }));
                    }
                  } else {
                    const titleRes = await ollamaClient.generate(titlePrompt, targetModel, undefined, false);
                    const titleData = await titleRes.json();
                    let generatedTitle = (titleData.response || '').trim().replace(/^["']|["']$/g, '').substring(0, 60);
                    
                    if (generatedTitle && generatedTitle.length > 2) {
                      await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { title: generatedTitle }
                      });
                      connection.send(JSON.stringify({ type: 'title_update', conversationId, title: generatedTitle }));
                    }
                  }
                } catch (titleErr: any) {
                  fastify.log.warn(\`Auto-title generation failed: \${titleErr.message}\`);
                }
              }
            } else {
              connection.send(JSON.stringify({ type: 'done', metadata }));
            }

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(chatFile, content);
console.log("Successfully replaced chat logic");
