import { useState, useEffect } from 'react';
import {
  ArrowLeft, Download, Eye, Save, Sparkles, Check, RotateCcw, Edit2, Settings, X, Plus, BookOpen,
  Users, AlertTriangle, CheckCircle2, Flag, ExternalLink
} from 'lucide-react';

interface Props {
  sessionId: string;
  token: string;
  onBack: () => void;
}

export default function SlimCheckResults({ sessionId, token, onBack }: Props) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScanIndex, setSelectedScanIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // View mode tab: 'students' (per-student grading) or 'review' (dedicated manual review queue)
  const [viewTab, setViewTab] = useState<'students' | 'review'>('students');

  // Re-grading state
  const [isReGrading, setIsReGrading] = useState(false);
  const [reGradeProgress, setReGradeProgress] = useState<{ step: string; percent: number; message: string } | null>(null);

  // Settings dropdown state (return toggles)
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [returnGrade, setReturnGrade] = useState(true);
  const [returnFeedback, setReturnFeedback] = useState(false);
  const [returnScan, setReturnScan] = useState(false);
  const [returnModelAnswer, setReturnModelAnswer] = useState(false);

  // Uploading PDF attachments
  const [uploadingAssignment, setUploadingAssignment] = useState(false);
  const [uploadingRubric, setUploadingRubric] = useState(false);

  // Edit question model answer state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editPromptText, setEditPromptText] = useState('');
  const [editModelAnswer, setEditModelAnswer] = useState('');
  const [editQuestionNotes, setEditQuestionNotes] = useState('');
  const [editMaxPoints, setEditMaxPoints] = useState(1);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Editable responses state: Map<responseId, { finalPoints: number; teacherNote: string; aiFeedback?: string; needsReview?: boolean }>
  const [editedResponses, setEditedResponses] = useState<Record<string, { finalPoints: number; teacherNote: string; aiFeedback?: string; needsReview?: boolean }>>({});

  const loadSessionData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        setReturnGrade(data.returnGrade ?? true);
        setReturnFeedback(data.returnFeedback ?? false);
        setReturnScan(data.returnScan ?? false);
        setReturnModelAnswer(data.returnModelAnswer ?? false);

        // Pre-fill edits map
        const initialEdits: Record<string, { finalPoints: number; teacherNote: string; aiFeedback?: string; needsReview?: boolean }> = {};
        for (const scan of data.scans || []) {
          for (const resp of scan.responses || []) {
            initialEdits[resp.id] = {
              finalPoints: resp.finalPoints ?? resp.aiPoints ?? 0,
              teacherNote: resp.teacherNote || '',
              aiFeedback: resp.aiFeedback || '',
              needsReview: resp.needsReview ?? false
            };
          }
        }
        setEditedResponses(initialEdits);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const handleResolveReviewItem = async (responseId: string, points: number, note?: string) => {
    try {
      await fetch(`/api/slimcheck/responses/${responseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          finalPoints: points,
          teacherNote: note,
          needsReview: false
        })
      });
      setEditedResponses(prev => ({
        ...prev,
        [responseId]: {
          ...prev[responseId],
          finalPoints: points,
          teacherNote: note ?? prev[responseId]?.teacherNote ?? '',
          needsReview: false
        }
      }));
      await loadSessionData();
    } catch {
      alert('Opslaan van beoordeling mislukt');
    }
  };

  const handlePointChange = (responseId: string, val: number) => {
    setEditedResponses(prev => ({
      ...prev,
      [responseId]: {
        ...prev[responseId],
        finalPoints: val
      }
    }));
  };

  const handleNoteChange = (responseId: string, val: string) => {
    setEditedResponses(prev => ({
      ...prev,
      [responseId]: {
        ...prev[responseId],
        teacherNote: val
      }
    }));
  };

  // Save all inline adjustments
  const handleSaveAllEdits = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(editedResponses).map(([id, edit]) =>
        fetch(`/api/slimcheck/responses/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(edit)
        })
      );
      await Promise.all(promises);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadSessionData();
    } catch {
      alert('Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  // Re-run AI grading pipeline (either for all students or for a single student)
  const handleReRunGrading = async (scanId?: string) => {
    const isSingle = !!scanId;
    const msg = isSingle
      ? 'Weet je zeker dat je deze specifieke toetsscan opnieuw wilt laten beoordelen door de AI?'
      : 'Weet je zeker dat je alle toetsen opnieuw wilt laten nakijken door de AI?\n\nDe AI zal alle antwoorden opnieuw analyseren en beoordelen op basis van het huidige correctiemodel. Je kunt daarna alle punten en feedback weer handmatig bijsturen.';

    if (!confirm(msg)) return;

    setIsReGrading(true);
    setReGradeProgress({ step: 'start', percent: 5, message: isSingle ? 'Her-nakijken van leerling gestart...' : 'AI Nakijk-pipeline gestart...' });

    try {
      const url = isSingle
        ? `/api/slimcheck/sessions/${sessionId}/process?scanId=${scanId}`
        : `/api/slimcheck/sessions/${sessionId}/process`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Herstarten mislukt' }));
        throw new Error(err.error || 'Kon pipeline niet herstarten');
      }

      // Poll status until done
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/slimcheck/sessions/${sessionId}/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.progress) {
              setReGradeProgress(statusData.progress);
              if (statusData.progress.step === 'done' || statusData.status === 'review' || statusData.status === 'done') {
                clearInterval(poll);
                setIsReGrading(false);
                await loadSessionData();
              } else if (statusData.progress.step === 'error') {
                clearInterval(poll);
                setIsReGrading(false);
                alert('Fout tijdens AI nakijken: ' + statusData.progress.message);
              }
            }
          }
        } catch {
          // continue polling
        }
      }, 1500);
    } catch (e: any) {
      setIsReGrading(false);
      alert(e.message || 'Kon nakijken niet starten');
    }
  };

  // Update question prompt and model answer directly
  const handleSaveQuestionModel = async (questionId: string, reGradeAfter: boolean = false) => {
    setSavingQuestion(true);
    try {
      const res = await fetch(`/api/slimcheck/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          promptText: editPromptText,
          modelAnswer: editModelAnswer,
          notes: editQuestionNotes,
          maxPoints: editMaxPoints
        })
      });

      if (res.ok) {
        setEditingQuestionId(null);
        await loadSessionData();
        if (reGradeAfter) {
          handleReRunGrading();
        }
      } else {
        alert('Kon modelantwoord niet opslaan');
      }
    } catch {
      alert('Fout bij opslaan modelantwoord');
    } finally {
      setSavingQuestion(false);
    }
  };

  // Add new question to session
  const handleAddNewQuestion = async () => {
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/questions/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          promptText: '',
          modelAnswer: 'Juist antwoord',
          maxPoints: 2,
          notes: ''
        })
      });
      if (res.ok) {
        await loadSessionData();
        alert('Nieuwe vraag toegevoegd! Pas het modelantwoord aan en klik op "Opnieuw nakijken" om de AI deze vraag te laten scoren.');
      }
    } catch {
      alert('Kon vraag niet toevoegen');
    }
  };

  // Upload or replace Assignment PDF
  const handleUploadAssignment = async (file: File) => {
    setUploadingAssignment(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/assignment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        await loadSessionData();
        alert('Opgaven PDF succesvol gekoppeld! De AI heeft nu volledige context van de vragen.');
      } else {
        alert('Upload mislukt');
      }
    } catch {
      alert('Upload mislukt');
    } finally {
      setUploadingAssignment(false);
    }
  };

  // Upload or replace Correctiemodel PDF
  const handleUploadRubric = async (file: File) => {
    setUploadingRubric(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/rubric`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        await loadSessionData();
        if (confirm(`Correctiemodel PDF geanalyseerd (${data.questions?.length || 0} vragen gevonden).\n\nWil je alle toetsen direct opnieuw laten nakijken door de AI met dit nieuwe correctiemodel?`)) {
          handleReRunGrading();
        }
      } else {
        alert('Upload van correctiemodel mislukt');
      }
    } catch {
      alert('Upload mislukt');
    } finally {
      setUploadingRubric(false);
    }
  };

  // Save session return settings
  const handleSaveSettings = async (newReturnGrade: boolean, newReturnFeedback: boolean, newReturnScan: boolean, newReturnModelAnswer: boolean) => {
    setReturnGrade(newReturnGrade);
    setReturnFeedback(newReturnFeedback);
    setReturnScan(newReturnScan);
    setReturnModelAnswer(newReturnModelAnswer);

    try {
      await fetch(`/api/slimcheck/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          returnGrade: newReturnGrade,
          returnFeedback: newReturnFeedback,
          returnScan: newReturnScan,
          returnModelAnswer: newReturnModelAnswer
        })
      });
      await loadSessionData();
    } catch {
      alert('Kon instellingen niet bijwerken');
    }
  };

  // Publish / Re-publish session to students
  const handlePublish = async () => {
    const isAlready = session?.isPublished;
    const msg = isAlready
      ? 'De resultaten zijn al gepubliceerd. Wil je de huidige (aangepaste) punten en feedback opnieuw doorvoeren naar de leerlingen en cijferlijst?'
      : 'Weet u zeker dat u de resultaten wilt publiceren naar de leerlingen?';

    if (!confirm(msg)) return;

    try {
      // First save any unsaved edits
      await handleSaveAllEdits();

      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPublishSuccess(true);
        setTimeout(() => setPublishSuccess(false), 4000);
        await loadSessionData();
      }
    } catch {
      alert('Publiceren mislukt');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/export/pdf?token=${token}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('PDF export mislukt');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SlimCheck_Rapport_${(session?.title || 'rapport').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Kon PDF rapport niet downloaden');
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const res = await fetch(`/api/slimcheck/sessions/${sessionId}/export/csv?token=${token}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('CSV export mislukt');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SlimCheck_Export_${(session?.title || 'rapport').replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Kon CSV export niet downloaden');
    }
  };

  if (loading && !session) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        Resultaten inladen...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Sessie niet gevonden.</p>
        <button onClick={onBack} style={{ background: '#7c5cfc', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
          Terug naar overzicht
        </button>
      </div>
    );
  }

  const scans = session.scans || [];
  const currentScan = scans[selectedScanIndex] || null;
  const totalMaxScore = session.questions?.reduce((sum: number, q: any) => sum + q.maxPoints, 0) || session.totalMaxScore || 1;

  // Calculate student total with edits
  const currentStudentEarned = (currentScan?.responses || []).reduce((sum: number, r: any) => {
    const edit = editedResponses[r.id];
    return sum + (edit !== undefined ? edit.finalPoints : (r.finalPoints ?? r.aiPoints ?? 0));
  }, 0);

  const calculatedGrade = totalMaxScore > 0
    ? Math.max(1.0, Math.min(10.0, parseFloat(((currentStudentEarned / totalMaxScore) * 9 + 1).toFixed(1))))
    : 0;

  // Find all responses that need manual review across all scans
  const reviewQueue = (session?.scans || []).flatMap((scan: any) =>
    (scan.responses || [])
      .filter((r: any) => {
        const edit = editedResponses[r.id];
        const isNeedsReview = edit?.needsReview !== undefined ? edit.needsReview : r.needsReview;
        return isNeedsReview || r.finalPoints === null;
      })
      .map((r: any) => ({
        ...r,
        studentName: scan.student?.displayName || `Leerling #${scan.anonIndex + 1}`,
        studentId: scan.studentId,
        scanId: scan.id,
        anonIndex: scan.anonIndex
      }))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Re-grading Progress Banner */}
      {isReGrading && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(56, 189, 248, 0.15))',
          border: '1px solid #7c5cfc',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 0 25px rgba(124, 92, 252, 0.25)'
        }}>
          <RotateCcw size={24} color="#c4b5fd" style={{ animation: 'spin 1.5s linear infinite' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              AI Nakijken bezig: {reGradeProgress?.message || 'Bezig met analyseren van antwoorden...'}
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ width: `${reGradeProgress?.percent || 10}%`, height: '100%', background: 'linear-gradient(90deg, #7c5cfc, #38bdf8)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#c4b5fd' }}>
            {reGradeProgress?.percent || 0}%
          </span>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} /> Overzicht
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {session.title}
              </h2>
              {session.isPublished && (
                <span style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', color: '#34d399', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                  Gepubliceerd
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span>Vak: {session.subject || 'Algemeen'} • Klas: {session.class?.name || '-'} • Max score: {totalMaxScore} pt</span>

              {/* Assignment PDF indicator / uploader */}
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', background: session.assignmentPdfName ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem' }}>
                <input
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  disabled={uploadingAssignment}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAssignment(f);
                  }}
                />
                <BookOpen size={12} />
                <span>{uploadingAssignment ? 'Uploaden...' : session.assignmentPdfName ? `Opgaven: ${session.assignmentPdfName}` : '+ Opgaven PDF'}</span>
              </label>

              {/* Rubric PDF indicator / uploader */}
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', background: session.rubricPdfName ? 'rgba(124, 92, 252, 0.18)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(124,92,252,0.35)', color: '#c4b5fd', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem' }}>
                <input
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  disabled={uploadingRubric}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadRubric(f);
                  }}
                />
                <Sparkles size={12} />
                <span>{uploadingRubric ? 'Uploaden...' : session.rubricPdfName ? `Correctiemodel: ${session.rubricPdfName}` : '+ Correctiemodel PDF'}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Add Question Button */}
          <button
            onClick={handleAddNewQuestion}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              padding: '9px 13px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Voeg een extra vraag toe aan deze sessie"
          >
            <Plus size={16} /> Vraag toevoegen
          </button>

          {/* Re-run Grading Button */}
          <button
            onClick={() => handleReRunGrading()}
            disabled={isReGrading}
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              padding: '9px 15px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: isReGrading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            title="Laat de AI alle toetsen opnieuw nakijken op basis van het huidige correctiemodel"
          >
            <RotateCcw size={16} style={isReGrading ? { animation: 'spin 1.5s linear infinite' } : {}} />
            {isReGrading ? 'Nakijken bezig...' : 'Alle toetsen opnieuw nakijken'}
          </button>

          {/* Save All Edits */}
          <button
            onClick={handleSaveAllEdits}
            disabled={saving}
            style={{
              background: saveSuccess ? '#34d399' : 'rgba(124, 92, 252, 0.2)',
              border: '1px solid rgba(124, 92, 252, 0.4)',
              color: saveSuccess ? '#0a0e1a' : '#c4b5fd',
              padding: '9px 16px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            {saveSuccess ? 'Opgeslagen!' : 'Wijzigingen opslaan'}
          </button>

          {/* Settings / Return Toggles Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              style={{
                background: showSettingsDropdown ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '9px 12px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Terugkoppeling-instellingen naar leerlingen"
            >
              <Settings size={16} /> Instellingen
            </button>

            {/* Dropdown menu */}
            {showSettingsDropdown && (
              <div style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: '280px',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '14px',
                padding: '16px',
                boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>Leerlinginzage Opties</span>
                  <button onClick={() => setShowSettingsDropdown(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={returnGrade}
                    onChange={e => handleSaveSettings(e.target.checked, returnFeedback, returnScan, returnModelAnswer)}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <span>Cijfer / score tonen</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={returnFeedback}
                    onChange={e => handleSaveSettings(returnGrade, e.target.checked, returnScan, returnModelAnswer)}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <span>Feedback per vraag tonen</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={returnScan}
                    onChange={e => handleSaveSettings(returnGrade, returnFeedback, e.target.checked, returnModelAnswer)}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <span>Geredacteerde toetsscan tonen</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={returnModelAnswer}
                    onChange={e => handleSaveSettings(returnGrade, returnFeedback, returnScan, e.target.checked)}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <span>Modelantwoord tonen</span>
                </label>
              </div>
            )}
          </div>

          <button
            onClick={handleDownloadPdf}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '9px 14px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={16} /> PDF
          </button>

          <button
            onClick={handleDownloadCsv}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '9px 14px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={16} /> CSV
          </button>

          {/* Publish / Re-publish Button */}
          <button
            onClick={handlePublish}
            style={{
              background: publishSuccess ? '#34d399' : session.isPublished ? 'rgba(52, 211, 153, 0.2)' : 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
              color: session.isPublished ? '#34d399' : '#fff',
              border: session.isPublished ? '1px solid #34d399' : 'none',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {publishSuccess ? <Check size={16} /> : session.isPublished ? <Check size={16} /> : <Sparkles size={16} />}
            {publishSuccess ? 'Doorgevoerd!' : session.isPublished ? 'Herpubliceren & syncen' : 'Publiceren'}
          </button>
        </div>
      </div>

      {/* View Mode Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(17, 24, 39, 0.6)',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setViewTab('students')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: viewTab === 'students' ? '1px solid #7c5cfc' : '1px solid transparent',
              background: viewTab === 'students' ? 'rgba(124, 92, 252, 0.25)' : 'transparent',
              color: viewTab === 'students' ? '#c4b5fd' : '#94a3b8',
              transition: 'all 0.15s'
            }}
          >
            <Users size={16} />
            Per Leerling Nakijken ({scans.length})
          </button>

          <button
            type="button"
            onClick={() => setViewTab('review')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: viewTab === 'review' ? '1px solid #f59e0b' : '1px solid transparent',
              background: viewTab === 'review' ? 'rgba(245, 158, 11, 0.22)' : 'transparent',
              color: viewTab === 'review' ? '#fbbf24' : '#94a3b8',
              transition: 'all 0.15s'
            }}
          >
            <AlertTriangle size={16} />
            Handmatige Review & Twijfelgevallen
            {reviewQueue.length > 0 ? (
              <span style={{
                background: '#f59e0b',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.74rem',
                fontWeight: 800,
                marginLeft: '4px'
              }}>
                {reviewQueue.length}
              </span>
            ) : (
              <span style={{
                background: 'rgba(52, 211, 153, 0.2)',
                color: '#34d399',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.74rem',
                fontWeight: 700,
                marginLeft: '4px'
              }}>
                0 open
              </span>
            )}
          </button>
        </div>

        {viewTab === 'review' && reviewQueue.length > 0 && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', paddingRight: '12px' }}>
            💡 Bekijk hier alle antwoorden waar de AI over twijfelde of geen zeker oordeel kon vellen.
          </div>
        )}
      </div>

      {viewTab === 'students' ? (
        /* Main Grid: Student List (Left) + Question Review (Right) */
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left: Students Sidebar */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', padding: '4px 8px', textTransform: 'uppercase' }}>
            Leerlingen ({scans.length})
          </div>

          {scans.map((scan: any, idx: number) => {
            const isSelected = selectedScanIndex === idx;
            const studentEarned = (scan.responses || []).reduce((sum: number, r: any) => {
              const edit = editedResponses[r.id];
              return sum + (edit !== undefined ? edit.finalPoints : (r.finalPoints ?? r.aiPoints ?? 0));
            }, 0);
            const studentGrade = totalMaxScore > 0
              ? Math.max(1.0, Math.min(10.0, parseFloat(((studentEarned / totalMaxScore) * 9 + 1).toFixed(1))))
              : '-';

            return (
              <button
                key={scan.id}
                onClick={() => setSelectedScanIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(124, 92, 252, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid rgba(124, 92, 252, 0.4)' : '1px solid transparent',
                  color: isSelected ? '#c4b5fd' : '#e2e8f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isSelected ? '#7c5cfc' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {scan.student?.displayName || `Leerling #${idx + 1}`}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Pagina {scan.startPage} - {scan.endPage}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: (typeof studentGrade === 'number' && studentGrade >= 5.5) ? '#34d399' : '#f87171' }}>
                    {studentGrade}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {studentEarned}/{totalMaxScore} pt
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Selected Student Details & Questions Table */}
        {currentScan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Student Header Card */}
            <div style={{
              background: 'rgba(17, 24, 39, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Geselecteerde leerling
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                  {currentScan.student?.displayName || `Anonieme Toets #${currentScan.anonIndex + 1}`}
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Locra ID: {currentScan.studentId || '(Niet gekoppeld via mapping)'} • Scans: p.{currentScan.startPage} t/m p.{currentScan.endPage}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleReRunGrading(currentScan.id)}
                  disabled={isReGrading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(124, 92, 252, 0.15)',
                    border: '1px solid rgba(124, 92, 252, 0.4)',
                    color: '#c4b5fd',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: isReGrading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s'
                  }}
                  title="Laat de AI specifiek deze toetsscan opnieuw controleren"
                >
                  <RotateCcw size={14} style={isReGrading ? { animation: 'spin 1.5s linear infinite' } : {}} />
                  {isReGrading ? 'Nakijken...' : 'Deze leerling opnieuw nakijken'}
                </button>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Totaalscore</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c4b5fd' }}>
                    {currentStudentEarned} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/ {totalMaxScore}</span>
                  </div>
                </div>

                <div style={{
                  background: calculatedGrade >= 5.5 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${calculatedGrade >= 5.5 ? '#34d399' : '#ef4444'}`,
                  borderRadius: '14px',
                  padding: '8px 18px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.7rem', color: calculatedGrade >= 5.5 ? '#34d399' : '#f87171', fontWeight: 700 }}>CIJFER</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: calculatedGrade >= 5.5 ? '#34d399' : '#f87171' }}>
                    {calculatedGrade}
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Grading Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(currentScan.responses || []).map((resp: any) => {
                const qNum = resp.question?.number || 1;
                const maxPts = resp.question?.maxPoints || 1;
                const currentEdit = editedResponses[resp.id] || {
                  finalPoints: resp.finalPoints ?? resp.aiPoints ?? 0,
                  teacherNote: resp.teacherNote || '',
                  needsReview: resp.needsReview ?? false,
                  aiFeedback: resp.aiFeedback || ''
                };

                return (
                  <div
                    key={resp.id}
                    style={{
                      background: 'rgba(17, 24, 39, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                  >
                    {/* Handmatige Review Banner if flagged */}
                    {(currentEdit.needsReview || resp.needsReview) && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.84rem', fontWeight: 600 }}>
                          <AlertTriangle size={18} />
                          <span>Handmatige review vereist: AI kon dit antwoord niet met zekerheid beoordelen.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = currentEdit.needsReview !== undefined ? currentEdit.needsReview : resp.needsReview;
                            setEditedResponses(prev => ({
                              ...prev,
                              [resp.id]: {
                                ...prev[resp.id],
                                needsReview: !cur
                              }
                            }));
                          }}
                          style={{
                            background: 'rgba(245, 158, 11, 0.25)',
                            border: '1px solid #f59e0b',
                            color: '#fef3c7',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Markering opheffen
                        </button>
                      </div>
                    )}

                    {/* Question Header & Points Input */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: '#7c5cfc',
                          color: '#fff',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}>
                          {qNum}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>Vraag {qNum}</span>
                        {resp.confidence && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                            OCR zekerheid: {Math.round(resp.confidence * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Points Quick Controls & Edit */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Punten:</span>

                        {/* Flag for manual review button */}
                        <button
                          type="button"
                          onClick={() => {
                            const cur = currentEdit.needsReview !== undefined ? currentEdit.needsReview : resp.needsReview;
                            setEditedResponses(prev => ({
                              ...prev,
                              [resp.id]: {
                                ...prev[resp.id],
                                needsReview: !cur
                              }
                            }));
                          }}
                          style={{
                            background: (currentEdit.needsReview !== undefined ? currentEdit.needsReview : resp.needsReview)
                              ? 'rgba(245, 158, 11, 0.25)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${(currentEdit.needsReview !== undefined ? currentEdit.needsReview : resp.needsReview) ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: (currentEdit.needsReview !== undefined ? currentEdit.needsReview : resp.needsReview) ? '#fbbf24' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Markeer als twijfelgeval voor handmatige controle"
                        >
                          <Flag size={11} />
                          {(currentEdit.needsReview !== undefined ? currentEdit.needsReview : resp.needsReview) ? 'Review actief' : 'Twijfel'}
                        </button>

                        {/* Quick score pills */}
                        <button
                          type="button"
                          onClick={() => handlePointChange(resp.id, 0)}
                          style={{
                            background: currentEdit.finalPoints === 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${currentEdit.finalPoints === 0 ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                            color: currentEdit.finalPoints === 0 ? '#fca5a5' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer'
                          }}
                        >
                          0 pt
                        </button>
                        {maxPts > 1 && (
                          <button
                            type="button"
                            onClick={() => handlePointChange(resp.id, parseFloat((maxPts / 2).toFixed(1)))}
                            style={{
                              background: currentEdit.finalPoints === maxPts / 2 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${currentEdit.finalPoints === maxPts / 2 ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                              color: currentEdit.finalPoints === maxPts / 2 ? '#7dd3fc' : '#94a3b8',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              cursor: 'pointer'
                            }}
                          >
                            Half ({maxPts / 2} pt)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePointChange(resp.id, maxPts)}
                          style={{
                            background: currentEdit.finalPoints === maxPts ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${currentEdit.finalPoints === maxPts ? '#34d399' : 'rgba(255,255,255,0.1)'}`,
                            color: currentEdit.finalPoints === maxPts ? '#86efac' : '#94a3b8',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer'
                          }}
                        >
                          Vol ({maxPts} pt)
                        </button>

                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={maxPts}
                          value={currentEdit.finalPoints}
                          onChange={e => handlePointChange(resp.id, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '64px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: '#0a0e1a',
                            border: '1px solid #7c5cfc',
                            color: '#fff',
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '0.95rem',
                            marginLeft: '4px'
                          }}
                        />
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>/ {maxPts}</span>
                      </div>
                    </div>

                    {/* 📝 Opgavetekst (wat de leerling zag) */}
                    {resp.question?.promptText && (
                      <div style={{
                        background: 'rgba(99, 102, 241, 0.08)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          📝 Opgave (wat de leerling zag)
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#e0e7ff', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                          {resp.question.promptText}
                        </div>
                      </div>
                    )}

                    {/* 🎯 CORRECTIEMODEL BOX (MODELANTWOORD) */}
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.07)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      border: '1px solid rgba(56, 189, 248, 0.25)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            🎯 Antwoord volgens correctiemodel
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>
                            Max {maxPts} pt
                          </span>
                        </div>

                        {/* Edit model answer toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            if (editingQuestionId === resp.question?.id) {
                              setEditingQuestionId(null);
                            } else {
                              setEditingQuestionId(resp.question?.id || null);
                              setEditPromptText(resp.question?.promptText || '');
                              setEditModelAnswer(resp.question?.modelAnswer || '');
                              setEditQuestionNotes(resp.question?.notes || '');
                              setEditMaxPoints(resp.question?.maxPoints || 1);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '6px'
                          }}
                          title="Pas de opgave, het modelantwoord of instructies voor deze vraag aan"
                        >
                          <Edit2 size={12} /> {editingQuestionId === resp.question?.id ? 'Sluiten' : 'Vraag & model aanpassen'}
                        </button>
                      </div>

                      {/* Inline Question & Model Answer Editor */}
                      {editingQuestionId === resp.question?.id ? (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>
                              📝 Opgavetekst (wat de leerling zag):
                            </label>
                            <textarea
                              value={editPromptText}
                              onChange={e => setEditPromptText(e.target.value)}
                              rows={2}
                              placeholder="Bijv. Vraag 1: Bereken de hoek in driehoek ABC..."
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: '#0a0e1a',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                color: '#fff',
                                fontSize: '0.85rem',
                                resize: 'vertical',
                                lineHeight: 1.4
                              }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>
                                🎯 Modelantwoord / steekwoorden:
                              </label>
                              <textarea
                                value={editModelAnswer}
                                onChange={e => setEditModelAnswer(e.target.value)}
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: '#0a0e1a',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  color: '#fff',
                                  fontSize: '0.85rem',
                                  resize: 'vertical',
                                  lineHeight: 1.4
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>
                                Max pt:
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                value={editMaxPoints}
                                onChange={e => setEditMaxPoints(parseFloat(e.target.value) || 1)}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: '#0a0e1a',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                  color: '#fff',
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                  textAlign: 'center'
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>
                              💡 Instructies / criteria voor de AI (rubric regels):
                            </label>
                            <input
                              type="text"
                              value={editQuestionNotes}
                              onChange={e => setEditQuestionNotes(e.target.value)}
                              placeholder="Bijv. minteken niet vergeten, rekenfout is -1 pt"
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: '#0a0e1a',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                fontSize: '0.8rem'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setEditingQuestionId(null)}
                              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              Annuleren
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveQuestionModel(resp.question.id, false)}
                              disabled={savingQuestion}
                              style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              {savingQuestion ? 'Opslaan...' : 'Alleen opslaan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveQuestionModel(resp.question.id, true)}
                              disabled={savingQuestion}
                              style={{ background: '#7c5cfc', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Sparkles size={13} />
                              {savingQuestion ? 'Opslaan & nakijken...' : 'Opslaan & Opnieuw nakijken met AI'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.88rem', color: '#f0f9ff', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                            {resp.question?.modelAnswer || '(Geen modelantwoord ingevoerd)'}
                          </div>
                          {resp.question?.notes && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic', borderTop: '1px dashed rgba(56, 189, 248, 0.2)', paddingTop: '4px' }}>
                              💡 Instructies voor AI: {resp.question.notes}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Content Grid: OCR Text + Answer Snippet Crop */}
                    <div style={{ display: 'grid', gridTemplateColumns: resp.cropImagePath ? '1fr 240px' : '1fr', gap: '16px' }}>
                      {/* Left: Recognized Text & Feedback */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Recognized Student Answer */}
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                            ✍️ Herkend antwoord van leerling
                          </div>
                          <div style={{ fontSize: '0.86rem', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                            {resp.rawText || '(Geen tekst herkend op scan)'}
                          </div>
                        </div>

                        {/* 🔍 AI KEUZE-TOELICHTING (alleen voor docent) */}
                        {resp.aiReasoning && (
                          <div style={{
                            background: 'rgba(251, 146, 60, 0.06)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            border: '1px solid rgba(251, 146, 60, 0.2)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#fb923c', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                              🔍 AI Keuze-toelichting
                              <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 400, fontStyle: 'italic' }}>
                                (alleen voor docent — wordt niet gedeeld met leerling)
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400, marginLeft: 'auto' }}>
                                AI punten: {resp.aiPoints ?? '-'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#fbd38d', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                              {resp.aiReasoning}
                            </div>
                          </div>
                        )}

                        {/* 💬 AI FEEDBACK VOOR LEERLING (wordt gepubliceerd) */}
                        {resp.aiFeedback && (
                          <div style={{
                            background: 'rgba(124, 92, 252, 0.08)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            border: '1px solid rgba(124, 92, 252, 0.2)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#c4b5fd', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                              <Sparkles size={12} /> AI Feedback voor leerling
                              <span style={{
                                fontSize: '0.65rem',
                                color: '#34d399',
                                background: 'rgba(52, 211, 153, 0.15)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 500,
                                marginLeft: '4px'
                              }}>
                                📤 Wordt gepubliceerd
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                              {resp.aiFeedback}
                            </div>
                          </div>
                        )}

                        {/* 👨‍🏫 Docent toelichting / feedback (zichtbaar voor leerling) */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                            👨‍🏫 Docent toelichting / feedback (zichtbaar voor leerling indien ingeschakeld):
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Typ hier eventuele aanvullende feedback of toelichting voor de leerling..."
                            value={currentEdit.teacherNote}
                            onChange={e => handleNoteChange(resp.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: '#0a0e1a',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              fontSize: '0.84rem',
                              resize: 'vertical',
                              lineHeight: 1.4
                            }}
                          />
                        </div>
                      </div>

                      {/* Right: Crop Thumbnail (Clickable Lightbox) */}
                      {resp.cropImagePath && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                            🖼️ Uitsnede scan
                          </div>
                          <div
                            onClick={() => setLightboxImage(`/api/slimcheck/responses/${resp.id}/crop?token=${token}`)}
                            style={{
                              background: '#0a0e1a',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              position: 'relative',
                              maxHeight: '160px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Klik om uitsnede te vergroten"
                          >
                            <img
                              src={`/api/slimcheck/responses/${resp.id}/crop?token=${token}`}
                              alt={`Uitsnede vraag ${qNum}`}
                              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: '6px',
                              right: '6px',
                              background: 'rgba(0,0,0,0.7)',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.68rem',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Eye size={12} /> Vergroten
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            Selecteer een leerling aan de linkerkant om de resultaten te bekijken.
          </div>
        )}
      </div>
      ) : (
        /* Dedicated Manual Review Queue View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Review Queue Summary Card */}
          <div style={{
            background: 'rgba(17, 24, 39, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid #f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                    Handmatige Review & Twijfelgevallen
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                    Antwoorden waar de AI over twijfelde of geen definitief oordeel over kon vellen. Deze krijgen nooit zomaar 0 punten, maar wachten op jouw beoordeling.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: reviewQueue.length > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(52, 211, 153, 0.12)',
                border: `1px solid ${reviewQueue.length > 0 ? '#f59e0b' : '#34d399'}`,
                borderRadius: '12px',
                padding: '8px 18px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.72rem', color: reviewQueue.length > 0 ? '#fbbf24' : '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                  Openstaand
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: reviewQueue.length > 0 ? '#fbbf24' : '#34d399' }}>
                  {reviewQueue.length}
                </div>
              </div>
            </div>
          </div>

          {/* Review Items List */}
          {reviewQueue.length === 0 ? (
            <div style={{
              background: 'rgba(17, 24, 39, 0.6)',
              border: '1px solid rgba(52, 211, 153, 0.25)',
              borderRadius: '20px',
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                  Geen openstaande twijfelgevallen!
                </h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', maxWidth: '450px' }}>
                  Alle antwoorden zijn succesvol verwerkt of reeds handmatig beoordeeld. Je kunt nu de resultaten bekijken per leerling of direct publiceren.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewTab('students')}
                style={{
                  background: 'linear-gradient(135deg, #7c5cfc, #38bdf8)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                <Users size={16} /> Naar leerlingenoverzicht
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviewQueue.map((item: any, idx: number) => {
                const qNum = item.question?.number || idx + 1;
                const maxPts = item.question?.maxPoints || 1;
                const currentEdit = editedResponses[item.id] || {
                  finalPoints: item.finalPoints ?? item.aiPoints ?? 0,
                  teacherNote: item.teacherNote || '',
                  needsReview: true
                };

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(17, 24, 39, 0.75)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '18px',
                      padding: '22px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    {/* Item Top Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          border: '1px solid #f59e0b',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 800
                        }}>
                          VRAAG {qNum}
                        </span>
                        <span style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}>
                          Max {maxPts} pt
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                          👤 {item.studentName}
                        </span>
                        {item.studentId && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ({item.studentId})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const scanIdx = session.scans.findIndex((s: any) => s.id === item.scanId);
                          if (scanIdx !== -1) setSelectedScanIndex(scanIdx);
                          setViewTab('students');
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#cbd5e1',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <ExternalLink size={13} /> Bekijk leerling
                      </button>
                    </div>

                    {/* Content Grid: Left (Question & Model & OCR) + Right (Crop & Scoring) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                      {/* Left: Question details & AI Doubt Reason */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Vraag & Modelantwoord */}
                        <div style={{
                          background: 'rgba(56, 189, 248, 0.04)',
                          border: '1px solid rgba(56, 189, 248, 0.15)',
                          borderRadius: '12px',
                          padding: '14px 16px'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                            🎯 Vraag & Correctiemodel
                          </div>
                          {item.question?.text && (
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                              {item.question.text}
                            </div>
                          )}
                          <div style={{ fontSize: '0.9rem', color: '#f0f9ff', fontWeight: 600, lineHeight: 1.4 }}>
                            {item.question?.modelAnswer || '(Geen modelantwoord ingevoerd)'}
                          </div>
                          {item.question?.notes && (
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic', borderTop: '1px dashed rgba(56, 189, 248, 0.2)', paddingTop: '4px' }}>
                              💡 Instructies voor AI: {item.question.notes}
                            </div>
                          )}
                        </div>

                        {/* Herkend antwoord van leerling */}
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '14px 16px'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                            ✍️ Herkend antwoord van leerling (OCR)
                          </div>
                          <div style={{ fontSize: '0.92rem', color: '#fff', fontWeight: 600, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                            {item.rawText || '(Geen tekst herkend op scan)'}
                          </div>
                        </div>

                        {/* AI Reden voor twijfel */}
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: '12px',
                          padding: '12px 16px'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={13} />
                            Waarom staat dit in de review-wachtrij?
                          </div>
                          <div style={{ fontSize: '0.84rem', color: '#fde68a', lineHeight: 1.45 }}>
                            {item.aiReasoning || 'AI kon dit antwoord niet met voldoende zekerheid valideren ten opzichte van het correctiemodel of handschrift was dubbelzinnig.'}
                          </div>
                        </div>
                      </div>

                      {/* Right: Handwritten crop image + Quick Scoring Controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Crop preview */}
                        {item.cropImagePath ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                              🖼️ Uitsnede handgeschreven antwoord
                            </div>
                            <div
                              onClick={() => setLightboxImage(`/api/slimcheck/responses/${item.id}/crop?token=${token}`)}
                              style={{
                                background: '#0a0e1a',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                position: 'relative',
                                maxHeight: '180px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Klik om uitsnede te vergroten"
                            >
                              <img
                                src={`/api/slimcheck/responses/${item.id}/crop?token=${token}`}
                                alt={`Uitsnede vraag ${qNum}`}
                                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: '6px',
                                right: '6px',
                                background: 'rgba(0,0,0,0.75)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Eye size={12} /> Vergroten
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '12px',
                            padding: '16px',
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: '0.8rem',
                            border: '1px dashed rgba(255,255,255,0.08)'
                          }}>
                            Geen uitsnede beschikbaar voor deze vraag.
                          </div>
                        )}

                        {/* Grading box */}
                        <div style={{
                          background: 'rgba(124, 92, 252, 0.08)',
                          border: '1px solid rgba(124, 92, 252, 0.3)',
                          borderRadius: '14px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ fontSize: '0.78rem', color: '#c4b5fd', fontWeight: 800, textTransform: 'uppercase' }}>
                            Jouw Beoordeling
                          </div>

                          {/* Quick buttons */}
                          <div style={{ display: 'grid', gridTemplateColumns: maxPts > 1 ? '1fr 1fr 1fr' : '1fr 1fr', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handlePointChange(item.id, 0)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                background: currentEdit.finalPoints === 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              0 pt
                            </button>
                            {maxPts > 1 && (
                              <button
                                type="button"
                                onClick={() => handlePointChange(item.id, Math.round((maxPts / 2) * 10) / 10)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  background: currentEdit.finalPoints === Math.round((maxPts / 2) * 10) / 10 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.1)',
                                  color: '#fbbf24',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                ½ ({(maxPts / 2).toFixed(1)} pt)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePointChange(item.id, maxPts)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                background: currentEdit.finalPoints === maxPts ? 'rgba(52, 211, 153, 0.3)' : 'rgba(52, 211, 153, 0.1)',
                                color: '#34d399',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Volle score ({maxPts} pt)
                            </button>
                          </div>

                          {/* Points input and optional note */}
                          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>
                                Punten (max {maxPts}):
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={maxPts}
                                value={currentEdit.finalPoints}
                                onChange={e => handlePointChange(item.id, parseFloat(e.target.value) || 0)}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: '#0a0e1a',
                                  border: '1px solid rgba(124, 92, 252, 0.4)',
                                  color: '#fff',
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  textAlign: 'center'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '3px' }}>
                                Toelichting docent (optioneel):
                              </label>
                              <input
                                type="text"
                                placeholder="Bijv. handschrift gecontroleerd, goed gerekend"
                                value={currentEdit.teacherNote}
                                onChange={e => handleNoteChange(item.id, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: '#0a0e1a',
                                  border: '1px solid rgba(255, 255, 255, 0.12)',
                                  color: '#fff',
                                  fontSize: '0.82rem'
                                }}
                              />
                            </div>
                          </div>

                          {/* Action Button: Confirm & Resolve */}
                          <button
                            type="button"
                            onClick={() => handleResolveReviewItem(item.id, currentEdit.finalPoints, currentEdit.teacherNote)}
                            style={{
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: '#fff',
                              border: 'none',
                              padding: '10px 16px',
                              borderRadius: '10px',
                              fontSize: '0.88rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                              marginTop: '2px'
                            }}
                          >
                            <CheckCircle2 size={16} />
                            Beoordeling Bevestigen & Opslaan ({currentEdit.finalPoints} pt)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '40px',
            cursor: 'zoom-out'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '900px', width: '100%', background: '#111827', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          >
            <img
              src={lightboxImage}
              alt="Vergrote uitsnede"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              <span>Originele afbeeldingsuitsnede van handgeschreven antwoord</span>
              <button
                onClick={() => setLightboxImage(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
