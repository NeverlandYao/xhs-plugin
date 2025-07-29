/**
 * 数据解析工具类
 * 负责从小红书页面DOM中提取和解析数据
 */
class DataParserUtils {
    constructor() {
        // 小红书页面元素选择器配置
        this.selectors = {
            // 笔记容器选择器（按优先级排序）
            noteContainers: [
                'section.note-item',
                'section[class*="note-item"]',
                '[data-testid="note-item"]',
                '.note-item',
                '.feeds-page .note-item',
                '.search-page .note-item',
                '.explore-feed .note-item',
                'section[class*="note"]',
                'article[class*="note"]',
                '.card[class*="note"]'
            ],
            
            // 标题选择器
            titles: [
                '.footer .title span',
                '.footer .title',
                '.title span',
                '.title',
                '.note-title',
                '[class*="title"]',
                'a[href*="/explore/"] span',
                '.content .title',
                'h3',
                'h4',
                '.text-content'
            ],
            
            // 作者选择器
            authors: [
                '.author .name span',
                '.author-wrapper .author .name',
                '.author .name',
                '.author-wrapper .name',
                '.author',
                '.user-name',
                '[class*="author"]',
                '[class*="user"]',
                '.avatar-wrapper + span',
                '.user-info .name',
                '.creator-name'
            ],
            
            // 统计数据选择器
            stats: [
                '.like-wrapper .count',
                '.like-wrapper',
                '.stats',
                '.interaction',
                '[class*="stats"]',
                '[class*="count"]',
                '.engagement',
                '.metrics'
            ],
            
            // 图片选择器
            images: [
                '.cover img',
                'a.cover img',
                'img',
                '.image img',
                '.thumbnail img',
                '.media img'
            ],
            
            // 链接选择器（优先匹配带参数的完整链接）
            links: [
                'a.cover[href*="/search_result/"]',
                'a[href*="/search_result/"]',
                'a.cover[href*="/explore/"]',
                'a[href*="/explore/"]',
                'a[href*="/discovery/"]',
                'a[href*="/note/"]',
                '.note-link'
            ],
            
            // 时间选择器
            times: [
                '.time span',
                '.time',
                '.publish-time',
                '.date',
                '[class*="time"]',
                '[class*="date"]'
            ]
        };
        
        // 数据提取正则表达式
        this.patterns = {
            numbers: /([0-9]+(?:\.[0-9]+)?[万千]?)/g,
            likes: /(点赞|赞|like)/i,
            collects: /(收藏|collect)/i,
            comments: /(评论|comment)/i,
            url: /\/explore\/([a-zA-Z0-9]+)/,
            cleanText: /\s+/g
        };
    }
    
    /**
     * 查找页面中的所有笔记项
     * @returns {Element[]} 笔记元素数组
     */
    findNoteItems() {
        // 尝试使用预定义的选择器
        for (const selector of this.selectors.noteContainers) {
            const items = document.querySelectorAll(selector);
            if (items.length > 0) {
                console.log(`使用选择器 ${selector} 找到 ${items.length} 个笔记项`);
                return Array.from(items);
            }
        }
        
        // 如果预定义选择器都没找到，使用智能检测
        return this.intelligentNoteDetection();
    }
    
    /**
     * 智能检测笔记项
     * 通过分析页面结构自动识别笔记容器
     * @returns {Element[]} 检测到的笔记元素数组
     */
    intelligentNoteDetection() {
        console.log('使用智能检测模式查找笔记项');
        
        // 查找可能的容器元素
        const candidates = document.querySelectorAll(
            'section, article, div[class*="item"], div[class*="card"], div[class*="note"]'
        );
        
        const noteItems = [];
        
        for (const candidate of candidates) {
            if (this.isLikelyNoteItem(candidate)) {
                noteItems.push(candidate);
            }
        }
        
        console.log(`智能检测找到 ${noteItems.length} 个可能的笔记项`);
        return noteItems;
    }
    
    /**
     * 判断元素是否可能是笔记项
     * @param {Element} element 要检测的元素
     * @returns {boolean} 是否为笔记项
     */
    isLikelyNoteItem(element) {
        // 检查是否为section.note-item
        if (element.tagName === 'SECTION' && element.classList.contains('note-item')) {
            return true;
        }
        
        // 检查是否包含链接
        const hasLink = element.querySelector('a[href*="/explore/"], a[href*="/note/"], a.cover');
        if (!hasLink) return false;
        
        // 检查是否包含图片
        const hasImage = element.querySelector('img');
        if (!hasImage) return false;
        
        // 检查是否有文本内容（标题或作者）
        const hasTitle = element.querySelector('.title, .footer .title');
        const hasAuthor = element.querySelector('.author, .name');
        if (!hasTitle && !hasAuthor) return false;
        
        // 检查元素大小（避免选中过小的元素）
        const rect = element.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 100) return false;
        
        // 检查是否有data-v-*属性（Vue组件特征）
        const hasVueData = Array.from(element.attributes).some(attr => 
            attr.name.startsWith('data-v-')
        );
        
