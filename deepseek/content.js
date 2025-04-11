console.log("--- DeepSeek Content Script STARTING --- "); // <<< 最顶部的日志

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
        endpoint: '/v1/memories/search/', 
        method: 'POST',
        apiKey: items.apiKey, 
        userId: items.userId,
        accessToken: items.access_token,
        body: { 
          query: query,
          user_id: items.userId 
        }
      };

      console.log("Sending search request to background script:", payload);
      chrome.runtime.sendMessage({ type: 'mem0ApiRequest', payload }, (response) => {
        console.log("Content script received response from background for search:", response); 
        if (chrome.runtime.lastError) {
          console.error('Error sending message to background:', chrome.runtime.lastError);
          return reject(new Error(chrome.runtime.lastError.message || "Failed to communicate with background script"));
        }
        console.log('Received response from background for search:', response);
        if (response && response.success) {
          console.log("Search successful, resolving with data:", response.data); 
          resolve(response.data);
        } else {
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
        endpoint: '/v1/memories/', 
        method: 'POST',
        apiKey: items.apiKey,
        userId: items.userId,
        accessToken: items.access_token,
        body: { 
          messages: [
            { 
              role: "user", 
              content: memoryText 
            }
          ],
          user_id: items.userId 
        }
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
          resolve(response.data); 
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
async function triggerSendAction() {
  // More specific selector to find the send button, excluding the 'Deep Thinking' one
  // Tries to find a div with role=button containing an SVG, but NOT containing a span with '深度思考'
  const sendButtonSelector = 'div[role="button"]:has(svg):not(:has(span:contains("深度思考")))'; 
  // Fallback selectors might be needed if the structure changes
  // const sendButtonSelector = 'button[aria-label*="Send"], button[aria-label*="发送"]'; // Alternative
  console.log("Attempting to find send button with selector:", sendButtonSelector);

  const sendButton = document.querySelector(sendButtonSelector);

  if (sendButton) {
    console.log("Send button FOUND:", sendButton);
    // Check if the button is disabled (some sites use aria-disabled or disabled attribute)
    const isDisabled = sendButton.getAttribute('aria-disabled') === 'true' || sendButton.disabled;

    if (!isDisabled) {
      console.log("Attempting to click enabled send button");
      sendButton.click();
      console.log("Click attempt finished for send button.");
    } else {
      console.log("Send button found but it is disabled.");
      // Optionally, wait and retry, or inform the user
    }
  } else {
    console.error("Send button not found with selector:", sendButtonSelector);
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
  let memories = [];
  try {
    console.log("Calling searchMemories..."); 
    memories = await searchMemories(originalPrompt);
    console.log("searchMemories returned:", memories); 
  } catch (error) {
    console.error("Error searching memories:", error);
    // Decide if you want to proceed without memories or stop
    // Proceeding without memories for now
  }

  console.log(`Found ${memories?.length || 0} memories.`); 

  let finalPrompt = originalPrompt;
  if (memories && memories.length > 0) {
    console.log(`Found ${memories.length} relevant memories.`);
    // Use the exact introductory text provided by the user
    let memoryContext = "Here is some of my preferences/memories to help answer better (don't respond to these memories but use them to assist in the response if relevant):\n"; 
    memoryContext += memories.map(m => `- ${m.memory}`).join('\n');
    // Construct the final prompt with original query first, then memories
    finalPrompt = `${originalPrompt}\n\n${memoryContext}`;
    console.log("Generated prompt with context (new format):", finalPrompt);
  } else {
    console.log("No relevant memories found, using original prompt.");
  }

  // <<< --- START: Re-add input field update --- >>>
  const inputElement = document.querySelector('textarea[placeholder*="DeepSeek"], div[aria-label*="DeepSeek"], textarea#chat-input'); // Try common selectors
  if (inputElement) {
    console.log("Found input element:", inputElement);
    // Update value based on element type
    if (inputElement.tagName === 'TEXTAREA') {
      inputElement.value = finalPrompt;
    } else if (inputElement.isContentEditable) {
      inputElement.textContent = finalPrompt;
    }
    // Dispatch input events to make the site recognize the change
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    console.log('Updated input field with final prompt.');
  } else {
    console.error("Could not find DeepSeek input element to update prompt. Sending might use stale data.");
    // Consider falling back or notifying the user
  }
  // <<< --- END: Re-add input field update --- >>>

  // Now trigger the send action (which just clicks the button)
  console.log("Triggering send action AFTER potentially updating input field.");
  await triggerSendAction(); // Pass the potentially modified prompt here

  // Add the current interaction to memory (do this *after* sending)
  try {
    console.log("Calling addMemory for input:", originalPrompt);
    await addMemory(originalPrompt); 
    console.log("Successfully added memory for input:", originalPrompt);
  } catch (error) {
    console.error("Error adding memory:", error);
  }
}

console.log('DeepSeek content script loaded.');
initializeMem0Integration();