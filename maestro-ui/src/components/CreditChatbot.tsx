import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'bot';
  content: string;
}

const DEMO_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['taux', 'intérêt', 'taux immobilier'],
    response:
      'Les taux immobiliers actuels varient entre 3,2 % et 4,5 % selon la durée et votre profil emprunteur. Souhaitez-vous une simulation personnalisée ?',
  },
  {
    keywords: ['dossier', 'statut', 'avancement', 'état'],
    response:
      'Je peux consulter l\'avancement d\'un dossier en cours. Merci de me communiquer la référence du dossier (ex : REF-2024-XXXX).',
  },
  {
    keywords: ['capacité', 'emprunt', 'combien', 'montant'],
    response:
      'La capacité d\'emprunt dépend de vos revenus, de vos charges et de votre apport personnel. En général, le taux d\'endettement ne doit pas dépasser 35 %. Voulez-vous que je vous explique le calcul ?',
  },
  {
    keywords: ['délai', 'durée', 'temps', 'traitement'],
    response:
      'Le délai de traitement moyen d\'un dossier de crédit immobilier est de 15 à 30 jours ouvrés, selon la complétude des pièces justificatives.',
  },
  {
    keywords: ['document', 'pièce', 'justificatif', 'fournir'],
    response:
      'Les documents habituellement requis sont : pièce d\'identité, justificatifs de revenus (3 derniers bulletins de salaire), avis d\'imposition, relevés de compte et le compromis de vente.',
  },
  {
    keywords: ['assurance', 'garantie'],
    response:
      'L\'assurance emprunteur est obligatoire. Elle couvre au minimum le décès et la perte totale et irréversible d\'autonomie (PTIA). Depuis la loi Lemoine, vous pouvez en changer à tout moment.',
  },
  {
    keywords: ['refus', 'rejeté', 'refusé'],
    response:
      'En cas de refus, il est possible de renforcer votre dossier en augmentant l\'apport personnel, en réduisant vos charges ou en ajoutant un co-emprunteur. Je peux vous aider à identifier les points bloquants.',
  },
  {
    keywords: ['bonjour', 'salut', 'bonsoir', 'hello'],
    response: 'Bonjour ! Je suis votre assistant dédié aux crédits immobiliers. Comment puis-je vous aider ?',
  },
  {
    keywords: ['merci', 'super', 'parfait', 'excellent'],
    response: 'Avec plaisir ! N\'hésitez pas si vous avez d\'autres questions.',
  },
];

const getBotResponse = (input: string): string => {
  const normalized = input.toLowerCase();
  for (const { keywords, response } of DEMO_RESPONSES) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return response;
    }
  }
  return 'Je n\'ai pas bien compris votre demande. Pouvez-vous reformuler ? Je peux vous aider sur les taux, les dossiers, les documents requis ou votre capacité d\'emprunt.';
};

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2">
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
      style={{ background: '#ee7728' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 8V4H8" /><circle cx="12" cy="12" r="9" /><path d="M12 12h4" />
      </svg>
    </div>
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-slate-400"
          style={{ animation: `chatbot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  </div>
);

const BotAvatar: React.FC = () => (
  <div
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
    style={{ background: '#ee7728' }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" strokeWidth="3" />
      <line x1="12" y1="16" x2="12" y2="16" strokeLinecap="round" strokeWidth="3" />
      <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" strokeWidth="3" />
    </svg>
  </div>
);

const CreditChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'bot', content: 'Comment je peux vous aider aujourd\'hui ?' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = { id: nextId.current++, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const delay = 900 + Math.random() * 700;
    setTimeout(() => {
      const botMsg: Message = { id: nextId.current++, role: 'bot', content: getBotResponse(text) };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, delay);
  }, [input, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes chatbot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes chatbot-pop {
          0% { transform: scale(0.85) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Chat dialog */}
      {isOpen && (
        <div
          className="fixed bottom-[68px] right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ height: '440px', animation: 'chatbot-pop 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-5 text-white" style={{ background: '#ee7728' }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" strokeLinecap="round" strokeWidth="3" />
                <line x1="12" y1="16" x2="12" y2="16" strokeLinecap="round" strokeWidth="3" />
                <line x1="16" y1="16" x2="16" y2="16" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
            <div className="flex-1 leading-snug">
              <p className="text-sm font-semibold">Assistant Crédits immobiliers</p>
              <p className="text-xs opacity-80">UiPath Conversational Agent</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 hover:bg-white/20 transition-colors"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="flex flex-col gap-4">
              {messages.map((msg) =>
                msg.role === 'bot' ? (
                  <div key={msg.id} className="flex items-end gap-2.5 pl-1">
                    <BotAvatar />
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-800">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-end">
                    <div
                      className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed text-white"
                      style={{ background: '#ee7728' }}
                    >
                      {msg.content}
                    </div>
                  </div>
                )
              )}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 px-4 py-4">
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 focus-within:border-orange-400 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
                style={{ background: '#ee7728' }}
                title="Envoyer"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">
              Cet assistant est à titre démo — vérifiez les réponses.
            </p>
          </div>
        </div>
      )}

      {/* Floating button — taille réduite (×0.8 → 42px) */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ background: '#ee7728', width: '42px', height: '42px' }}
        title="Assistant Crédits immobiliers"
      >
        {isOpen ? (
          <X size={18} color="white" />
        ) : (
          <span className="flex gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="inline-block h-[6px] w-[6px] rounded-full bg-white" />
            ))}
          </span>
        )}
      </button>
    </>
  );
};

export default CreditChatbot;
