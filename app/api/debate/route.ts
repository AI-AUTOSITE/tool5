import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { kv } from '@vercel/kv';

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// スタイル別のプロンプト
const stylePrompts = {
  kind: `You are a warm, supportive debate trainer who always aims to encourage and uplift the user, especially beginners or those lacking confidence.
- Give gentle, constructive counterarguments with a friendly, empathetic tone.
- If you disagree, start by acknowledging the user's effort or positive points.
- Focus on building the user's skills by offering kind suggestions, not criticism.
- If the user's logic is weak, help them see a better way without making them feel wrong.
- Always end your feedback with an encouraging or motivating message.
- Never use sarcasm or harsh language. Your style is like a compassionate mentor or coach.`,

  teacher: `You are a highly logical and educational debate coach, embodying the style of a seasoned university professor. Your job is to listen carefully, analyze arguments step by step, and provide clear, structured, and deeply informative counterarguments.
- Always explain *why* you disagree, using precise logic and real-world examples.
- Be calm, fair, and encouraging, but never sugarcoat flaws.
- If the user's logic is weak, point it out with specific reasoning, not just general statements.
- Encourage users to consider multiple perspectives.
- When giving feedback, suggest concrete ways to improve their reasoning or evidence.
- Your language is polite but direct, like a respected teacher or academic.`,

  devil: `You are a merciless, hyper-intelligent debate critic who loves to destroy weak arguments.
- Use sarcasm, pointed questions, and ruthless logic to expose every flaw.
- Never praise or coddle the user—your job is to break their argument until nothing remains.
- Attack assumptions, exaggerations, and emotional appeals without mercy.
- If the user's argument is too vague or weak, mock it (without profanity).
- Always provide a brutally honest counterargument, using biting wit and cold, clear reasoning.
- Your tone is sharp, intellectual, and a bit arrogant—like a debate devil's advocate.`
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { theme, message, style, user_token, is_new_session } = body;

    // 入力検証
    if (!theme || !message || !style || !user_token) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Vercel KVを使用する場合（環境変数が設定されている場合のみ）
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        // 1日1テーマ制限チェック（新セッションの場合のみ）
        if (is_new_session) {
          const dailyKey = `limit:${user_token}:${today}`;
          const dailyCount = await kv.get<number>(dailyKey) || 0;
          
          if (dailyCount >= 1) {
            return NextResponse.json(
              { error: 'Usage limit reached for today.' },
              { status: 429 }
            );
          }
          
          // カウントを増やす（24時間で自動削除）
          await kv.set(dailyKey, dailyCount + 1, { ex: 86400 });
        }

        // トークン制限チェック
        const tokenKey = `tokens:${user_token}:${today}:${theme}`;
        const currentTokens = await kv.get<number>(tokenKey) || 0;
        
        if (currentTokens >= 8000) {
          return NextResponse.json(
            { error: 'Token limit reached for this theme today.' },
            { status: 429 }
          );
        }
      } catch (kvError) {
        console.warn('KV storage not configured or error:', kvError);
        // KVが設定されていない場合は制限なしで続行
      }
    }

    // プロンプトの準備
    const roleInstruction = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.teacher;
    
    const userPrompt = `You are an impartial debate evaluator.  
Evaluate the user's argument on the following topic and return a rebuttal.  
Then, assign a score from 1 to 5 for each category and give one specific feedback point for improvement.  
Respond ONLY in this format:

RESPONSE: [Your rebuttal]
SCORES:
Logical Consistency: x/5
Persuasiveness: x/5
Factual Accuracy: x/5
Structural Coherence: x/5
Rebuttal Resilience: x/5
FEEDBACK: [One short suggestion to improve user argument]

Topic: "${theme}"
User's argument: "${message}"`;

    // OpenAI API呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // コスト削減のためminiを使用（必要に応じてgpt-4oに変更可）
      messages: [
        { role: 'system', content: roleInstruction },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const rawResponse = completion.choices[0]?.message?.content || '';
    const usage = completion.usage?.total_tokens || 1200;

    // レスポンスのパース
    let scores = {
      "Logical Consistency": 1,
      "Persuasiveness": 1,
      "Factual Accuracy": 1,
      "Structural Coherence": 1,
      "Rebuttal Resilience": 1
    };
    let feedback = "No feedback available.";

    // スコアを抽出
    const scoreMatches = rawResponse.matchAll(/(Logical Consistency|Persuasiveness|Factual Accuracy|Structural Coherence|Rebuttal Resilience):\s*(\d)\/5/g);
    for (const match of scoreMatches) {
      const key = match[1] as keyof typeof scores;
      scores[key] = parseInt(match[2]);
    }

    // フィードバックを抽出
    const feedbackMatch = rawResponse.match(/FEEDBACK:\s*(.+)/s);
    if (feedbackMatch) {
      feedback = feedbackMatch[1].trim();
    }

    // トークン使用量を記録（KVが利用可能な場合）
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const tokenKey = `tokens:${user_token}:${today}:${theme}`;
        const currentTokens = await kv.get<number>(tokenKey) || 0;
        await kv.set(tokenKey, currentTokens + usage, { ex: 86400 });
      } catch (kvError) {
        console.warn('Failed to update token count:', kvError);
      }
    }

    return NextResponse.json({
      reply: rawResponse,
      scores,
      feedback
    });

  } catch (error: any) {
    console.error('API error:', error);
    
    if (error.code === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'OpenAI API quota exceeded. Please check your billing.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}