export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  
  try {
    const response = await fetch('https://api.coze.cn/v3/chat', {
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

    const data = await response.json();
    console.log('Coze API Response:', JSON.stringify(data, null, 2));
    
    // 调试：直接把原始返回给前端，让我们看到格式
    if (!data.data || !data.data.messages) {
      return res.status(200).json({ 
        reply: '调试信息：API 返回格式如下，请截图发给开发者：\n\n' + JSON.stringify(data, null, 2),
        sources: []
      });
    }
    
    const answerMsg = data.data.messages.find(m => m.type === 'answer');
    if (answerMsg && answerMsg.content) {
      return res.status(200).json({ reply: answerMsg.content, sources: [] });
    }
    
    return res.status(200).json({ 
      reply: '调试：找到 messages 但没有 answer 类型。返回数据：\n\n' + JSON.stringify(data.data.messages, null, 2),
      sources: []
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(200).json({ 
      reply: '服务错误：' + error.message,
      sources: []
    });
  }
}
