/**
 * 通用工具类
 * 提供常用的辅助函数和工具方法
 */
class CommonUtils {
    /**
     * 延迟执行
     * @param {number} ms 延迟时间（毫秒）
     * @returns {Promise} Promise对象
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 生成随机延迟
     * @param {number} min 最小延迟（毫秒）
     * @param {number} max 最大延迟（毫秒）
     * @returns {Promise} Promise对象
     */
    static randomDelay(min, max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return this.delay(delay);
    }
    
    /**
     * 生成唯一ID
     * @param {string} prefix 前缀
     * @returns {string} 唯一ID
     */
    static generateId(prefix = 'id') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }
    
    /**
     * 格式化时间戳
     * @param {number} timestamp 时间戳
     * @param {string} format 格式
     * @returns {string} 格式化后的时间
     */
    static formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
        const date = new Date(timestamp);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes 字节数
     * @param {number} decimals 小数位数
     * @returns {string} 格式化后的大小
     */
    static formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    /**
     * 格式化数字
     * @param {number} num 数字
     * @param {string} locale 地区
     * @returns {string} 格式化后的数字
     */
    static formatNumber(num, locale = 'zh-CN') {
        if (typeof num !== 'number') {
            return '0';
        }
        
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '万';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        
        return num.toLocaleString(locale);
    }
    
    /**
     * 解析数字字符串
     * @param {string} str 字符串
     * @returns {number} 数字
     */
    static parseNumber(str) {
        if (typeof str === 'number') {
            return str;
        }
        
        if (typeof str !== 'string') {
            return 0;
        }
        
        // 移除所有非数字字符（除了小数点）
        const cleaned = str.replace(/[^\d.]/g, '');
        
        // 处理万、k等单位
        if (str.includes('万')) {
            return parseFloat(cleaned) * 10000;
        } else if (str.toLowerCase().includes('k')) {
            return parseFloat(cleaned) * 1000;
        }
        
        return parseFloat(cleaned) || 0;
    }
    
    /**
     * 清理文本
     * @param {string} text 文本
     * @returns {string} 清理后的文本
     */
    static cleanText(text) {
        if (typeof text !== 'string') {
            return '';
        }
        
        return text
            .replace(/\s+/g, ' ') // 合并多个空白字符
            .replace(/[\r\n\t]/g, ' ') // 替换换行符和制表符
            .trim(); // 去除首尾空白
    }
    
    /**
     * 截断文本
     * @param {string} text 文本
     * @param {number} maxLength 最大长度
     * @param {string} suffix 后缀
     * @returns {string} 截断后的文本
     */
    static truncateText(text, maxLength, suffix = '...') {
        if (typeof text !== 'string') {
            return '';
        }
        
        if (text.length <= maxLength) {
            return text;
        }
        
        return text.substring(0, maxLength - suffix.length) + suffix;
    }
    
    /**
     * 标准化URL
     * @param {string} url URL
     * @param {string} baseUrl 基础URL
     * @returns {string} 标准化后的URL
     */
    static normalizeUrl(url, baseUrl = 'https://www.xiaohongshu.com') {
        if (!url) return '';
        
        // 如果已经是完整URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // 如果是相对路径，添加基础URL
        if (url.startsWith('/')) {
            return baseUrl + url;
        }
        
        // 如果是相对路径（不以/开头），添加基础URL和/
        return baseUrl + '/' + url;
    }
    
    /**
     * 提取URL参数
     * @param {string} url URL
     * @returns {Object} 参数对象
     */
    static extractUrlParams(url) {
        const params = {};
        
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.forEach((value, key) => {
                params[key] = value;
            });
        } catch (error) {
            console.warn('解析URL参数失败:', error);
        }
        
        return params;
    }
    
    /**
     * 深度克隆对象
     * @param {*} obj 对象
     * @returns {*} 克隆后的对象
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        
        return obj;
    }
    
    /**
     * 合并对象
     * @param {Object} target 目标对象
     * @param {...Object} sources 源对象
     * @returns {Object} 合并后的对象
     */
    static mergeObjects(target, ...sources) {
        if (!target || typeof target !== 'object') {
            target = {};
        }
        
        sources.forEach(source => {
            if (source && typeof source === 'object') {
                Object.keys(source).forEach(key => {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = this.mergeObjects(target[key] || {}, source[key]);
                    } else {
                        target[key] = source[key];
                    }
                });
            }
        });
        
        return target;
    }
    
    /**
     * 防抖函数
     * @param {Function} func 函数
     * @param {number} wait 等待时间
     * @param {boolean} immediate 是否立即执行
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, wait, immediate = false) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            
            const callNow = immediate && !timeout;
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func.apply(this, args);
        };
    }
    
    /**
     * 节流函数
     * @param {Function} func 函数
     * @param {number} limit 限制时间
     * @returns {Function} 节流后的函数
     */
    static throttle(func, limit) {
        let inThrottle;
        
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 重试函数
     * @param {Function} func 函数
     * @param {number} maxRetries 最大重试次数
     * @param {number} delay 延迟时间
     * @returns {Promise} Promise对象
     */
    static async retry(func, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await func();
            } catch (error) {
                lastError = error;
                
                if (i < maxRetries) {
                    await this.delay(delay * Math.pow(2, i)); // 指数退避
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * 验证数据
     * @param {*} data 数据
     * @param {Object} schema 验证模式
     * @returns {Object} 验证结果
     */
    static validateData(data, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = data[key];
            
            // 检查必填字段
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${key} 是必填字段`);
                continue;
            }
            
            // 如果值为空且不是必填，跳过其他验证
            if (value === undefined || value === null || value === '') {
                continue;
            }
            
            // 检查类型
            if (rules.type && typeof value !== rules.type) {
                errors.push(`${key} 类型错误，期望 ${rules.type}，实际 ${typeof value}`);
            }
            
            // 检查最小长度
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`${key} 长度不能少于 ${rules.minLength}`);
            }
            
            // 检查最大长度
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${key} 长度不能超过 ${rules.maxLength}`);
            }
            
            // 检查最小值
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${key} 不能小于 ${rules.min}`);
            }
            
            // 检查最大值
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${key} 不能大于 ${rules.max}`);
            }
            
            // 检查正则表达式
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push(`${key} 格式不正确`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 检查元素是否在视口中
     * @param {Element} element DOM元素
     * @param {number} threshold 阈值
     * @returns {boolean} 是否在视口中
     */
    static isElementInViewport(element, threshold = 0) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        return (
            rect.top >= -threshold &&
            rect.left >= -threshold &&
            rect.bottom <= windowHeight + threshold &&
            rect.right <= windowWidth + threshold
        );
    }
    
    /**
     * 等待元素出现
     * @param {string} selector 选择器
     * @param {number} timeout 超时时间
     * @param {Element} parent 父元素
     * @returns {Promise<Element>} 元素
     */
    static waitForElement(selector, timeout = 10000, parent = document) {
        return new Promise((resolve, reject) => {
            const element = parent.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                const element = parent.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(parent, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素超时: ${selector}`));
            }, timeout);
        });
    }
    
    /**
     * 获取元素文本内容
     * @param {Element} element DOM元素
     * @param {boolean} clean 是否清理文本
     * @returns {string} 文本内容
     */
    static getElementText(element, clean = true) {
        if (!element) return '';
        
        let text = element.textContent || element.innerText || '';
        
        if (clean) {
            text = this.cleanText(text);
        }
        
        return text;
    }
    
    /**
     * 获取元素属性
     * @param {Element} element DOM元素
     * @param {string} attribute 属性名
     * @param {string} defaultValue 默认值
     * @returns {string} 属性值
     */
    static getElementAttribute(element, attribute, defaultValue = '') {
        if (!element) return defaultValue;
        
        return element.getAttribute(attribute) || defaultValue;
    }
    
    /**
     * 安全执行函数
     * @param {Function} func 函数
     * @param {*} defaultValue 默认值
     * @param {...*} args 参数
     * @returns {*} 执行结果
     */
    static safeExecute(func, defaultValue = null, ...args) {
        try {
            return func(...args);
        } catch (error) {
            console.warn('函数执行失败:', error);
            return defaultValue;
        }
    }
    
    /**
     * 创建下载链接
     * @param {string} content 内容
     * @param {string} filename 文件名
     * @param {string} mimeType MIME类型
     */
    static downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL对象
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    /**
     * 复制文本到剪贴板
     * @param {string} text 文本
     * @returns {Promise<boolean>} 是否成功
     */
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                
                document.body.appendChild(textArea);
                textArea.select();
                
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                return success;
            }
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            return false;
        }
    }
    
    /**
     * 检查浏览器支持
     * @param {string} feature 特性名称
     * @returns {boolean} 是否支持
     */
    static checkBrowserSupport(feature) {
        const features = {
            'chrome.storage': typeof chrome !== 'undefined' && chrome.storage,
            'chrome.runtime': typeof chrome !== 'undefined' && chrome.runtime,
            'chrome.tabs': typeof chrome !== 'undefined' && chrome.tabs,
            'MutationObserver': typeof MutationObserver !== 'undefined',
            'IntersectionObserver': typeof IntersectionObserver !== 'undefined',
            'fetch': typeof fetch !== 'undefined',
            'Promise': typeof Promise !== 'undefined',
            'async/await': (function() {
                try {
                    return (function() {}).constructor('return (async function(){})().constructor === (async function(){}).constructor')();
                } catch (e) {
                    return false;
                }
            })()
        };
        
        return features[feature] || false;
    }
    
    /**
     * 获取运行环境信息
     * @returns {Object} 环境信息
     */
    static getEnvironmentInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            screenWidth: screen.width,
            screenHeight: screen.height,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            chromeExtension: typeof chrome !== 'undefined' && chrome.runtime,
            extensionId: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : null
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommonUtils;
} else if (typeof window !== 'undefined') {
    window.CommonUtils = CommonUtils;
}