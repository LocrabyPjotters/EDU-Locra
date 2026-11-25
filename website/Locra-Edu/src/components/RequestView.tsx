import { useState, useEffect, type FormEvent } from 'react';
import { Send, Mail, Globe, Check } from 'lucide-react';
import { PRICING_TIERS } from '../data/locraData';

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function RequestView() {
  const [formData, setFormData] = useState({
    schoolName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    requestedTier: '',
    studentCount: '',
    notes: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', ''));
    const tier = params.get('tier');
    if (tier) {
      setFormData((prev) => ({ ...prev, requestedTier: tier }));
    }
  }, []);

  const update = (
    field: keyof typeof formData,
    value: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch(
        'https://api.rowmatch.nl/api/locra/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        },
      );

      if (res.ok) {
        setStatus('success');
      } else {
        const text = await res.text();
        throw new Error(text || `Fout ${res.status}`);
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Er ging iets mis. Probeer het opnieuw.',
      );
    }
  };

  if (status === 'success') {
    return (
      <section className="section">
        <div className="container">
          <div
            className="card"
            style={{
              padding: 40,
              backgroundColor: 'var(--accent-emerald)',
              color: '#fff',
              textAlign: 'center',
              maxWidth: 560,
              margin: '0 auto',
            }}
          >
            <Check size={48} style={{ marginBottom: 12 }} />
            <h2 style={{ margin: '0 0 8px', color: '#fff' }}>
              Aanvraag Ontvangen!
            </h2>
            <p style={{ margin: 0, opacity: 0.9 }}>
              We nemen binnen 1 werkdag contact op.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="badge badge-cobalt">Aanvragen</span>
          <h2>Vraag een Locra Licentie Aan</h2>
        </div>

        {status === 'error' && (
          <div
            className="card"
            style={{
              padding: 16,
              backgroundColor: 'var(--accent-rose)',
              color: '#fff',
              marginBottom: 24,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div className="grid-2">
          {/* ── Form ── */}
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label">Schoolnaam *</label>
              <input
                className="form-input"
                type="text"
                required
                value={formData.schoolName}
                onChange={(e) => update('schoolName', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Contactpersoon *</label>
              <input
                className="form-input"
                type="text"
                required
                value={formData.contactName}
                onChange={(e) => update('contactName', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">E-mailadres *</label>
              <input
                className="form-input"
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Telefoonnummer</label>
              <input
                className="form-input"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => update('contactPhone', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Gewenst Pakket</label>
              <select
                className="form-select"
                value={formData.requestedTier}
                onChange={(e) => update('requestedTier', e.target.value)}
              >
                <option value="">— Selecteer —</option>
                {PRICING_TIERS.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label">Aantal Leerlingen</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={formData.studentCount}
                onChange={(e) => update('studentCount', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label">Opmerkingen</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={formData.notes}
                onChange={(e) => update('notes', e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={status === 'sending'}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Send size={18} />
              {status === 'sending' ? 'Versturen...' : 'Aanvraag Versturen'}
            </button>
          </form>

          {/* ── Contact Card ── */}
          <div>
            <div className="card" style={{ padding: 28 }}>
              <h3 style={{ margin: '0 0 12px' }}>
                Liever Persoonlijk Contact?
              </h3>
              <p style={{ marginBottom: 20, color: 'var(--text-muted)' }}>
                Neem direct contact op — we reageren binnen 1 werkdag.
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <Mail size={18} style={{ color: 'var(--accent-cobalt)' }} />
                <a href="mailto:locra@pjotters.nl">locra@pjotters.nl</a>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Globe size={18} style={{ color: 'var(--accent-cobalt)' }} />
                <a
                  href="https://pjotters.nl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pjotters.nl
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
