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

  // スタート画面からディベート画面へ
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

  // メッセージ送信
  const sendMessage = async () => {
    if (!userInput.trim() || isLoading || turns >= maxTurns) return;

    const newMessage = userInput.trim();
    setUserInput('');
    setIsLoading(true);
    
    // ユーザーメッセージを追加
    setMessages(prev => [...prev, { role: 'user', content: newMessage }]);

    // ユーザートークンを取得または生成
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

      // タイピングアニメーション開始
      await typeMessage(data.reply, data.scores, data.feedback);
      
      setTurns(prev => prev + 1);

      // 最大ターン数に達した場合
      if (turns + 1 >= maxTurns) {
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: '🛑 Limit reached. Please reload to start a new debate.' 
        }]);
      }

    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `⚠️ Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // タイピングアニメーション
  const typeMessage = async (text: string, scores: Scores, feedback: string) => {
    // RESPONSE部分を抽出
    const responseMatch = text.match(/RESPONSE:\s*([\s\S]*?)(?:SCORES:|FEEDBACK:|$)/i);
    const displayText = responseMatch 
      ? `${getStyleLabel()}: ${responseMatch[1].trim()}`
      : `${getStyleLabel()}: ${text}`;

    setIsTyping(true);
    setCurrentTypingText('');
    
    // GPTメッセージをタイピング中として追加
    setMessages(prev => [...prev, { role: 'gpt', content: '・' }]);

    // 文字を1つずつ表示
    for (let i = 0; i < displayText.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 12));
      setCurrentTypingText(displayText.slice(0, i + 1));
      
      // 最後のメッセージを更新
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
    
    // 評価を設定
    if (scores && feedback) {
      setEvaluation({ scores, feedback });
    }
  };

  // スタイルのラベルを取得
  const getStyleLabel = () => {
    const labels = {
      kind: 'Kind',
      teacher: 'Teacher',
      devil: 'Devil'
    };
    return labels[style as keyof typeof labels] || 'Teacher';
  };

  // テキストエリアの高さ自動調整
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
      if (textareaRef.current.scrollHeight > 48) {
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
    }
  };

  // スクロール調整
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages, currentTypingText]);

  // スタート画面
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Start a Debate</h1>
          
          <input
            type="text"
            placeholder="Enter debate topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:border-green-500"
          />
          
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full p-3 mb-6 border border-gray-300 rounded-xl focus:outline-none focus:border-green-500"
          >
            <option value="kind">🧘 Kind Type</option>
            <option value="teacher">👨‍🏫 Teacher Type</option>
            <option value="devil">😈 Devil Mode</option>
          </select>
          
          <button
            onClick={startDebate}
            className="w-full py-3 bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-green-700 transition-all"
          >
            Start Debate
          </button>
          
          <p className="text-xs text-gray-500 text-center mt-6">
            We do not store any user data. All interactions are processed anonymously.<br/>
            ChatGPT responses may not always be accurate. Always verify critical information.
          </p>
        </div>
      </div>
    );
  }

  // ディベート画面
  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-3xl shadow-lg w-full md:max-w-2xl min-h-screen md:min-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-4 bg-white border-b border-gray-200 rounded-t-none md:rounded-t-3xl">
          <div className="font-bold text-lg">📌 Topic: {topic}</div>
        </div>

        {/* チャットログ */}
        <div 
          ref={chatLogRef}
          className="flex-1 overflow-y-auto p-4 bg-[#f5f7fa] max-h-[50vh] md:max-h-[45vh]"
        >
          {messages.map((msg, index) => (
            <div key={index} className="mb-3 flex">
              <div className={`
                ${msg.role === 'user' ? 'ml-auto bg-gradient-to-r from-green-300 to-green-400 text-green-900' : ''}
                ${msg.role === 'gpt' ? 'mr-auto bg-gray-100 text-gray-800' : ''}
                ${msg.role === 'system' ? 'mx-auto bg-yellow-100 text-yellow-800' : ''}
                px-4 py-2 rounded-2xl max-w-[85%] shadow-sm
              `}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* 評価表示 */}
        {evaluation && turns >= maxTurns && (
          <div className="p-4 bg-gray-50 mx-4 mb-4 rounded-2xl">
            <h3 className="font-bold mb-2">Evaluation</h3>
            <ul className="text-sm space-y-1">
              {Object.entries(evaluation.scores).map(([key, value]) => (
                <li key={key}>{key}: {value}/5</li>
              ))}
            </ul>
            <p className="text-sm mt-2">
              <strong>Feedback:</strong> {evaluation.feedback}
            </p>
          </div>
        )}

        {/* 入力エリア */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex gap-2 rounded-b-none md:rounded-b-3xl">
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
            placeholder="Type your argument..."
            disabled={isLoading || turns >= maxTurns}
            className="flex-1 p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:border-green-500 min-h-[48px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || turns >= maxTurns}
            className="px-6 py-3 bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}