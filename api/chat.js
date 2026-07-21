export default async function handler(req, res) {
  // 允许前端跨域调用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  
  try {
    // ========== 第一步：创建对话任务 ==========
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
    console.log('Create response:', JSON.stringify(createData));
    
    // 检查创建是否成功
    if (createData.code !== 0 || !createData.data || !createData.data.id) {
      return res.status(200).json({ 
        reply: '创建对话失败：' + (createData.msg || JSON.stringify(createData)),
        sources: []
      });
    }

    const chatId = createData.data.id;           // 对话ID
    const conversationId = createData.data.conversation_id; // 会话ID
    
    // ========== 第二步：轮询查询状态（最多等20秒） ==========
    let answer = '';
    let attempts = 0;
    const maxAttempts = 20; // 最多轮询20次，每次1秒，共20秒
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等1秒
      
      // 正确的查询端点：v3/chat/retrieve
      const retrieveRes = await fetch(
        `https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.COZE_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const retrieveData = await retrieveRes.json();
      console.log(`Poll ${attempts + 1}:`, JSON.stringify(retrieveData));
      
      // 检查查询结果
      if (retrieveData.code === 0 && retrieveData.data) {
        const status = retrieveData.data.status;
        
        // 如果已完成，去获取消息
        if (status === 'completed') {
          // 尝试从retrieve响应中直接获取messages
          if (retrieveData.data.messages && retrieveData.data.messages.length > 0) {
            const answerMsg = retrieveData.data.messages.find(
              m => m.type === 'answer' && m.role === 'assistant'
            );
            if (answerMsg && answerMsg.content) {
              answer = answerMsg.content;
              break;
            }
          }
          
          // 如果retrieve中没有，调用message/list获取
          const msgRes = await fetch(
            `https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.COZE_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          const msgData = await msgRes.json();
          console.log('Message list:', JSON.stringify(msgData));
          
          if (msgData.code === 0 && msgData.data && Array.isArray(msgData.data)) {
            const answerMsg = msgData.data.find(
              m => m.type === 'answer' && m.role === 'assistant'
            );
            if (answerMsg && answerMsg.content) {
              answer = answerMsg.content;
              break;
            }
          }
          
          // 如果completed但没找到answer
          if (!answer) {
            answer = '对话已完成，但未找到回答内容，请重试。';
            break;
          }
        } 
        // 如果处理失败
        else if (status === 'failed') {
          const errorMsg = retrieveData.data.last_error?.msg || '未知错误';
          answer = '对话处理失败：' + errorMsg;
          break;
        }
        // 否则 status 还是 in_progress，继续轮询
      }
      
      attempts++;
    }
    
    // 如果轮询结束还没拿到答案
    if (!answer) {
      answer = '抱歉，AI 处理时间较长，请稍后重试。';
    }
    
    return res.status(200).json({ reply: answer, sources: [] });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(200).json({ 
      reply: '服务错误：' + error.message,
      sources: []
    });
  }
}
