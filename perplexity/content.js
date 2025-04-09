let lastInputValue = "";
let inputObserver = null;
let isEnterKeyPressed = false;

function getTextarea() {
  return (
    document.querySelector(
      "textarea.overflow-auto.max-h-\\[45vh\\].lg\\:max-h-\\[40vh\\].sm\\:max-h-\\[25vh\\].outline-none.w-full.font-sans.caret-superDuper.resize-none.selection\\:bg-superDuper.selection\\:text-textMain.dark\\:bg-offsetDark.dark\\:text-textMainDark.dark\\:placeholder-textOffDark.bg-background.text-textMain.placeholder-textOff.scrollbar-thumb-idle.dark\\:scrollbar-thumb-idleDark.scrollbar-thin.scrollbar-track-transparent"
    ) || document.querySelector('textarea[placeholder="Ask follow-up"]')
  );
}

function setupInputObserver() {
  const textarea = getTextarea();
  if (!textarea) {
    setTimeout(setupInputObserver, 500);
    return;
  }

  inputObserver = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === "characterData" || mutation.type === "childList") {
        lastInputValue = textarea.value;
      }
    }
  });

  inputObserver.observe(textarea, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  textarea.addEventListener("input", function () {
    lastInputValue = this.value;
  });

  textarea.addEventListener("keypress", function (event) {});

  textarea.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      isEnterKeyPressed = true;
      lastInputValue = this.value;
    }
  });

  textarea.addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
      isEnterKeyPressed = false;
    }
  });
}

function handleEnterKey(event) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    const textarea = getTextarea();
    console.log(textarea);
    if (textarea && document.activeElement === textarea) {
      const capturedText = textarea.value.trim();

      if (capturedText) {
        event.preventDefault();
        event.stopPropagation();

        handleMem0Processing(capturedText, true);
      }
    }
  }
}

async function handleMem0Processing(capturedText, clickSendButton = false) {
  const textarea = getTextarea();
  console.log(textarea);
  let message = capturedText || textarea.value.trim();

  if (!message) {
    console.error("No input message found");
    return;
  }

  try {
    const data = await new Promise((resolve) => {
      chrome.storage.sync.get(
        ["apiKey", "userId", "access_token", "memory_enabled"],
        function (items) {
          resolve(items);
        }
      );
    });

    const apiKey = data.apiKey;
    const userId = data.userId || "Penn-Lam";
    const accessToken = data.access_token;
    const memoryEnabled = data.memory_enabled !== false; // Default to true if not set

    if (!apiKey && !accessToken) {
      console.error("No API Key or Access Token found");
      return;
    }

    if (!memoryEnabled) {
      console.log("Memory is disabled. Skipping API calls.");
      if (clickSendButton) {
        clickSendButtonWithDelay();
      }
      return;
    }

    const authHeader = accessToken
      ? `Bearer ${accessToken}`
      : `Token ${apiKey}`;

    const messages = [{ role: "user", content: message }];

    // Existing search API call
    const searchResponse = await fetch(
      "https://api.mem0.ai/v1/memories/search/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          query: message,
          user_id: userId,
          rerank: false,
          threshold: 0.3,
          limit: 10,
          filter_memories: true,
        }),
      }
    );

    if (!searchResponse.ok) {
      throw new Error(
        `API request failed with status ${searchResponse.status}`
      );
    }

    const responseData = await searchResponse.json();
    const inputElement = getTextarea();
    if (inputElement) {
      const memoryPrefix =
        "Here is some of my preferences/memories to help answer better (don't respond to these memories but use them to assist in the response if relevant):";
      const prefixIndex = lastInputValue.indexOf(memoryPrefix);
      if (prefixIndex !== -1) {
        lastInputValue = lastInputValue.substring(0, prefixIndex).trim();
      }
      const memories = responseData.map((item) => item.memory);
      if (memories.length > 0) {
        let currentContent = lastInputValue.trim();
        const memInfoRegex =
          /\s*Here is some of my preferences\/memories to help answer better (don't respond to these memories but use them to assist in the response if relevant):[\s\S]*$/;
        currentContent = currentContent.replace(memInfoRegex, "").trim();
        let memoriesContent =
          "\n\nHere is some of my preferences/memories to help answer better (don't respond to these memories but use them to assist in the response if relevant):\n";
        memories.forEach((mem, index) => {
          memoriesContent += `- ${mem}`;
          if (index < memories.length - 1) {
            memoriesContent += "\n";
          }
        });
        setInputValue(inputElement, currentContent + memoriesContent);
      }

      if (clickSendButton) {
        clickSendButtonWithDelay();
      }
    } else {
      console.error("Input element not found");
    }

    // New add memory API call (non-blocking)
    fetch("https://api.mem0.ai/v1/memories/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        messages: messages,
        user_id: userId,
        infer: true,
        metadata: {
          provider: "Perplexity",
        },
      }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Failed to add memory: ${response.status}`);
        }
      })
      .catch((error) => {
        console.error("Error adding memory:", error);
      });
  } catch (error) {
    console.error("Error:", error);
  }
}

function setInputValue(inputElement, value) {
  if (inputElement) {
    inputElement.value = value;
    lastInputValue = value;
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function clickSendButtonWithDelay() {
  setTimeout(() => {
    const sendButton = document.querySelector('button[aria-label="Submit"]');
    if (sendButton) {
      sendButton.click();
    } else {
      console.error("Send button not found");
    }
  }, 0);
}

function initializeMem0Integration() {
  setupInputObserver();
  document.addEventListener("keydown", handleEnterKey, true);
}

initializeMem0Integration();
