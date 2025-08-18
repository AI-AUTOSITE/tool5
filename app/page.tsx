'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'gpt' | 'system';
  content: string;
}

interface Scores {
  "Logical Consistency": number;
  "Persuasiveness": number;
  "Factual Accuracy": number;
  "Structural Coherence": number;
  "Rebuttal Resilience": number;
}

export default function DebateTrainer() {
  const [isStarted, setIsStarted] = useState(false);
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('kind');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turns, setTurns] = useState(0);
  const [evaluation, setEvaluation] = useState<{scores: Scores, feedback: string} | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  const chatLogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxTurns = 5;

  const startDebate = () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }
    setIsStarted(true);
    setMessages([]);
    setTurns(0);
    setEvaluation(null);
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading || turns >= maxTurns) return;

    const newMessage = userInput.trim();
    setUserInput('');
    setIsLoading(true);
    
    setMessages(prev => [...prev, { role: 'user', content: newMessage }]);

    let userToken = localStorage.getItem('user_token');
    if (!userToken) {
      userToken = `guest_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      localStorage.setItem('user_token', userToken);
    }

    try {
      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: topic,
          message: newMessage,
          style: style,
          user_token: userToken,
          is_new_session: turns === 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API error');
      }

      await typeMessage(data.reply, data.scores, data.feedback);
      
      setTurns(prev => prev + 1);

      if (turns + 1 >= maxTurns) {
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: 'Debate Complete! Check your evaluation scores below.' 
        }]);
      }

    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const typeMessage = async (text: string, scores: Scores, feedback: string) => {
    const responseMatch = text.match(/RESPONSE:\s*([\s\S]*?)(?:SCORES:|FEEDBACK:|$)/i);
    const displayText = responseMatch 
      ? responseMatch[1].trim()
      : text;

    setIsTyping(true);
    setCurrentTypingText('');
    
    setMessages(prev => [...prev, { role: 'gpt', content: '...' }]);

    for (let i = 0; i < displayText.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 12));
      setCurrentTypingText(displayText.slice(0, i + 1));
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'gpt',
          content: displayText.slice(0, i + 1)
        };
        return newMessages;
      });
    }

    setIsTyping(false);
    
    if (scores && feedback) {
      setEvaluation({ scores, feedback });
    }
  };

  const getStyleInfo = () => {
    const styles = {
      kind: { label: 'Supportive Coach', icon: '🤝', color: 'from-blue-400 to-purple-500' },
      teacher: { label: 'Professor', icon: '🎓', color: 'from-emerald-500 to-teal-600' },
      devil: { label: "Devil's Advocate", icon: '⚔️', color: 'from-red-500 to-orange-600' }
    };
    return styles[style as keyof typeof styles] || styles.teacher;
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
      if (textareaRef.current.scrollHeight > 48) {
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
    }
  };

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages, currentTypingText]);

  const styleInfo = getStyleInfo();

  // SVG背景パターンをCSSクラスとして定義
  const patternStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    opacity: 0.2
  };

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0" style={patternStyle}></div>
        
        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-md w-full border border-white/20">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-2xl opacity-50"></div>
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full blur-2xl opacity-50"></div>
          
          <div className="relative">
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold mb-2 text-center text-white">Debate Arena</h1>
            <p className="text-center text-white/70 mb-8 text-sm">Master the art of argumentation with AI</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Debate Topic</label>
                <input
                  type="text"
                  placeholder="e.g., Should AI replace human workers?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full p-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:bg-white/20 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Choose Your Opponent</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full p-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-400 focus:bg-white/20 transition-all appearance-none cursor-pointer"
                  style={{ backgroundColor: 'rgba(31, 41, 55, 0.8)' }}
                >
                  <option value="kind" style={{ backgroundColor: '#1f2937' }}>Supportive Coach - Gentle feedback</option>
                  <option value="teacher" style={{ backgroundColor: '#1f2937' }}>Professor - Academic rigor</option>
                  <option value="devil" style={{ backgroundColor: '#1f2937' }}>Devil&apos;s Advocate - No mercy</option>
                </select>
              </div>
              
              <button
                onClick={startDebate}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-700 transform hover:scale-[1.02] transition-all shadow-lg"
              >
                Enter the Arena
              </button>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-white/50 text-center leading-relaxed">
                Your debates are processed anonymously. AI responses may vary in accuracy.
                <br/>Practice critical thinking and verify important claims.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-0 md:p-4">
      <div className="bg-slate-800/90 backdrop-blur-xl rounded-none md:rounded-3xl shadow-2xl w-full md:max-w-4xl min-h-screen md:min-h-[85vh] flex flex-col border border-slate-700/50">
        
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 md:p-6 border-b border-slate-700/50 rounded-t-none md:rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-gradient-to-r ${styleInfo.color} rounded-lg shadow-lg`}>
                <span className="text-2xl">{styleInfo.icon}</span>
              </div>
              <div>
                <div className="text-white/60 text-xs uppercase tracking-wider">Debating with</div>
                <div className="text-white font-bold">{styleInfo.label}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/60 text-xs uppercase tracking-wider">Topic</div>
              <div className="text-white font-semibold max-w-xs truncate">{topic}</div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-1">
            {[...Array(maxTurns)].map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i < turns 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <div className="text-center mt-2 text-white/60 text-xs">
            Round {turns}/{maxTurns}
          </div>
        </div>

        <div 
          ref={chatLogRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-900/50"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
              {msg.role === 'gpt' && (
                <div className="flex items-end gap-2 max-w-[75%]">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${styleInfo.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <span className="text-sm">{styleInfo.icon}</span>
                  </div>
                  <div className="bg-slate-700/50 backdrop-blur text-white p-4 rounded-2xl rounded-bl-sm shadow-lg border border-slate-600/30">
                    <div className="text-xs text-purple-400 mb-1 font-semibold">{styleInfo.label}</div>
                    <div className="leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              )}
              
              {msg.role === 'user' && (
                <div className="max-w-[75%]">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-2xl rounded-br-sm shadow-lg">
                    <div className="text-xs opacity-80 mb-1 font-semibold">You</div>
                    <div className="leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              )}
              
              {msg.role === 'system' && (
                <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur text-yellow-200 px-4 py-2 rounded-full text-sm border border-yellow-500/30">
                  {msg.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {evaluation && turns >= maxTurns && (
          <div className="p-4 md:p-6 bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur border-t border-slate-700/50">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span> Performance Analysis
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              {Object.entries(evaluation.scores).map(([key, value]) => (
                <div key={key} className="bg-slate-700/30 rounded-xl p-3 border border-slate-600/30">
                  <div className="text-white/60 text-xs mb-1">{key}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{value}</span>
                    <span className="text-white/40">/5</span>
                  </div>
                  <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
              <div className="text-blue-300 text-sm font-semibold mb-1">Feedback</div>
              <p className="text-white/80 text-sm leading-relaxed">{evaluation.feedback}</p>
            </div>
          </div>
        )}

        <div className="bg-slate-800/90 backdrop-blur border-t border-slate-700/50 p-4 rounded-b-none md:rounded-b-3xl">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={turns >= maxTurns ? "Debate complete!" : "Type your argument..."}
              disabled={isLoading || turns >= maxTurns}
              className="flex-1 p-3 bg-slate-700/50 backdrop-blur border border-slate-600/50 rounded-xl resize-none text-white placeholder-white/40 focus:outline-none focus:border-purple-500 focus:bg-slate-700/70 transition-all min-h-[48px] max-h-[120px] disabled:opacity-50"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || turns >= maxTurns || !userInput.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100 transition-all shadow-lg min-w-[100px]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}