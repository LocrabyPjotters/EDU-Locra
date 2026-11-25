import { useState } from 'react';
import {
  GraduationCap,
  Users,
  Settings,
  Zap,
  CheckCircle,
  Clock,
  MessageSquare,
  BookOpen,
  MessageCircle,
  FileText,
  Shield,
  Award,
  Server,
  Cpu,
  ShieldCheck,
  RefreshCw,
  PiggyBank,
} from 'lucide-react';

interface WorkflowCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TAB_LABELS = [
  { label: 'Docenten', icon: <GraduationCap size={18} /> },
  { label: 'Leerlingen', icon: <Users size={18} /> },
  { label: 'ICT & Schoolleiding', icon: <Settings size={18} /> },
];

const TAB_CONTENT: {
  title: string;
  subtitle: string;
  cards: WorkflowCard[];
}[] = [
  {
    title: 'Voor Docenten',
    subtitle: 'Minder nakijkwerk, meer impactvolle lessen',
    cards: [
      {
        icon: <Zap size={22} />,
        title: 'Les Voorbereiden',
        description:
          'Locra Live genereert interactieve digibordlessen met RTTI-taxonomie',
      },
      {
        icon: <CheckCircle size={22} />,
        title: 'Toetsen Nakijken',
        description:
          'SlimCheck beoordeelt met jouw rubric, jij controleert en past aan',
      },
      {
        icon: <Clock size={22} />,
        title: 'Daluren Benutten',
        description:
          'Zware taken automatisch \'s nachts verwerkt door de AI Wachtrij',
      },
      {
        icon: <MessageSquare size={22} />,
        title: 'Feedback Geven',
        description:
          'AI-suggesties die jij persoonlijk maakt voor elke leerling',
      },
      {
        icon: <BookOpen size={22} />,
        title: 'Leerling Begeleiden',
        description:
          'Socratische coach helpt zonder antwoorden weg te geven',
      },
    ],
  },
  {
    title: 'Voor Leerlingen',
    subtitle: 'Zelfstandig leren met begeleiding op maat',
    cards: [
      {
        icon: <MessageCircle size={22} />,
        title: 'Vragen Stellen',
        description: 'Socratische Chat',
      },
      {
        icon: <FileText size={22} />,
        title: 'Werkstukken Schrijven',
        description: 'Docs 2.0 met AI-taalhulp',
      },
      {
        icon: <Zap size={22} />,
        title: 'Quizzen Spelen',
        description: 'Live Arena met scorebord',
      },
      {
        icon: <Shield size={22} />,
        title: 'Toetsen Maken',
        description: 'ExamRoom beveiligd',
      },
      {
        icon: <Award size={22} />,
        title: 'Portfolio Opbouwen',
        description: 'Academy leerpaden',
      },
    ],
  },
  {
    title: 'Voor ICT-Beheerders & Schoolleiding',
    subtitle: 'Volledige controle, nul vendor lock-in',
    cards: [
      {
        icon: <Server size={22} />,
        title: 'Lokale Installatie',
        description: 'Eigen server, geen cloud vereist',
      },
      {
        icon: <Cpu size={22} />,
        title: 'GPU Monitoring',
        description: 'AI Wachtrij dashboard met 7×24 heatmap',
      },
      {
        icon: <ShieldCheck size={22} />,
        title: 'AVG-Compliance',
        description: 'Trust Center met exporteerbare documenten',
      },
      {
        icon: <RefreshCw size={22} />,
        title: 'Update Beheer',
        description: 'Licentie-gecontroleerd via private repo',
      },
      {
        icon: <PiggyBank size={22} />,
        title: 'Kosten Beheersen',
        description: 'Vanaf €0/jaar, transparante licenties',
      },
    ],
  },
];

export default function AudienceTabs() {
  const [activeAudience, setActiveAudience] = useState(0);
  const current = TAB_CONTENT[activeAudience];

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="badge badge-cobalt">Voor Wie</span>
          <h2>Locra voor Elk Roltype</h2>
        </div>

        <div
          className="tablist-bar"
          role="tablist"
          aria-label="Doelgroep selectie"
        >
          {TAB_LABELS.map((tab, i) => (
            <button
              key={tab.label}
              className="subtab-btn"
              role="tab"
              aria-selected={activeAudience === i}
              onClick={() => setActiveAudience(i)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          style={{ marginTop: 32 }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {current.title}
          </h3>
          <p
            style={{
              color: 'var(--text-secondary, #64748b)',
              marginBottom: 24,
              fontSize: '1.05rem',
            }}
          >
            {current.subtitle}
          </p>

          <div className="grid-2">
            {current.cards.map((card) => (
              <div
                key={card.title}
                className="card"
                style={{ padding: 20 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: 'var(--accent-cobalt)' }}>
                    {card.icon}
                  </span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1rem',
                    }}
                  >
                    {card.title}
                  </strong>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--text-secondary, #64748b)',
                    fontSize: '0.925rem',
                    lineHeight: 1.5,
                  }}
                >
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
