// DeepSeek content script placeholder

// --- Element Selectors ---
const INPUT_SELECTOR = "#chat-input";
const SEND_BUTTON_SELECTOR = 'div[role="button"].ds-button--primary._3172d9f';

// --- Element Getters ---

/**
 * 获取聊天输入框元素。
 * @returns {HTMLTextAreaElement | null} 输入框元素或 null。
 */
function getInputElement() {
  return document.querySelector(INPUT_SELECTOR);
}

/**
 * 获取发送按钮元素。
 * @returns {HTMLDivElement | null} 发送按钮元素或 null。
 */
function getSendButtonElement() {
  return document.querySelector(SEND_BUTTON_SELECTOR);
}

// --- Event Handling ---

/**
 * 处理 Enter 键按下事件，拦截默认发送行为并触发 Mem0 处理流程。
 * @param {KeyboardEvent} event 键盘事件对象。
 */
async function handleEnterKey(event) {
  const inputElement = getInputElement();
  // 确保事件发生在目标输入框内，且按下的是 Enter 键（没有 Shift）
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    event.target === inputElement
  ) {
    console.log("Enter key pressed in DeepSeek input");
    event.preventDefault(); // 阻止默认的 Enter 行为 (发送消息)
    event.stopPropagation(); // 阻止事件冒泡

    // 检查记忆功能是否启用 (需要实现 getMemoryEnabledState)
    const memoryEnabled = await getMemoryEnabledState(); 
    if (!memoryEnabled) {
      console.log("Memory is disabled, triggering original send.");
      triggerSendAction(); // 直接触原始发送
      return;
    }

    // 调用核心处理函数 (需要实现 handleMem0Processing)
    await handleMem0Processing();
  }
}

// --- Initialization ---

/**
 * 设置事件监听器。
 */
function initializeMem0Integration() {
  // 使用事件捕获模式确保优先处理 Enter 键
  document.addEventListener("keydown", handleEnterKey, true);
  console.log("DeepSeek Mem0 integration initialized, listening for Enter key.");
}

// --- Helper Functions (Placeholders - Need Implementation) ---

/**
 * 获取记忆功能的启用状态。
 * (需要从 chrome.storage.sync 读取 'memory_enabled')
 * @returns {Promise<boolean>} 记忆是否启用。
 */
async function getMemoryEnabledState() {
  // Placeholder: 实际需要从 chrome.storage.sync 读取
  return new Promise((resolve) => {
    chrome.storage.sync.get("memory_enabled", (data) => {
      resolve(!!data.memory_enabled);
    });
  });
}

// --- Input/Output Helpers ---

/**
 * 获取输入框的当前值。
 * @returns {string | null} 输入框文本或 null。
 */
function getInputElementValue() {
  const inputElement = getInputElement();
  return inputElement ? inputElement.value : null;
}

/**
 * 设置输入框的值，并模拟输入事件让网站识别。
 * @param {string} value 要设置的值。
 */
function setInputElementValue(value) {
  const inputElement = getInputElement();
  if (inputElement) {
    inputElement.value = value;
    // 触发 input 事件，让 React/Vue 等框架感知变化
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    // 有些网站可能还需要 focus/blur
    inputElement.focus();
  }
}

// --- Authentication Helper ---

/**
 * 从 Chrome 存储中获取认证信息。
 * @returns {Promise<{apiKey: string | null, accessToken: string | null, userId: string | null}>} 认证信息对象。
 */
function getAuthDetails() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiKey", "access_token", "userId"], (items) => {
      resolve({
        apiKey: items.apiKey || null,
        accessToken: items.access_token || null,
        userId: items.userId || "chrome-extension-user", // Default user ID if not set
      });
    });
  });
}

// --- Mem0 API Callers ---
const MEM0_API_BASE_URL = "https://api.mem0.ai/v1";

/**
 * 调用 Mem0 API 搜索记忆。
 * @param {string} query 用户输入的查询。
 * @param {{apiKey: string | null, accessToken: string | null, userId: string}} auth 认证信息。
 * @returns {Promise<Array<any>>} 相关的记忆数组，如果出错则为空数组。
 */
