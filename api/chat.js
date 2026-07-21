export default async function handler(req, res) {
  // 允许前端跨域调用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  
  try {
    // 调用 Coze Open API
    const response = await fetch('https://api.coze.cn/open_api/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COZE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: '7664644185815515186',
        user: 'web-user-' + Date.now(),
        query: message,
      }),
    });

    const data = await response.json();
    
    // 兼容多种可能的响应格式
    const reply = data.answer || data.content || data.data?.answer || data.messages?.[0]?.content || data.reply;
    
    if (reply) {
      res.status(200).json({ reply, sources: data.sources || [] });
    } else {
      res.status(200).json({ reply: '获取回答失败，请检查 Coze API 配置。', sources: [] });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(200).json({ reply: '服务暂时不可用，请稍后重试。', sources: [] });
  }
}
