class XHSDataCollector {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.collectedData = [];
        this.settings = {};
        this.scrollManager = null;
        this.dataParser = null;
        this.lastDataCount = 0;
        this.noNewDataCount = 0;
        this.scrollCount = 0;
        
        this.init();
    }
    
    async init() {
        // 等待页面完全加载
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                window.addEventListener('load', resolve);
            });
        }
        
        // 初始化模块
        this.scrollManager = new ScrollManager();
        this.dataParser = new DataParser();
        
        // 加载已保存的数据
        await this.loadSavedData();
        
        // 监听消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
        
        console.log('小红书数据采集器已初始化');
    }
    
    async loadSavedData() {
        try {
            const result = await chrome.storage.local.get(['collectedData']);
            this.collectedData = result.collectedData || [];
            console.log(`已加载 ${this.collectedData.length} 条历史数据`);
        } catch (error) {
            console.error('加载历史数据失败:', error);
        }
    }
    
    handleMessage(message, sender, sendResponse) {
        console.log('收到消息:', message);
        
        switch (message.action) {
            case 'getStatus':
                const status = this.getStatus();
                console.log('返回状态:', status);
                sendResponse(status);
                break;
            case 'startCollection':
                console.log('开始采集，设置:', message.settings);
                this.startCollection(message.settings)
                    .then(result => {
                        console.log('采集启动结果:', result);
                        sendResponse(result);
                    })
                    .catch(error => {
                        console.error('采集启动失败:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // 保持消息通道开放
            case 'pauseCollection':
                console.log('暂停采集');
                this.pauseCollection();
                sendResponse({ success: true });
                break;
            case 'resumeCollection':
                console.log('恢复采集');
                this.resumeCollection();
                sendResponse({ success: true });
                break;
            case 'stopCollection':
                console.log('停止采集');
                this.stopCollection();
                sendResponse({ success: true });
                break;
            default:
                console.log('未知消息类型:', message.action);
                sendResponse({ success: false, error: '未知操作' });
        }
    }
    
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            dataCount: this.collectedData.length,
            startTime: this.startTime
        };
    }
    
    async startCollection(settings) {
        if (this.isRunning) {
            return { success: false, error: '采集已在运行中' };
        }
        
        try {
            this.settings = settings;
            this.isRunning = true;
            this.isPaused = false;
            this.startTime = Date.now();
            this.scrollCount = 0;
            this.noNewDataCount = 0;
            
            // 发送状态更新
            this.sendStatusUpdate();
            
            // 开始采集
            await this.collectCurrentPageData();
            this.startScrolling();
            
            return { success: true };
        } catch (error) {
            console.error('启动采集失败:', error);
            this.isRunning = false;
            return { success: false, error: error.message };
        }
    }
    
    pauseCollection() {
        if (!this.isRunning) return;
        
        this.isPaused = true;
        this.scrollManager.pause();
        this.sendStatusUpdate();
    }
    
    resumeCollection() {
        if (!this.isRunning || !this.isPaused) return;
        
        this.isPaused = false;
        this.scrollManager.resume();
        this.sendStatusUpdate();
    }
    
    stopCollection() {
        this.isRunning = false;
        this.isPaused = false;
        this.scrollManager.stop();
        this.sendStatusUpdate();
        
        // 保存数据
        this.saveData();
    }
    
    async collectCurrentPageData() {
        try {
            const newData = await this.dataParser.parsePageData(this.settings);
            const uniqueNewData = this.filterUniqueData(newData);
            
            if (uniqueNewData.length > 0) {
                this.collectedData.push(...uniqueNewData);
                await this.saveData();
                
                // 发送数据更新
                this.sendDataUpdate();
                
                console.log(`新采集 ${uniqueNewData.length} 条数据，总计 ${this.collectedData.length} 条`);
            }
            
            return uniqueNewData.length;
        } catch (error) {
            console.error('采集页面数据失败:', error);
            return 0;
        }
    }
    
    filterUniqueData(newData) {
        const existingUrls = new Set(this.collectedData.map(item => item.url));
        return newData.filter(item => !existingUrls.has(item.url));
    }
    
    startScrolling() {
        if (!this.isRunning || this.isPaused) return;
        
        const scrollOptions = {
            speed: this.settings.scrollSpeed || 5,
            interval: (this.settings.scrollInterval || 3) * 1000,
            maxScrolls: this.settings.maxScrolls || 100,
            smartStop: this.settings.smartStop !== false
        };
        
        this.scrollManager.start(scrollOptions, async () => {
            // 滚动后的回调
            if (!this.isRunning || this.isPaused) return false;
            
            this.scrollCount++;
            
            // 等待内容加载
            await this.waitForContentLoad();
            
            // 采集新数据
            const newDataCount = await this.collectCurrentPageData();
            
            // 检查是否需要停止
            if (this.shouldStop(newDataCount)) {
                this.stopCollection();
                this.sendMessage('collectionComplete');
                return false;
            }
            
            return true; // 继续滚动
        });
    }
    
    async waitForContentLoad() {
        // 等待网络请求完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 等待新内容渲染
        let attempts = 0;
        while (attempts < 10) {
            const hasNewContent = await this.checkForNewContent();
            if (hasNewContent) break;
            
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
    }
    
    async checkForNewContent() {
        // 检查是否有新的笔记卡片加载
        const noteCards = document.querySelectorAll('[data-testid="note-item"], .note-item, .feeds-page .note-item');
        return noteCards.length > this.lastDataCount;
    }
    
    shouldStop(newDataCount) {
        // 检查最大滚动次数
        if (this.scrollCount >= (this.settings.maxScrolls || 100)) {
            console.log('达到最大滚动次数，停止采集');
            return true;
        }
        
        // 智能停止检查
        if (this.settings.smartStop) {
            if (newDataCount === 0) {
                this.noNewDataCount++;
                if (this.noNewDataCount >= 3) {
                    console.log('连续3次无新数据，智能停止采集');
                    return true;
                }
            } else {
                this.noNewDataCount = 0;
            }
        }
        
        return false;
    }
    
    async saveData() {
        try {
            await chrome.storage.local.set({ collectedData: this.collectedData });
        } catch (error) {
            console.error('保存数据失败:', error);
        }
    }
    
    sendStatusUpdate() {
        this.sendMessage('statusUpdate', this.getStatus());
    }
    
    sendDataUpdate() {
        this.sendMessage('dataUpdate', this.collectedData);
    }
    
    sendMessage(action, data = null) {
        try {
            chrome.runtime.sendMessage({ action, data });
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }
}

class ScrollManager {
    constructor() {
        this.isScrolling = false;
        this.isPaused = false;
        this.scrollTimer = null;
        this.options = {};
        this.callback = null;
    }
    
    start(options, callback) {
        this.options = options;
        this.callback = callback;
        this.isScrolling = true;
        this.isPaused = false;
        
        this.scheduleNextScroll();
    }
    
    pause() {
        this.isPaused = true;
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = null;
        }
    }
    
    resume() {
        if (this.isScrolling && this.isPaused) {
            this.isPaused = false;
            this.scheduleNextScroll();
        }
    }
    
    stop() {
        this.isScrolling = false;
        this.isPaused = false;
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = null;
        }
    }
    
    scheduleNextScroll() {
        if (!this.isScrolling || this.isPaused) return;
        
        const interval = this.options.interval || 3000;
        const randomDelay = Math.random() * 1000; // 随机延迟0-1秒
        
        this.scrollTimer = setTimeout(() => {
            this.performScroll();
        }, interval + randomDelay);
    }
    
    async performScroll() {
        if (!this.isScrolling || this.isPaused) return;
        
        try {
            // 计算滚动距离
            const baseDistance = window.innerHeight * 0.8;
            const randomFactor = 0.5 + Math.random() * 0.5; // 0.5-1.0
            const scrollDistance = baseDistance * randomFactor;
            
            // 平滑滚动
            await this.smoothScroll(scrollDistance);
            
            // 执行回调
            if (this.callback) {
                const shouldContinue = await this.callback();
                if (shouldContinue && this.isScrolling && !this.isPaused) {
                    this.scheduleNextScroll();
                }
            }
        } catch (error) {
            console.error('滚动失败:', error);
            if (this.isScrolling && !this.isPaused) {
                this.scheduleNextScroll();
            }
        }
    }
    
    smoothScroll(distance) {
        return new Promise(resolve => {
            const startY = window.pageYOffset;
            const targetY = startY + distance;
            const maxY = document.documentElement.scrollHeight - window.innerHeight;
            const finalY = Math.min(targetY, maxY);
            
            if (finalY <= startY) {
                resolve();
                return;
            }
            
            const duration = 1000 + Math.random() * 1000; // 1-2秒
            const startTime = performance.now();
            
            const animateScroll = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // 使用缓动函数
                const easeProgress = this.easeInOutCubic(progress);
                const currentY = startY + (finalY - startY) * easeProgress;
                
                window.scrollTo(0, currentY);
                
                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animateScroll);
        });
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}

