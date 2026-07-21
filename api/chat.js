export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  
  try {
    // 第一步：创建对话任务
    const createRes = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COZE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: '7664644185815515186',
        user_id: 'web-user-' + Date.now(),
        stream: false,
        additional_messages: [
          {
            role: 'user',
            content: message,
            content_type: 'text'
          }
        ]
      }),
    });

    const createData = await createRes.json();
    
    if (!createData.data || !createData.data.conversation_id) {
      return res.status(200).json({ 
        reply: '创建对话失败：' + JSON.stringify(createData),
        sources: []
      });
    }

    const conversationId = createData.data.conversation_id;
    
    // 第二步：轮询查询结果（最多等 15 秒）
    let answer = '';
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等 1 秒
      
      const queryRes = await fetch(`https://api.coze.cn/v3/chat?conversation_id=${conversationId}&bot_id=7664644185815515186`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.COZE_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      const queryData = await queryRes.json();
      
      if (queryData.data && queryData.data.status === 'completed') {
        // 找到 answer 类型的消息
        const messages = queryData.data.messages || [];
        const answerMsg = messages.find(m => m.type === 'answer');
        if (answerMsg && answerMsg.content) {
          answer = answerMsg.content;
          break;
        }
      }
      
      attempts++;
    }
    
    if (answer) {
      return res.status(200).json({ reply: answer, sources: [] });
    } else {
      return res.status(200).json({ 
        reply: '抱歉，AI 处理时间较长，请稍后重试。',
        sources: []
      });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(200).json({ 
      reply: '服务错误：' + error.message,
      sources: []
    });
  }
}