        return hasVueData;
    }
    
    /**
     * 解析单个笔记项的数据
     * @param {Element} noteElement 笔记元素
     * @param {Object} settings 采集设置
     * @returns {Object|null} 解析后的笔记数据
     */
    parseNoteData(noteElement, settings = {}) {
        try {
            const noteData = {
                timestamp: Date.now(),
                url: null,
                title: null,
                author: null,
                likes: null,
                collects: null,
                comments: null,
                imageUrl: null,
                publishTime: null,
                rawElement: null // 用于调试
            };
            
            // 解析URL
            noteData.url = this.extractUrl(noteElement);
            if (!noteData.url) {
                console.warn('未找到笔记链接，跳过此项');
                return null;
            }
            
            // 根据设置解析不同字段
            if (settings.collectTitle !== false) {
                noteData.title = this.extractTitle(noteElement);
            }
            
            if (settings.collectAuthor !== false) {
                noteData.author = this.extractAuthor(noteElement);
            }
            
            if (settings.collectStats !== false) {
                const stats = this.extractStats(noteElement);
                noteData.likes = stats.likes;
                noteData.collects = stats.collects;
                noteData.comments = stats.comments;
            }
            
            if (settings.collectImages !== false) {
                noteData.imageUrl = this.extractImageUrl(noteElement);
            }
            
            if (settings.collectTime !== false) {
                noteData.publishTime = this.extractTime(noteElement);
            }
            
            // 在开发模式下保存原始元素引用
            if (settings.debug) {
                noteData.rawElement = noteElement;
            }
            
            return noteData;
        } catch (error) {
            console.error('解析笔记数据失败:', error, noteElement);
            return null;
        }
    }
    
    /**
     * 提取笔记URL
     * @param {Element} element 笔记元素
     * @returns {string|null} 笔记URL
     */
    extractUrl(element) {
        for (const selector of this.selectors.links) {
            const linkElement = element.querySelector(selector);
            if (linkElement && linkElement.href) {
                return this.normalizeUrl(linkElement.href);
            }
        }
        return null;
    }
    
    /**
     * 提取笔记标题
     * @param {Element} element 笔记元素
     * @returns {string|null} 笔记标题
     */
    extractTitle(element) {
        for (const selector of this.selectors.titles) {
            const titleElement = element.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) {
                return this.cleanText(titleElement.textContent);
            }
        }
        
        // 如果没找到专门的标题元素，尝试从链接文本中提取
        const linkElement = element.querySelector('a[href*="/explore/"]');
        if (linkElement && linkElement.textContent.trim()) {
            return this.cleanText(linkElement.textContent);
        }
        
        return null;
    }
    
    /**
     * 提取作者信息
     * @param {Element} element 笔记元素
     * @returns {string|null} 作者名称
     */
    extractAuthor(element) {
        for (const selector of this.selectors.authors) {
            const authorElement = element.querySelector(selector);
            if (authorElement && authorElement.textContent.trim()) {
                return this.cleanText(authorElement.textContent);
            }
        }
        return null;
    }
    
    /**
     * 提取统计数据（点赞、收藏、评论）
     * @param {Element} element 笔记元素
     * @returns {Object} 统计数据对象
     */
    extractStats(element) {
        const stats = {
            likes: null,
            collects: null,
            comments: null
        };
        
        // 优先查找特定的点赞元素
        const likeElement = element.querySelector('.like-wrapper .count');
        if (likeElement && likeElement.textContent.trim()) {
            const likeCount = this.extractNumber(likeElement.textContent);
            if (likeCount !== null) {
                stats.likes = likeCount;
            }
        }
        
        // 如果没有找到特定元素，使用通用方法
        if (stats.likes === null) {
            // 查找所有可能包含数字的元素
            const textElements = element.querySelectorAll('span, div, p');
            
            for (const textElement of textElements) {
                const text = textElement.textContent.trim();
                if (!text) continue;
                
                const number = this.extractNumber(text);
                if (number === null) continue;
                
                // 根据文本内容和元素类名判断数据类型
                const className = textElement.className || '';
                const parentClassName = textElement.parentElement?.className || '';
                
                if ((this.patterns.likes.test(text) || className.includes('like') || parentClassName.includes('like')) && stats.likes === null) {
                    stats.likes = number;
                } else if ((this.patterns.collects.test(text) || className.includes('collect') || parentClassName.includes('collect')) && stats.collects === null) {
                    stats.collects = number;
                } else if ((this.patterns.comments.test(text) || className.includes('comment') || parentClassName.includes('comment')) && stats.comments === null) {
                    stats.comments = number;
                }
            }
        }
        
        return stats;
    }
    
    /**
     * 提取图片URL
     * @param {Element} element 笔记元素
     * @returns {string|null} 图片URL
     */
    extractImageUrl(element) {
        for (const selector of this.selectors.images) {
            const imageElement = element.querySelector(selector);
            if (imageElement) {
                // 优先使用src，然后尝试data-src等懒加载属性
                const url = imageElement.src || 
                           imageElement.dataset.src || 
                           imageElement.dataset.original ||
                           imageElement.getAttribute('data-lazy-src');
                           
                if (url && url !== 'data:' && !url.startsWith('data:image/svg')) {
                    return this.normalizeUrl(url);
                }
            }
        }
        return null;
    }
    
    /**
     * 提取发布时间
     * @param {Element} element 笔记元素
     * @returns {string|null} 发布时间
     */
    extractTime(element) {
        for (const selector of this.selectors.times) {
            const timeElement = element.querySelector(selector);
            if (timeElement && timeElement.textContent.trim()) {
                const timeText = this.cleanText(timeElement.textContent);
                // 验证时间格式
                if (this.isValidTimeFormat(timeText)) {
                    return timeText;
                }
            }
        }
        return null;
    }
    
    /**
     * 验证时间格式
     * @param {string} timeText 时间文本
     * @returns {boolean} 是否为有效时间格式
     */
    isValidTimeFormat(timeText) {
        // 常见的时间格式模式
        const timePatterns = [
            /^\d{4}-\d{1,2}-\d{1,2}$/, // 2024-12-14
            /^\d{1,2}-\d{1,2}$/, // 12-14
            /^\d{1,2}月\d{1,2}日$/, // 12月14日
            /^\d+[分时天]前$/, // 3分前, 2小时前, 1天前
            /^昨天|今天|前天$/, // 昨天, 今天, 前天
            /^\d{4}\/\d{1,2}\/\d{1,2}$/ // 2024/12/14
        ];
        
        return timePatterns.some(pattern => pattern.test(timeText));
    }
    
    /**
     * 从文本中提取数字
     * @param {string} text 包含数字的文本
     * @returns {number|null} 提取的数字
     */
    extractNumber(text) {
        const matches = text.match(this.patterns.numbers);
        if (!matches || matches.length === 0) return null;
        
        // 取第一个匹配的数字
        const numberStr = matches[0];
        let number = parseFloat(numberStr);
        
        // 处理中文数量单位
        if (numberStr.includes('万')) {
            number *= 10000;
        } else if (numberStr.includes('千')) {
            number *= 1000;
        }
        
        return Math.floor(number);
    }
    
    /**
     * 清理文本内容
     * @param {string} text 原始文本
     * @returns {string} 清理后的文本
     */
    cleanText(text) {
        if (!text) return '';
        
        return text
            .trim()
            .replace(this.patterns.cleanText, ' ')
            .replace(/[\r\n\t]/g, ' ')
            .substring(0, 200); // 限制长度
    }
    
    /**
     * 标准化URL
     * @param {string} url 原始URL
     * @returns {string} 标准化后的URL
     */
    normalizeUrl(url) {
        if (!url) return null;
        
        try {
            // 如果已经是完整URL，直接返回
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            
            // 如果是相对URL，转换为小红书的绝对URL
            const baseUrl = 'https://www.xiaohongshu.com';
            const absoluteUrl = new URL(url, baseUrl);
            return absoluteUrl.href;
        } catch (error) {
            console.warn('URL标准化失败:', url, error);
            return url;
        }
    }
    
    /**
     * 验证笔记数据的完整性
     * @param {Object} noteData 笔记数据
     * @returns {boolean} 数据是否有效
     */
    validateNoteData(noteData) {
        if (!noteData) return false;
        
        // URL是必需的
        if (!noteData.url) return false;
        
        // 至少要有标题、作者或图片中的一个
        const hasContent = noteData.title || noteData.author || noteData.imageUrl;
        if (!hasContent) return false;
        
        // 检查URL格式
        if (!noteData.url.includes('xiaohongshu.com')) return false;
        
        return true;
    }
    
    /**
     * 批量解析页面数据
     * @param {Object} settings 采集设置
     * @returns {Object[]} 解析后的数据数组
     */
    parsePageData(settings = {}) {
        const noteItems = this.findNoteItems();
        const results = [];
        
        console.log(`开始解析 ${noteItems.length} 个笔记项`);
        
        for (let i = 0; i < noteItems.length; i++) {
            const noteElement = noteItems[i];
            const noteData = this.parseNoteData(noteElement, settings);
            
            if (noteData && this.validateNoteData(noteData)) {
                results.push(noteData);
            } else if (settings.debug) {
                console.warn(`第 ${i + 1} 个笔记项解析失败或数据无效`, noteElement);
            }
        }
        
        console.log(`成功解析 ${results.length} 条有效数据`);
        return results;
    }
    
    /**
     * 获取页面统计信息
     * @returns {Object} 页面统计信息
     */
    getPageStats() {
        const noteItems = this.findNoteItems();
        
        return {
            totalItems: noteItems.length,
            pageUrl: window.location.href,
            pageTitle: document.title,
            timestamp: Date.now(),
            scrollPosition: window.pageYOffset,
            viewportHeight: window.innerHeight,
            documentHeight: document.documentElement.scrollHeight
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataParserUtils;
} else if (typeof window !== 'undefined') {
    window.DataParserUtils = DataParserUtils;
}