class DataParser {
    constructor() {
        this.selectors = {
            noteItems: [
                'section.note-item',
                'section[class*="note-item"]',
                '[data-testid="note-item"]',
                '.note-item',
                '.feeds-page .note-item',
                '.search-page .note-item',
                'section[class*="note"]'
            ],
            title: [
                '.footer .title span',
                '.footer .title',
                '.title span',
                '.title',
                '.note-title',
                '[class*="title"]',
                'a[href*="/explore/"] span',
                '.content .title'
            ],
            author: [
                '.author-wrapper .author .name',
                '.author .name',
                '.author-wrapper .name',
                '.author',
                '.user-name',
                '[class*="author"]',
                '[class*="user"]',
                '.avatar-wrapper + span'
            ],
            stats: [
                '.like-wrapper .count',
                '.like-wrapper',
                '.stats',
                '.interaction',
                '[class*="stats"]',
                '[class*="count"]'
            ],
            image: [
                '.cover img',
                'a.cover img',
                'img',
                '.image img'
            ],
            link: [
                'a.cover[href*="/explore/"]',
                'a[href*="/explore/"]',
                'a[href*="/discovery/"]'
            ]
        };
    }
    
    async parsePageData(settings) {
        const noteItems = this.findNoteItems();
        const data = [];
        
        for (const item of noteItems) {
            try {
                const noteData = this.parseNoteItem(item, settings);
                if (noteData && this.validateNoteData(noteData)) {
                    data.push(noteData);
                }
            } catch (error) {
                console.error('解析笔记项失败:', error);
            }
        }
        
        return data;
    }
    
