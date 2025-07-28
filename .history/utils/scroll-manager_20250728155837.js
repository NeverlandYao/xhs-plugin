/**
 * 滚动管理工具类
 * 实现智能的页面滚动控制，模拟真实用户行为
 */
class ScrollManagerUtils {
    constructor(options = {}) {
        // 滚动状态
        this.isActive = false;
        this.isPaused = false;
        this.isDestroyed = false;
        
        // 滚动配置
        this.config = {
            speed: options.speed || 5, // 滚动速度 1-10
            interval: options.interval || 3000, // 滚动间隔(毫秒)
            maxScrolls: options.maxScrolls || 100, // 最大滚动次数
            smartStop: options.smartStop !== false, // 智能停止
            randomDelay: options.randomDelay !== false, // 随机延迟
            smoothScroll: options.smoothScroll !== false, // 平滑滚动
            detectNewContent: options.detectNewContent !== false, // 检测新内容
            minScrollDistance: options.minScrollDistance || 200, // 最小滚动距离
            maxScrollDistance: options.maxScrollDistance || 800 // 最大滚动距离
        };
        
        // 滚动统计
        this.stats = {
            scrollCount: 0,
            totalDistance: 0,
            startTime: null,
            lastScrollTime: null,
            noNewContentCount: 0
        };
        
        // 回调函数
        this.callbacks = {
            onScroll: null,
            onComplete: null,
            onError: null,
            onPause: null,
            onResume: null
        };
        
        // 内部状态
        this.scrollTimer = null;
        this.lastContentHeight = 0;
        this.lastScrollPosition = 0;
        this.contentObserver = null;
        
        this.init();
    }
    
