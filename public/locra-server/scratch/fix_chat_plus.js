const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/pages/chat/ChatLayout.tsx');
let content = fs.readFileSync(file, 'utf8');

const target = `<div style={{ position: 'relative' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowPlusMenu(!showPlusMenu)} 
                    className="btn btn-ghost" 
                    style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0, color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: showPlusMenu ? 'rotate(45deg)' : 'rotate(0deg)' }}
                    disabled={isGenerating || !activeConvId}
                    title="Extra opties"
                  >
                    ➕
                  </button>
                  
                  {showPlusMenu && (
                    <div className="animate-fade-in" style={{ 
                      position: 'absolute', 
                      bottom: '100%', 
                      left: 0, 
                      marginBottom: '1rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-surface-hover)',
                      borderRadius: '12px',
                      padding: '0.5rem',
                      minWidth: '220px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 9999
                    }}>
                      <button type="button" onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                        📎 Foto's & Bestanden toevoegen
                      </button>
                      <button type="button" onClick={() => { setUseThinkMode(!useThinkMode); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: useThinkMode ? '#c4b5fd' : 'inherit' }}>
                        {useThinkMode ? '✓' : '🧠'} Denkmodus inschakelen
                      </button>
                      <button type="button" onClick={() => { setShowSomtodayPanel(true); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                        ⚙️ SOMtoday Rooster inzien
                      </button>
                    </div>
                  )}
                </div>`;

const replacement = `<div style={{ position: 'relative' }}>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="btn btn-ghost" 
                    style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0, color: 'var(--text-secondary)' }}
                    disabled={isGenerating || !activeConvId}
                    title="Bestand toevoegen"
                  >
                    ➕
                  </button>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowPlusMenu(!showPlusMenu)} 
                    className="btn btn-ghost" 
                    style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%', flexShrink: 0, color: 'var(--text-secondary)' }}
                    disabled={isGenerating || !activeConvId}
                    title="Extra opties"
                  >
                    ⚙️
                  </button>
                  
                  {showPlusMenu && (
                    <div className="animate-fade-in" style={{ 
                      position: 'absolute', 
                      bottom: '100%', 
                      left: 0, 
                      marginBottom: '1rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-surface-hover)',
                      borderRadius: '12px',
                      padding: '0.5rem',
                      minWidth: '220px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      zIndex: 9999
                    }}>
                      <button type="button" onClick={() => { setUseThinkMode(!useThinkMode); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: useThinkMode ? '#c4b5fd' : 'inherit' }}>
                        {useThinkMode ? '✓' : '🧠'} Denkmodus inschakelen
                      </button>
                      <button type="button" onClick={() => { setShowSomtodayPanel(true); setShowPlusMenu(false); }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                        📅 SOMtoday Rooster inzien
                      </button>
                    </div>
                  )}
                </div>`;

// Standardize line endings before replace
const stdContent = content.replace(/\\r\\n/g, '\\n');
const stdTarget = target.replace(/\\r\\n/g, '\\n');

if (stdContent.includes(stdTarget)) {
  fs.writeFileSync(file, stdContent.replace(stdTarget, replacement));
  console.log("Replaced successfully.");
} else {
  console.log("Target not found!");
}
