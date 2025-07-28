/**
 * 消息处理工具类
 * 实现插件各组件间的消息传递和通信管理
 */
class MessageHandlerUtils {
    constructor() {
        // 消息类型常量
        this.MESSAGE_TYPES = {
            // 控制消息
            START_COLLECTION: 'start_collection',
            PAUSE_COLLECTION: 'pause_collection',
            RESUME_COLLECTION: 'resume_collection',
            STOP_COLLECTION: 'stop_collection',
            
            // 状态消息
            STATUS_UPDATE: 'status_update',
            DATA_UPDATE: 'data_update',
            ERROR_OCCURRED: 'error_occurred',
            
            // 数据操作
            EXPORT_DATA: 'export_data',
            CLEAR_DATA: 'clear_data',
            GET_DATA: 'get_data',
            
            // 设置操作
            UPDATE_SETTINGS: 'update_settings',
            GET_SETTINGS: 'get_settings',
            RESET_SETTINGS: 'reset_settings',
            
            // 页面检查
            CHECK_PAGE: 'check_page',
            PAGE_READY: 'page_ready',
            
            // 通知消息
            SHOW_NOTIFICATION: 'show_notification',
            
            // 系统消息
            PING: 'ping',
            PONG: 'pong'
        };
        
        // 消息监听器
        this.listeners = new Map();
        
        // 消息队列
        this.messageQueue = [];
        this.isProcessingQueue = false;
        
        // 响应超时设置
        this.responseTimeout = 10000; // 10秒
        this.pendingResponses = new Map();
        
        // 重试配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffFactor: 2
        };
        