    /**
     * 初始化滚动管理器
     */
    init() {
        this.lastContentHeight = this.getContentHeight();
        this.lastScrollPosition = window.pageYOffset;
        
        // 设置内容变化观察器
        if (this.config.detectNewContent) {
            this.setupContentObserver();
        }
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isActive) {
                this.pause();
            }
        });
        
        console.log('滚动管理器初始化完成');
    }
    
    /**
     * 开始滚动
     * @param {Object} options 滚动选项
     * @param {Function} callback 滚动回调函数
     */
    start(options = {}, callback = null) {
        if (this.isActive) {
            console.warn('滚动已在进行中');
            return false;
        }
        
        // 更新配置
        this.updateConfig(options);
        
        // 设置回调
        if (callback) {
            this.callbacks.onScroll = callback;
        }
        
        // 重置统计
        this.resetStats();
        
        // 开始滚动
        this.isActive = true;
        this.isPaused = false;
        this.stats.startTime = Date.now();
        
        console.log('开始自动滚动', this.config);
        
        // 立即执行第一次滚动
        this.scheduleNextScroll(0);
        
        return true;
    }
    
    /**
     * 暂停滚动
     */
    pause() {
        if (!this.isActive || this.isPaused) {
            return false;
        }
        
        this.isPaused = true;
        this.clearScrollTimer();
        
        console.log('滚动已暂停');
        
        if (this.callbacks.onPause) {
            this.callbacks.onPause();
        }
        
        return true;
    }
    
    /**
     * 恢复滚动
     */
    resume() {
        if (!this.isActive || !this.isPaused) {
            return false;
        }
        
        this.isPaused = false;
        
        console.log('滚动已恢复');
        
        // 恢复滚动
        this.scheduleNextScroll();
        
        if (this.callbacks.onResume) {
            this.callbacks.onResume();
        }
        
        return true;
    }
    
    /**
     * 停止滚动
     */
    stop() {
        if (!this.isActive) {
            return false;
        }
        
        this.isActive = false;
        this.isPaused = false;
        this.clearScrollTimer();
        
        console.log('滚动已停止', this.getStats());
        
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete(this.getStats());
        }
        
        return true;
    }
    
    /**
     * 销毁滚动管理器
     */
    destroy() {
        this.stop();
        this.isDestroyed = true;
        
        // 清理观察器
        if (this.contentObserver) {
            this.contentObserver.disconnect();
            this.contentObserver = null;
        }
        
        // 清理回调
        this.callbacks = {};
        
        console.log('滚动管理器已销毁');
    }
    
    /**
     * 安排下一次滚动
     * @param {number} customDelay 自定义延迟时间
     */
    scheduleNextScroll(customDelay = null) {
        if (!this.isActive || this.isPaused || this.isDestroyed) {
            return;
        }
        
        let delay = customDelay !== null ? customDelay : this.config.interval;
        
        // 添加随机延迟
        if (this.config.randomDelay && customDelay === null) {
            const randomFactor = 0.5 + Math.random(); // 0.5-1.5倍
            delay = Math.floor(delay * randomFactor);
        }
        
        this.scrollTimer = setTimeout(() => {
            this.performScroll();
        }, delay);
    }
    
    /**
     * 执行滚动操作
     */
    async performScroll() {
        if (!this.isActive || this.isPaused || this.isDestroyed) {
            return;
        }
        
        try {
            // 检查是否应该停止
            if (this.shouldStop()) {
                this.stop();
                return;
            }
            
            // 计算滚动距离
            const scrollDistance = this.calculateScrollDistance();
            
            // 执行滚动
            await this.scrollPage(scrollDistance);
            
            // 更新统计
            this.updateStats(scrollDistance);
            
            // 等待内容加载
            await this.waitForContentLoad();
            
            // 执行回调
            let shouldContinue = true;
            if (this.callbacks.onScroll) {
                shouldContinue = await this.callbacks.onScroll(this.getStats());
            }
            
            // 继续滚动
            if (shouldContinue && this.isActive && !this.isPaused) {
                this.scheduleNextScroll();
            } else {
                this.stop();
            }
            
        } catch (error) {
            console.error('滚动执行失败:', error);
            
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            
            // 尝试继续滚动
            if (this.isActive && !this.isPaused) {
                this.scheduleNextScroll(5000); // 5秒后重试
            }
        }
    }
    
    /**
     * 滚动页面
     * @param {number} distance 滚动距离
     */
    async scrollPage(distance) {
        const startY = window.pageYOffset;
        const targetY = Math.min(
            startY + distance,
            this.getMaxScrollPosition()
        );
        
        if (targetY <= startY) {
            throw new Error('已到达页面底部');
        }
        
        if (this.config.smoothScroll) {
            await this.smoothScrollTo(targetY);
        } else {
            window.scrollTo(0, targetY);
        }
        
        console.log(`滚动: ${startY} -> ${targetY} (距离: ${targetY - startY}px)`);
    }
    
    /**
     * 平滑滚动到指定位置
     * @param {number} targetY 目标Y坐标
     */
    smoothScrollTo(targetY) {
        return new Promise((resolve) => {
            const startY = window.pageYOffset;
            const distance = targetY - startY;
            const duration = this.calculateScrollDuration(Math.abs(distance));
            const startTime = performance.now();
            
            const animateScroll = (currentTime) => {
                if (this.isPaused || !this.isActive) {
                    resolve();
                    return;
                }
                
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // 使用缓动函数
                const easeProgress = this.easeInOutCubic(progress);
                const currentY = startY + distance * easeProgress;
                
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
    
    /**
     * 计算滚动距离
     * @returns {number} 滚动距离
     */
    calculateScrollDistance() {
        const baseDistance = window.innerHeight * 0.6; // 基础距离为视口高度的60%
        const speedFactor = this.config.speed / 5; // 速度因子
        const randomFactor = 0.7 + Math.random() * 0.6; // 0.7-1.3倍随机因子
        
        let distance = baseDistance * speedFactor * randomFactor;
        
        // 限制在配置范围内
        distance = Math.max(distance, this.config.minScrollDistance);
        distance = Math.min(distance, this.config.maxScrollDistance);
        
        return Math.floor(distance);
    }
    
    /**
     * 计算滚动动画持续时间
     * @param {number} distance 滚动距离
     * @returns {number} 持续时间(毫秒)
     */
    calculateScrollDuration(distance) {
        // 基础持续时间：800-2000毫秒
        const baseDuration = 800;
        const maxDuration = 2000;
        
        // 根据距离调整持续时间
        const distanceFactor = Math.min(distance / 1000, 1);
        const duration = baseDuration + (maxDuration - baseDuration) * distanceFactor;
        
        // 添加随机变化
        const randomFactor = 0.8 + Math.random() * 0.4; // 0.8-1.2倍
        
        return Math.floor(duration * randomFactor);
    }
    
    /**
     * 缓动函数
     * @param {number} t 进度值 (0-1)
     * @returns {number} 缓动后的值
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    /**
     * 等待内容加载
     */
    async waitForContentLoad() {
        // 基础等待时间
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 等待新内容出现
        if (this.config.detectNewContent) {
            await this.waitForNewContent();
        }
    }
    
    /**
     * 等待新内容出现
     */
    async waitForNewContent() {
        const maxWaitTime = 5000; // 最大等待5秒
        const checkInterval = 500; // 每500ms检查一次
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (this.hasNewContent()) {
                console.log('检测到新内容');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            
            if (!this.isActive || this.isPaused) {
                return;
            }
        }
        
        console.log('等待新内容超时');
    }
    
    /**
     * 检查是否有新内容
     * @returns {boolean} 是否有新内容
     */
    hasNewContent() {
        const currentHeight = this.getContentHeight();
        const hasNewContent = currentHeight > this.lastContentHeight;
        
        if (hasNewContent) {
            this.lastContentHeight = currentHeight;
            this.stats.noNewContentCount = 0;
        }
        
        return hasNewContent;
    }
    
    /**
     * 判断是否应该停止滚动
     * @returns {boolean} 是否应该停止
     */
    shouldStop() {
        // 检查最大滚动次数
        if (this.stats.scrollCount >= this.config.maxScrolls) {
            console.log('达到最大滚动次数，停止滚动');
            return true;
        }
        
        // 检查是否到达页面底部
        if (this.isAtBottom()) {
            console.log('已到达页面底部，停止滚动');
            return true;
        }
        
        // 智能停止检查
        if (this.config.smartStop) {
            if (!this.hasNewContent()) {
                this.stats.noNewContentCount++;
                if (this.stats.noNewContentCount >= 3) {
                    console.log('连续3次无新内容，智能停止滚动');
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * 检查是否到达页面底部
     * @returns {boolean} 是否到达底部
     */
    isAtBottom() {
        const scrollTop = window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = this.getContentHeight();
        
        return scrollTop + windowHeight >= documentHeight - 100; // 留100px缓冲
    }
    
    /**
     * 获取页面内容高度
     * @returns {number} 内容高度
     */
    getContentHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );
    }
    
    /**
     * 获取最大滚动位置
     * @returns {number} 最大滚动位置
     */
    getMaxScrollPosition() {
        return this.getContentHeight() - window.innerHeight;
    }
    
    /**
     * 设置内容变化观察器
     */
    setupContentObserver() {
        if (!window.MutationObserver) {
            console.warn('浏览器不支持MutationObserver');
            return;
        }
        
        this.contentObserver = new MutationObserver((mutations) => {
            let hasNewNodes = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    hasNewNodes = true;
                }
            });
            
            if (hasNewNodes) {
                this.lastContentHeight = this.getContentHeight();
            }
        });
        
        // 观察整个文档的变化
        this.contentObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * 更新配置
     * @param {Object} newConfig 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            scrollCount: 0,
            totalDistance: 0,
            startTime: null,
            lastScrollTime: null,
            noNewContentCount: 0
        };
    }
    
    /**
     * 更新统计信息
     * @param {number} distance 滚动距离
     */
    updateStats(distance) {
        this.stats.scrollCount++;
        this.stats.totalDistance += distance;
        this.stats.lastScrollTime = Date.now();
    }
    
    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        
        return {
            ...this.stats,
            runtime,
            isActive: this.isActive,
            isPaused: this.isPaused,
            currentPosition: window.pageYOffset,
            contentHeight: this.getContentHeight(),
            progress: this.getScrollProgress()
        };
    }
    
    /**
     * 获取滚动进度
     * @returns {number} 滚动进度 (0-1)
     */
    getScrollProgress() {
        const maxScroll = this.getMaxScrollPosition();
        if (maxScroll <= 0) return 1;
        
        return Math.min(window.pageYOffset / maxScroll, 1);
    }
    
    /**
     * 清理滚动定时器
     */
    clearScrollTimer() {
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = null;
        }
    }
    
    /**
     * 设置回调函数
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase() + event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = callback;
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollManagerUtils;
} else if (typeof window !== 'undefined') {
    window.ScrollManagerUtils = ScrollManagerUtils;
}