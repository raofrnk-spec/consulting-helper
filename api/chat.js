export default async function handler(req, res) {
  // 允许前端跨域调用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  
  try {
    // 调用 Coze v3/chat API（正确的官方接口）
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
    
    // 从响应中提取回答（Coze v3 返回格式）
    // 非流式响应会在 data 中包含消息列表
    let reply = '';
    let sources = [];
    
    if (data.data && data.data.messages) {
      // 找到 type=answer 的消息
      const answerMsg = data.data.messages.find(m => m.type === 'answer');
      if (answerMsg) {
        reply = answerMsg.content;
      }
    } else if (data.data && data.data.content) {
      reply = data.data.content;
    } else if (data.msg) {
      // 如果有错误信息
      reply = 'API 错误：' + data.msg;
    }
    
    if (reply) {
      res.status(200).json({ reply, sources });
    } else {
      res.status(200).json({ reply: '获取回答失败，API 返回格式异常。', sources: [] });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(200).json({ reply: '服务暂时不可用，请稍后重试。', sources: [] });
  }
}