    findNoteItems() {
        for (const selector of this.selectors.noteItems) {
            const items = document.querySelectorAll(selector);
            if (items.length > 0) {
                console.log(`使用选择器 ${selector} 找到 ${items.length} 个笔记项`);
                return Array.from(items);
            }
        }
        
        // 如果没有找到，尝试通用选择器
        console.log('使用智能检测模式查找笔记项');
        const fallbackItems = document.querySelectorAll('section, article, .item, [class*="card"]');
        return Array.from(fallbackItems).filter(item => {
            // 检查是否为section.note-item
            if (item.tagName === 'SECTION' && item.classList.contains('note-item')) {
                return true;
            }
            
            const hasLink = item.querySelector('a[href*="/explore/"], a.cover');
            const hasImage = item.querySelector('img');
            const hasTitle = item.querySelector('.title, .footer .title');
            const hasAuthor = item.querySelector('.author, .name');
            
            // 检查是否有data-v-*属性（Vue组件特征）
            const hasVueData = Array.from(item.attributes).some(attr => 
                attr.name.startsWith('data-v-')
            );
            
            return hasLink && hasImage && (hasTitle || hasAuthor) && hasVueData;
        });
    }
    
    parseNoteItem(item, settings) {
        const noteData = {
            timestamp: Date.now(),
            url: null,
            title: null,
            author: null,
            likes: null,
            collects: null,
            comments: null,
            imageUrl: null
        };
        
        // 解析链接
        const linkEl = this.findElement(item, this.selectors.link);
        if (linkEl) {
            noteData.url = this.normalizeUrl(linkEl.href);
        }
        
        // 解析标题
        if (settings.collectTitle) {
            const titleEl = this.findElement(item, this.selectors.title);
            if (titleEl) {
                noteData.title = this.cleanText(titleEl.textContent);
            }
        }
        
        // 解析作者
        if (settings.collectAuthor) {
            const authorEl = this.findElement(item, this.selectors.author);
            if (authorEl) {
                noteData.author = this.cleanText(authorEl.textContent);
            }
        }
        
        // 解析统计数据
        if (settings.collectStats) {
            this.parseStats(item, noteData);
        }
        
        // 解析图片
        if (settings.collectImages) {
            const imageEl = this.findElement(item, this.selectors.image);
            if (imageEl) {
                noteData.imageUrl = imageEl.src || imageEl.dataset.src;
            }
        }
        
        return noteData;
    }
    
    findElement(parent, selectors) {
        for (const selector of selectors) {
            const element = parent.querySelector(selector);
            if (element) return element;
        }
        return null;
    }
    
    parseStats(item, noteData) {
        // 优先查找特定的点赞元素
        const likeElement = item.querySelector('.like-wrapper .count');
        if (likeElement && likeElement.textContent.trim()) {
            const likeCount = this.extractNumber(likeElement.textContent);
            if (likeCount !== null) {
                noteData.likes = likeCount;
            }
        }
        
        // 如果没有找到特定元素，使用通用方法
        if (noteData.likes === null) {
            const textElements = item.querySelectorAll('span, div');
            
            for (const el of textElements) {
                const text = el.textContent.trim();
                const number = this.extractNumber(text);
                
                if (number !== null) {
                    const className = el.className || '';
                    const parentClassName = el.parentElement?.className || '';
                    
                    if ((text.includes('点赞') || text.includes('赞') || className.includes('like') || parentClassName.includes('like')) && noteData.likes === null) {
                        noteData.likes = number;
                    } else if ((text.includes('收藏') || className.includes('collect') || parentClassName.includes('collect')) && noteData.collects === null) {
                        noteData.collects = number;
                    } else if ((text.includes('评论') || className.includes('comment') || parentClassName.includes('comment')) && noteData.comments === null) {
                        noteData.comments = number;
                    }
                }
            }
        }
    }
    
    extractNumber(text) {
        const match = text.match(/([0-9]+(?:\.[0-9]+)?[万千]?)/);;
        if (!match) return null;
        
        let num = parseFloat(match[1]);
        if (text.includes('万')) {
            num *= 10000;
        } else if (text.includes('千')) {
            num *= 1000;
        }
        
        return Math.floor(num);
    }
    
    cleanText(text) {
        return text ? text.trim().replace(/\s+/g, ' ') : '';
    }
    
    normalizeUrl(url) {
        if (!url) return null;
        
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.href;
        } catch (error) {
            return url;
        }
    }
    
    validateNoteData(data) {
        return data.url && (data.title || data.author || data.imageUrl);
    }
}

// 初始化数据采集器
if (window.location.hostname.includes('xiaohongshu.com')) {
    const collector = new XHSDataCollector();
    window.xhsCollector = collector; // 用于调试
}