        this.init();
    }
    
    /**
     * 初始化消息处理器
     */
    init() {
        // 监听来自其他组件的消息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleIncomingMessage(message, sender, sendResponse);
                return true; // 保持消息通道开放
            });
        }
        
        // 监听标签页更新
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.status === 'complete' && this.isXHSPage(tab.url)) {
                    this.broadcast(this.MESSAGE_TYPES.PAGE_READY, {
                        tabId: tabId,
                        url: tab.url
                    });
                }
            });
        }
        
        console.log('消息处理器初始化完成');
    }
    
    /**
     * 处理接收到的消息
     * @param {Object} message 消息对象
     * @param {Object} sender 发送者信息
     * @param {Function} sendResponse 响应函数
     */
    async handleIncomingMessage(message, sender, sendResponse) {
        try {
            console.log('收到消息:', message.type, message);
            
            // 验证消息格式
            if (!this.validateMessage(message)) {
                sendResponse({
                    success: false,
                    error: '无效的消息格式'
                });
                return;
            }
            
            // 处理ping消息
            if (message.type === this.MESSAGE_TYPES.PING) {
                sendResponse({
                    success: true,
                    type: this.MESSAGE_TYPES.PONG,
                    timestamp: Date.now()
                });
                return;
            }
            
            // 处理响应消息
            if (message.responseId && this.pendingResponses.has(message.responseId)) {
                const { resolve } = this.pendingResponses.get(message.responseId);
                this.pendingResponses.delete(message.responseId);
                resolve(message);
                return;
            }
            
            // 分发消息给监听器
            const result = await this.dispatchMessage(message, sender);
            
            // 发送响应
            if (sendResponse) {
                sendResponse({
                    success: true,
                    data: result,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('处理消息失败:', error);
            
            if (sendResponse) {
                sendResponse({
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
    }
    
    /**
     * 分发消息给监听器
     * @param {Object} message 消息对象
     * @param {Object} sender 发送者信息
     * @returns {*} 处理结果
     */
    async dispatchMessage(message, sender) {
        const listeners = this.listeners.get(message.type) || [];
        
        if (listeners.length === 0) {
            console.warn(`没有找到消息类型 ${message.type} 的监听器`);
            return null;
        }
        
        // 执行所有监听器
        const results = [];
        for (const listener of listeners) {
            try {
                const result = await listener(message.data, sender, message);
                results.push(result);
            } catch (error) {
                console.error(`监听器执行失败:`, error);
                results.push({ error: error.message });
            }
        }
        
        return results.length === 1 ? results[0] : results;
    }
    
    /**
     * 验证消息格式
     * @param {Object} message 消息对象
     * @returns {boolean} 是否有效
     */
    validateMessage(message) {
        return message && 
               typeof message === 'object' && 
               typeof message.type === 'string' &&
               Object.values(this.MESSAGE_TYPES).includes(message.type);
    }
    
    /**
     * 发送消息
     * @param {string} type 消息类型
     * @param {*} data 消息数据
     * @param {Object} options 发送选项
     * @returns {Promise<*>} 响应结果
     */
    async sendMessage(type, data = null, options = {}) {
        const {
            target = 'background',
            tabId = null,
            expectResponse = true,
            timeout = this.responseTimeout,
            retries = this.retryConfig.maxRetries
        } = options;
        
        const message = {
            type,
            data,
            timestamp: Date.now(),
            id: this.generateMessageId()
        };
        
        // 如果期望响应，添加响应ID
        if (expectResponse) {
            message.responseId = message.id;
        }
        
        console.log('发送消息:', type, message);
        
        try {
            return await this.sendMessageWithRetry(message, target, tabId, timeout, retries);
        } catch (error) {
            console.error('发送消息失败:', error);
            throw error;
        }
    }
    
    /**
     * 带重试的消息发送
     * @param {Object} message 消息对象
     * @param {string} target 目标
     * @param {number} tabId 标签页ID
     * @param {number} timeout 超时时间
     * @param {number} retries 重试次数
     * @returns {Promise<*>} 响应结果
     */
    async sendMessageWithRetry(message, target, tabId, timeout, retries) {
        let lastError;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    console.log(`重试发送消息 (第${attempt}次):`, message.type);
                }
                
                return await this.performSend(message, target, tabId, timeout);
                
            } catch (error) {
                lastError = error;
                console.warn(`消息发送失败 (尝试${attempt + 1}/${retries + 1}):`, error.message);
            }
        }
        
        throw lastError;
    }
    
    /**
     * 执行消息发送
     * @param {Object} message 消息对象
     * @param {string} target 目标
     * @param {number} tabId 标签页ID
     * @param {number} timeout 超时时间
     * @returns {Promise<*>} 响应结果
     */
    async performSend(message, target, tabId, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (message.responseId) {
                    this.pendingResponses.delete(message.responseId);
                }
                reject(new Error(`消息发送超时: ${message.type}`));
            }, timeout);
            
            // 如果期望响应，设置响应处理
            if (message.responseId) {
                this.pendingResponses.set(message.responseId, {
                    resolve: (response) => {
                        clearTimeout(timeoutId);
                        resolve(response);
                    },
                    reject: (error) => {
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                });
            }
            
            try {
                if (target === 'background') {
                    // 发送到后台脚本
                    chrome.runtime.sendMessage(message, (response) => {
                        if (chrome.runtime.lastError) {
                            clearTimeout(timeoutId);
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        
                        if (!message.responseId) {
                            clearTimeout(timeoutId);
                            resolve(response);
                        }
                    });
                    
                } else if (target === 'content' && tabId) {
                    // 发送到内容脚本
                    chrome.tabs.sendMessage(tabId, message, (response) => {
                        if (chrome.runtime.lastError) {
                            clearTimeout(timeoutId);
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        
                        if (!message.responseId) {
                            clearTimeout(timeoutId);
                            resolve(response);
                        }
                    });
                    
                } else {
                    clearTimeout(timeoutId);
                    reject(new Error(`无效的发送目标: ${target}`));
                }
                
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    /**
     * 广播消息
     * @param {string} type 消息类型
     * @param {*} data 消息数据
     * @param {Object} options 广播选项
     */
    async broadcast(type, data = null, options = {}) {
        const {
            includeBackground = true,
            includeContent = true,
            onlyXHSPages = true
        } = options;
        
        const promises = [];
        
        // 发送到后台脚本
        if (includeBackground) {
            promises.push(
                this.sendMessage(type, data, {
                    target: 'background',
                    expectResponse: false
                }).catch(error => {
                    console.warn('广播到后台脚本失败:', error.message);
                })
            );
        }
        
        // 发送到内容脚本
        if (includeContent && typeof chrome !== 'undefined' && chrome.tabs) {
            try {
                const tabs = await chrome.tabs.query({});
                
                for (const tab of tabs) {
                    if (onlyXHSPages && !this.isXHSPage(tab.url)) {
                        continue;
                    }
                    
                    promises.push(
                        this.sendMessage(type, data, {
                            target: 'content',
                            tabId: tab.id,
                            expectResponse: false
                        }).catch(error => {
                            console.warn(`广播到标签页 ${tab.id} 失败:`, error.message);
                        })
                    );
                }
            } catch (error) {
                console.error('获取标签页列表失败:', error);
            }
        }
        
        await Promise.allSettled(promises);
    }
    
    /**
     * 添加消息监听器
     * @param {string} type 消息类型
     * @param {Function} listener 监听器函数
     */
    addListener(type, listener) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        
        this.listeners.get(type).push(listener);
        console.log(`添加消息监听器: ${type}`);
    }
    
    /**
     * 移除消息监听器
     * @param {string} type 消息类型
     * @param {Function} listener 监听器函数
     */
    removeListener(type, listener) {
        if (!this.listeners.has(type)) {
            return;
        }
        
        const listeners = this.listeners.get(type);
        const index = listeners.indexOf(listener);
        
        if (index > -1) {
            listeners.splice(index, 1);
            console.log(`移除消息监听器: ${type}`);
        }
        
        if (listeners.length === 0) {
            this.listeners.delete(type);
        }
    }
    
    /**
     * 移除所有监听器
     * @param {string} type 消息类型（可选）
     */
    removeAllListeners(type = null) {
        if (type) {
            this.listeners.delete(type);
            console.log(`移除所有 ${type} 监听器`);
        } else {
            this.listeners.clear();
            console.log('移除所有消息监听器');
        }
    }
    
    /**
     * 检查是否为小红书页面
     * @param {string} url 页面URL
     * @returns {boolean} 是否为小红书页面
     */
    isXHSPage(url) {
        if (!url) return false;
        
        const xhsDomains = [
            'xiaohongshu.com',
            'xhscdn.com',
            'xhs.cn'
        ];
        
        return xhsDomains.some(domain => url.includes(domain));
    }
    
    /**
     * 生成消息ID
     * @returns {string} 消息ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 获取当前活动的小红书标签页
     * @returns {Promise<Object|null>} 标签页信息
     */
    async getActiveXHSTab() {
        if (typeof chrome === 'undefined' || !chrome.tabs) {
            return null;
        }
        
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            
            for (const tab of tabs) {
                if (this.isXHSPage(tab.url)) {
                    return tab;
                }
            }
            
            // 如果当前标签页不是小红书，查找所有小红书标签页
            const allTabs = await chrome.tabs.query({});
            for (const tab of allTabs) {
                if (this.isXHSPage(tab.url)) {
                    return tab;
                }
            }
            
            return null;
        } catch (error) {
            console.error('获取活动标签页失败:', error);
            return null;
        }
    }
    
    /**
     * 检查连接状态
     * @param {string} target 目标
     * @param {number} tabId 标签页ID
     * @returns {Promise<boolean>} 是否连接
     */
    async checkConnection(target = 'background', tabId = null) {
        try {
            const response = await this.sendMessage(
                this.MESSAGE_TYPES.PING,
                null,
                {
                    target,
                    tabId,
                    timeout: 3000,
                    retries: 1
                }
            );
            
            return response && response.type === this.MESSAGE_TYPES.PONG;
        } catch (error) {
            console.warn(`连接检查失败 (${target}):`, error.message);
            return false;
        }
    }
    
    /**
     * 等待页面准备就绪
     * @param {number} timeout 超时时间
     * @returns {Promise<Object>} 页面信息
     */
    async waitForPageReady(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.removeListener(this.MESSAGE_TYPES.PAGE_READY, listener);
                reject(new Error('等待页面准备超时'));
            }, timeout);
            
            const listener = (data) => {
                clearTimeout(timeoutId);
                this.removeListener(this.MESSAGE_TYPES.PAGE_READY, listener);
                resolve(data);
            };
            
            this.addListener(this.MESSAGE_TYPES.PAGE_READY, listener);
        });
    }
    
    /**
     * 创建消息代理
     * @param {string} target 目标
     * @param {number} tabId 标签页ID
     * @returns {Object} 消息代理对象
     */
    createProxy(target = 'background', tabId = null) {
        return {
            send: (type, data, options = {}) => {
                return this.sendMessage(type, data, {
                    target,
                    tabId,
                    ...options
                });
            },
            
            checkConnection: () => {
                return this.checkConnection(target, tabId);
            },
            
            on: (type, listener) => {
                this.addListener(type, listener);
            },
            
            off: (type, listener) => {
                this.removeListener(type, listener);
            }
        };
    }
    
    /**
     * 销毁消息处理器
     */
    destroy() {
        // 清理所有监听器
        this.removeAllListeners();
        
        // 清理待处理的响应
        for (const [id, { reject }] of this.pendingResponses) {
            reject(new Error('消息处理器已销毁'));
        }
        this.pendingResponses.clear();
        
        // 清理消息队列
        this.messageQueue = [];
        
        console.log('消息处理器已销毁');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageHandlerUtils;
} else if (typeof window !== 'undefined') {
    window.MessageHandlerUtils = MessageHandlerUtils;
}