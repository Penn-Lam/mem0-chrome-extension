# ChatGPT 记忆数据同步到 Mem0 的实现原理

这个 Chrome 插件通过以下方式将 ChatGPT 的记忆数据同步到 Mem0：

## 同步触发

1. 插件在 ChatGPT 的记忆设置页面添加了一个"同步"按钮。
2. 用户点击同步按钮时，会触发 `handleSyncClick` 函数。
3. 首先检查记忆功能是否启用，如果禁用则显示提示信息并返回。

## 数据获取

1. 插件会查找页面中包含记忆数据的表格（使用选择器 `table.w-full.border-separate.border-spacing-0`）。
2. 遍历表格中的每一行（`tbody tr`），从每行的第一个单元格（`td`）中提取记忆内容。
3. 对于每条记忆，创建一个标准格式的记忆对象：
   ```javascript
   {
     role: "user",
     content: `Remember this about me: ${content}`,
     timestamp: new Date().toISOString()
   }
   ```

## 同步过程

插件采用了双重同步策略：

### 1. 单条同步
- 通过 `sendMemoryToMem0` 函数逐条发送记忆
- 使用计数器跟踪同步进度
- 实时更新同步状态（例如："X/Y memories synced"）

### 2. 批量同步
- 同时使用 `sendMemoriesToMem0` 函数批量发送所有记忆
- 这是一个额外的保障机制，确保所有数据都被同步

## API 调用

插件通过 Mem0 的 API 发送记忆数据：

1. **认证处理**：
   - 从 Chrome 存储中获取认证信息（`apiKey` 或 `access_token`）
   - 根据认证类型构建不同的认证头：
     - `Bearer ${access_token}` 或 `Token ${apiKey}`

2. **数据发送**：
   - 端点：`https://api.mem0.ai/v1/memories/`
   - 方法：POST
   - 请求体格式：
     ```javascript
     {
       messages: [{ content: "记忆内容", role: "user" }],
       user_id: "用户ID",
       infer: true,
       metadata: {
         provider: "ChatGPT"
       }
     }
     ```

## 用户反馈

1. **同步状态指示**：
   - 同步按钮会显示加载状态
   - 显示同步进度（例如："3/5 memories synced"）
   - 同步完成或出错时显示相应提示

2. **错误处理**：
   - 如果单条记忆同步失败，继续同步其他记忆
   - 如果批量同步失败，显示错误提示
   - 所有错误都会在控制台记录

## 注意事项

1. 同步前会检查记忆功能是否启用
2. 需要用户已经登录（有 API Key 或 Access Token）
3. 同步是双向的：单条同步和批量同步同时进行，提供额外的可靠性
4. 每条记忆都会被标记为来自 ChatGPT 的数据（provider: "ChatGPT"）
