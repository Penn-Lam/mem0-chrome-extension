console.log("--- DeepSeek Content Script Top Level --- Script is Loading...");

// DeepSeek content script placeholder

// --- Element Selectors ---
const INPUT_SELECTOR = "#chat-input";
// 移除 aria-disabled 检查，因为脚本运行时按钮可能暂时是禁用的
const SEND_BUTTON_SELECTOR = 'div[role="button"]:has(svg)';

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
  console.log("--- DeepSeek Content Script --- Calling initializeMem0Integration...");
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
 * @returns {Promise<Array<any>>} 相关的记忆数组，如果出错则为空数组。
 */
function searchMemories(query) {
  return new Promise(async (resolve, reject) => {
    try {
      const items = await chrome.storage.sync.get(["apiKey", "userId", "access_token"]);
      if (!items.access_token) {
        console.error("Access token not found for searching memories.");
        return reject(new Error("Access token not found"));
      }

      const payload = {
        endpoint: '/v1/memories/search/', // <<< 添加斜杠
        method: 'POST',
        apiKey: items.apiKey, // 传递 apiKey 和 userId (如果后台需要)
        userId: items.userId,
        accessToken: items.access_token,
        body: { 
          query: query,
          user_id: items.userId // <<< 将 user_id 添加到请求体中
        }
      };

      console.log("Sending search request to background script:", payload);
      chrome.runtime.sendMessage({ type: 'mem0ApiRequest', payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background:', chrome.runtime.lastError);
          return reject(new Error(chrome.runtime.lastError.message || "Failed to communicate with background script"));
        }
        console.log('Received response from background for search:', response);
        if (response && response.success) {
          resolve(response.data);
        } else {
          // 从后台获取更详细的错误信息
          const errorMsg = response && response.error ? response.error.message : "Unknown error during memory search";
          console.error("Error searching memories from background:", response ? response.error : 'No response');
          reject(new Error(errorMsg));
        }
      });
    } catch (error) {
      console.error("Error preparing search request:", error);
      reject(error);
    }
  });
}

/**
 * 将单个记忆添加到 Mem0。
 * @param {string} memoryText 记忆内容。
 */
function addMemory(memoryText) {
  return new Promise(async (resolve, reject) => {
    try {
      const items = await chrome.storage.sync.get(["apiKey", "userId", "access_token"]);
      if (!items.access_token) {
        console.error("Access token not found for adding memory.");
        return reject(new Error("Access token not found"));
      }

      const payload = {
        endpoint: '/v1/memories/', // <<< 添加斜杠
        method: 'POST',
        apiKey: items.apiKey,
        userId: items.userId,
        accessToken: items.access_token,
        body: { text: memoryText }
      };

      console.log("Sending add memory request to background script:", payload);
      chrome.runtime.sendMessage({ type: 'mem0ApiRequest', payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background:', chrome.runtime.lastError);
          return reject(new Error(chrome.runtime.lastError.message || "Failed to communicate with background script"));
        }
        console.log('Received response from background for add memory:', response);
        if (response && response.success) {
          console.log("Memory added successfully via background script.");
          resolve(response.data); // 假设成功时可能返回数据
        } else {
          const errorMsg = response && response.error ? response.error.message : "Unknown error adding memory";
          console.error("Error adding memory from background:", response ? response.error : 'No response');
          reject(new Error(errorMsg));
        }
      });
    } catch (error) {
      console.error("Error preparing add memory request:", error);
      reject(error);
    }
  });
}

/**
 * 触发 DeepSeek 的原始发送操作。
 * (需要点击发送按钮)
 */
function triggerSendAction() {
  console.log(`Attempting to find send button with selector: ${SEND_BUTTON_SELECTOR}`);
  const sendButton = getSendButtonElement();
  if (sendButton) {
    console.log("Send button FOUND:", sendButton);
    // 检查按钮是否明确被禁用
    if (sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') {
      console.warn("Send button found but appears to be disabled. Cannot click automatically.");
      // 在这里，我们或许不应该点击，让用户手动点击？
      // 或者尝试等待一小段时间再检查/点击？
      // 目前策略：不点击禁用的按钮
    } else {
      console.log("Attempting to click enabled send button");
      sendButton.click();
      console.log("Click attempt finished for send button.");
    }
  } else {
    console.error("Send button NOT FOUND with the current selector.");
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
  const memories = await searchMemories(originalPrompt);

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