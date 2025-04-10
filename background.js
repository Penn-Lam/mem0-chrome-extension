console.log("Mem0 Background Service Worker started.");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Mem0 extension installed or updated.");
  // 可以设置一些默认的存储值
  chrome.storage.sync.set({ memoryEnabled: true }).catch(err => console.error("Error setting default storage:", err));
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);

  // 确保异步响应函数被保留
  let keepResponseChannelOpen = false;

  if (request.type === 'mem0ApiRequest') {
    keepResponseChannelOpen = true; // 标记我们需要异步发送响应
    handleMem0ApiRequest(request.payload)
      .then(response => {
        console.log('Background sending success response:', response);
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('Background sending error response:', error);
        // 将错误信息转换为可序列化的格式
        sendResponse({ success: false, error: { message: error.message, name: error.name, stack: error.stack } });
      });
  }

  // 返回 true 以表明我们将异步发送响应
  return keepResponseChannelOpen;
});

// 处理 Mem0 API 请求的通用函数
async function handleMem0ApiRequest(payload) {
  const { endpoint, method, apiKey, userId, accessToken, body } = payload;
  const url = `https://api.mem0.ai${endpoint}`; // 构建完整 URL

  console.log(`Background making fetch to: ${method} ${url}`);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}` // 或者使用 apiKey/userId? 检查 API 文档
    // 根据 Mem0 API 的要求添加其他必要的头，比如 X-User-Id ?
    // 'X-User-Id': userId // 如果需要的话
  };

  try {
    const response = await fetch(url, {
      method: payload.method, // 确保这里使用了传递过来的 method 变量
      headers: headers,
      body: body ? JSON.stringify(body) : null,
      redirect: 'manual' // 阻止自动重定向
    });

    // 手动处理重定向
    if (response.status >= 300 && response.status < 400 && response.headers.has('Location')) {
      const redirectUrl = response.headers.get('Location');
      console.warn(`API returned redirect status ${response.status} to: ${redirectUrl}. Original request to ${url} failed due to potential redirect issue changing method to GET.`);
      // 可以选择不处理，直接抛出错误，因为 API 端点不应该重定向 POST 请求
      throw new Error(`API endpoint ${endpoint} unexpectedly redirected (status ${response.status}) to ${redirectUrl}. POST method might have been changed to GET on follow.`);
    }

    // 检查 HTTP 状态码 (除了重定向)
    if (!response.ok) { // ok 检查 200-299
      const errorText = await response.text();
      console.error(`API request failed with status ${response.status}: ${errorText}`);
      // 明确检查 405，并提示可能原因
      if (response.status === 405) {
         console.error("Received 405 Method Not Allowed. This often happens if a POST request was incorrectly changed to GET, possibly during a redirect.");
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 尝试解析 JSON，如果响应体为空则返回 null
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      console.log('Background received API response data:', data);
      return data;
    } else {
      // 如果不是 JSON 或响应体为空
      const textData = await response.text();
      console.log('Background received non-JSON API response:', textData);
      if (response.status === 204 || textData.length === 0) { // No Content
        return null; // 或 {} 根据需要返回
      }
      // 如果有文本内容但不是 JSON，可能需要特殊处理或视为错误
      return { rawResponse: textData };
    }

  } catch (error) {
    console.error("Fetch error in background script:", error);
    // 重新抛出错误，以便上层 catch 处理并发送回 content script
    throw error;
  }
}

// Keep the existing message listener for opening dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openDashboard") {
    chrome.tabs.create({ url: request.url });
  }
});

chrome.action.onClicked.addListener((tab) => {
  // Check auth status and open popup or toggle sidebar
  chrome.storage.sync.get(["apiKey", "access_token"], function (data) {
    if (data.apiKey || data.access_token) {
      chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
    } else {
      chrome.action.openPopup();
    }
  });
});

// Initial setting when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ memory_enabled: true }, function() {
    console.log('Memory enabled set to true on install/update');
  });
});