async function searchMemories(query, auth) {
  if (!auth.userId || (!auth.apiKey && !auth.accessToken)) {
    console.error("Mem0 Search: Auth details missing.");
    return [];
  }

  const authHeader = auth.accessToken
    ? `Bearer ${auth.accessToken}`
    : `Token ${auth.apiKey}`;

  try {
    const response = await fetch(`${MEM0_API_BASE_URL}/memories/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        query: query,
        user_id: auth.userId,
        limit: 5, // Limit the number of memories retrieved
        threshold: 0.7 // Adjust relevance threshold as needed
      }),
    });

    if (!response.ok) {
      console.error(`Mem0 Search API Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.memories || [];
  } catch (error) {
    console.error("Error searching memories:", error);
    return [];
  }
}

/**
 * 调用 Mem0 API 添加新记忆。
 * @param {string} userContent 用户说的话。
 * @param {string | null} assistantContent AI 的回复 (可选)。
 * @param {{apiKey: string | null, accessToken: string | null, userId: string}} auth 认证信息。
 */
async function addMemory(userContent, assistantContent, auth) {
  if (!auth.userId || (!auth.apiKey && !auth.accessToken)) {
    console.error("Mem0 Add: Auth details missing.");
    return;
  }

  const authHeader = auth.accessToken
    ? `Bearer ${auth.accessToken}`
    : `Token ${auth.apiKey}`;

  const messages = [{ role: "user", content: userContent }];
  if (assistantContent) {
    messages.push({ role: "assistant", content: assistantContent });
  }

  try {
    const response = await fetch(`${MEM0_API_BASE_URL}/memories/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        messages: messages,
        user_id: auth.userId,
        metadata: {
          provider: "DeepSeek", // Mark the source
        },
      }),
    });

    if (!response.ok) {
      console.error(`Mem0 Add API Error: ${response.status}`);
    } else {
      console.log("Memory added successfully via DeepSeek script.");
    }
  } catch (error) {
    console.error("Error adding memory:", error);
  }
}

/**
 * 触发 DeepSeek 的原始发送操作。
 * (需要点击发送按钮)
 */
function triggerSendAction() {
  const sendButton = getSendButtonElement();
  if (sendButton) {
    console.log("Clicking original send button");
    sendButton.click();
  } else {
    console.error("Send button not found, cannot trigger send action.");
  }
}

/**
 * Mem0 核心处理逻辑
 * (负责获取输入、搜索记忆、修改 Prompt、触发发送、添加记忆)
 */
async function handleMem0Processing() {
  console.log("handleMem0Processing called");
  const originalPrompt = getInputElementValue();
  if (!originalPrompt) {
    console.log("Input is empty, triggering original send.");
    triggerSendAction();
    return;
  }

  const auth = await getAuthDetails();

  // 1. 搜索相关记忆
  const memories = await searchMemories(originalPrompt, auth);

  let finalPrompt = originalPrompt;

  // 2. 构建增强 Prompt (如果找到记忆)
  if (memories && memories.length > 0) {
    console.log(`Found ${memories.length} relevant memories.`);
    let memoryContext = "Here is some of my preferences/memories to help answer better:\n";
    memories.forEach((mem, index) => {
      // 假设记忆内容在 mem.text 或 mem.content
      const memoryText = mem.text || mem.content;
      if (memoryText) {
        memoryContext += `- ${memoryText}\n`;
      }
    });
    finalPrompt = `${memoryContext}\n\nUser Question: ${originalPrompt}`;
  } else {
    console.log("No relevant memories found.");
  }

  // 3. 更新输入框
  setInputElementValue(finalPrompt);

  // 4. 触发发送 (需要一点延迟让输入框更新生效)
  setTimeout(() => {
      console.log("Triggering send after Mem0 processing.");
      triggerSendAction();
  }, 100); // 100ms 延迟

  // 5. 异步添加新记忆 (仅添加用户的问题，不包含 AI 回复)
  //    更复杂的实现可以监听 AI 回复并一起添加
  addMemory(originalPrompt, null, auth);

}

console.log('DeepSeek content script loaded.');
initializeMem0Integration();

// 稍后测试
/*
setTimeout(() => {
  const input = getInputElement();
  const button = getSendButtonElement();
  console.log('Input Element:', input);
  console.log('Send Button Element:', button);
}, 5000); // Wait 5 seconds for the page to likely load
*/