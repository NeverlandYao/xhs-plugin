class BackgroundService {
    constructor() {
        this.init();
    }
    
    init() {
        // 监听插件安装
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });
        
        // 监听消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持消息通道开放
        });
        
        // 监听标签页更新
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });
        
        console.log('小红书数据爬虫插件后台服务已启动');
    }
    
    handleInstall(details) {
        if (details.reason === 'install') {
            console.log('插件首次安装');
            this.initializeStorage();
        } else if (details.reason === 'update') {
            console.log('插件已更新');
            this.handleUpdate();
        }
    }
    
    async initializeStorage() {
        try {
            // 初始化默认设置
            const defaultSettings = {
                scrollSpeed: 5,
                scrollInterval: 3,
                maxScrolls: 100,
                smartStop: true,
                collectTitle: true,
                collectAuthor: true,
                collectStats: true,
                collectImages: true
            };
            
            await chrome.storage.sync.set({ settings: defaultSettings });
            await chrome.storage.local.set({ collectedData: [] });
            
            console.log('存储初始化完成');
        } catch (error) {
            console.error('存储初始化失败:', error);
        }
    }
    
    async handleUpdate() {
        try {
            // 检查并更新设置格式
            const result = await chrome.storage.sync.get(['settings']);
            if (!result.settings) {
                await this.initializeStorage();
            }
        } catch (error) {
            console.error('更新处理失败:', error);
        }
    }
    
    handleTabUpdate(tabId, changeInfo, tab) {
        // 当标签页完成加载且是小红书页面时，可以进行一些初始化操作
        if (changeInfo.status === 'complete' && tab.url && tab.url.includes('xiaohongshu.com')) {
            console.log('小红书页面加载完成:', tab.url);
        }
    }
    
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'ping':
                    // 用于测试扩展连接状态
                    sendResponse({ success: true, message: 'pong' });
                    return false; // 同步响应
                case 'exportData':
                    this.handleExportData(message, sendResponse);
                    return true; // 保持异步消息通道开放
                case 'clearData':
                    await this.handleClearData(sendResponse);
                    break;
                case 'getStorageInfo':
                    await this.handleGetStorageInfo(sendResponse);
                    break;
                default:
                    sendResponse({ success: false, error: '未知操作' });
            }
        } catch (error) {
            console.error('处理消息失败:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // 保持异步消息通道开放
    }
    
    async handleExportData(message, sendResponse) {
        try {
            console.log('开始处理导出请求:', message);
            const { format, data } = message;
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('没有可导出的数据');
            }
            
            console.log(`准备导出 ${data.length} 条数据为 ${format} 格式`);
            const exportHandler = new ExportHandler();
            
            let result;
            switch (format) {
                case 'csv':
                    result = await exportHandler.exportCSV(data);
                    break;
                case 'json':
                    result = await exportHandler.exportJSON(data);
                    break;
                case 'excel':
                    result = await exportHandler.exportExcel(data);
                    break;
                default:
                    throw new Error('不支持的导出格式');
            }
            
            console.log('导出处理完成:', result);
            sendResponse({ success: true, ...result });
        } catch (error) {
            console.error('导出数据失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async handleClearData(sendResponse) {
        try {
            await chrome.storage.local.set({ collectedData: [] });
            sendResponse({ success: true });
        } catch (error) {
            console.error('清除数据失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async handleGetStorageInfo(sendResponse) {
        try {
            const result = await chrome.storage.local.get(['collectedData']);
            const data = result.collectedData || [];
            
            const info = {
                totalCount: data.length,
                dataSize: JSON.stringify(data).length,
                lastUpdate: data.length > 0 ? Math.max(...data.map(item => item.timestamp)) : null
            };
            
            sendResponse({ success: true, info });
        } catch (error) {
            console.error('获取存储信息失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
}

class ExportHandler {
    constructor() {
        this.dateFormatter = new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    async exportCSV(data) {
        try {
            const csvContent = this.convertToCSV(data);
            const filename = this.generateFilename('csv');
            
            await this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
            
            return { filename, count: data.length };
        } catch (error) {
            throw new Error(`CSV导出失败: ${error.message}`);
        }
    }
    
    async exportJSON(data) {
        try {
            const jsonContent = JSON.stringify({
                exportTime: new Date().toISOString(),
                totalCount: data.length,
                data: data
            }, null, 2);
            
            const filename = this.generateFilename('json');
            
            await this.downloadFile(jsonContent, filename, 'application/json;charset=utf-8');
            
            return { filename, count: data.length };
        } catch (error) {
            throw new Error(`JSON导出失败: ${error.message}`);
        }
    }
    
    async exportExcel(data) {
        try {
            // 由于浏览器插件限制，这里生成CSV格式但使用.xlsx扩展名
            // 实际的Excel格式需要额外的库支持
            const csvContent = this.convertToCSV(data);
            const filename = this.generateFilename('xlsx');
            
            await this.downloadFile(csvContent, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            
            return { filename, count: data.length };
        } catch (error) {
            throw new Error(`Excel导出失败: ${error.message}`);
        }
    }
    
    convertToCSV(data) {
        if (!data || data.length === 0) {
            return '没有数据可导出';
        }
        
        // CSV头部
        const headers = [
            '序号',
            '标题',
            '作者',
            '点赞数',
            '收藏数',
            '评论数',
            '图片链接',
            '笔记链接',
            '发布时间',
            '采集时间'
        ];
        
        // 转换数据行
        const rows = data.map((item, index) => [
            index + 1,
            this.escapeCsvValue(item.title || ''),
            this.escapeCsvValue(item.author || ''),
            item.likes || 0,
            item.collects || 0,
            item.comments || 0,
            this.escapeCsvValue(item.imageUrl || ''),
            this.escapeCsvValue(item.url || ''),
            this.escapeCsvValue(item.publishTime || ''),
            this.formatDate(item.timestamp)
        ]);
        
        // 组合CSV内容
        const csvLines = [headers, ...rows];
        return csvLines.map(row => row.join(',')).join('\n');
    }
    
    escapeCsvValue(value) {
        if (typeof value !== 'string') {
            value = String(value);
        }
        
        // 如果包含逗号、引号或换行符，需要用引号包围并转义内部引号
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        return value;
    }
    
    formatDate(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            return this.dateFormatter.format(date);
        } catch (error) {
            return '';
        }
    }
    
    generateFilename(extension) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
        return `小红书数据_${dateStr}.${extension}`;
    }
    
    async downloadFile(content, filename, mimeType) {
        try {
            console.log('开始下载文件，环境检查:');
            console.log('- chrome.downloads:', !!chrome.downloads);
            console.log('- URL:', typeof URL);
            console.log('- URL.createObjectURL:', typeof URL?.createObjectURL);
            console.log('- Blob:', typeof Blob);
            console.log('- btoa:', typeof btoa);
            
            // 检查downloads API是否可用
            if (!chrome.downloads) {
                throw new Error('Downloads API 不可用');
            }
            
            let url;
            let needsCleanup = false;
            
            // 尝试使用Blob URL（推荐方式）
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined') {
                try {
                    const blob = new Blob([content], { type: mimeType });
                    url = URL.createObjectURL(blob);
                    needsCleanup = true;
                    console.log(`使用Blob URL下载文件: ${filename}, 大小: ${blob.size} bytes`);
                } catch (blobError) {
                    console.warn('Blob URL创建失败，尝试备用方案:', blobError);
                    url = null;
                }
            }
            
            // 备用方案：使用Data URL
            if (!url) {
                try {
                    if (typeof btoa === 'undefined') {
                        throw new Error('btoa函数不可用');
                    }
                    
                    // 将内容转换为base64
                    const base64Content = btoa(unescape(encodeURIComponent(content)));
                    url = `data:${mimeType};base64,${base64Content}`;
                    console.log(`使用Data URL下载文件: ${filename}, 内容长度: ${content.length}`);
                } catch (dataError) {
                    console.error('Data URL创建失败:', dataError);
                    throw new Error(`无法创建下载URL: ${dataError.message}`);
                }
            }
            
            if (!url) {
                throw new Error('无法创建有效的下载URL');
            }
            
            console.log(`准备使用Chrome下载API，URL类型: ${url.startsWith('data:') ? 'Data URL' : 'Blob URL'}`);
            
            // 使用Chrome下载API
            const downloadId = await chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });
            
            console.log(`下载开始，ID: ${downloadId}`);
            
            // 清理Blob URL（如果使用了的话）
            if (needsCleanup) {
                setTimeout(() => {
                    try {
                        URL.revokeObjectURL(url);
                        console.log('Blob URL已清理');
                    } catch (e) {
                        console.warn('清理URL失败:', e);
                    }
                }, 1000);
            }
            
            return { downloadId, filename };
        } catch (error) {
            console.error('下载文件详细错误:', error);
            console.error('错误堆栈:', error.stack);
            throw new Error(`文件下载失败: ${error.message}`);
        }
    }
}

class StorageManager {
    static async getData(keys) {
        try {
            return await chrome.storage.local.get(keys);
        } catch (error) {
            console.error('获取存储数据失败:', error);
            return {};
        }
    }
    
    static async setData(data) {
        try {
            await chrome.storage.local.set(data);
            return true;
        } catch (error) {
            console.error('设置存储数据失败:', error);
            return false;
        }
    }
    
    static async getSettings() {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            return result.settings || {};
        } catch (error) {
            console.error('获取设置失败:', error);
            return {};
        }
    }
    
    static async setSettings(settings) {
        try {
            await chrome.storage.sync.set({ settings });
            return true;
        } catch (error) {
            console.error('保存设置失败:', error);
            return false;
        }
    }
    
    static async clearData() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            console.error('清除数据失败:', error);
            return false;
        }
    }
    
    static async getStorageUsage() {
        try {
            const usage = await chrome.storage.local.getBytesInUse();
            return usage;
        } catch (error) {
            console.error('获取存储使用量失败:', error);
            return 0;
        }
    }
}

class DataProcessor {
    static deduplicateData(data, key = 'url') {
        const seen = new Set();
        return data.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }
    
    static filterDataByDate(data, startDate, endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        return data.filter(item => {
            const timestamp = item.timestamp;
            return timestamp >= start && timestamp <= end;
        });
    }
    
    static sortData(data, field = 'timestamp', order = 'desc') {
        return data.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            
            if (order === 'desc') {
                return bVal - aVal;
            } else {
                return aVal - bVal;
            }
        });
    }
    
    static getDataStatistics(data) {
        if (!data || data.length === 0) {
            return {
                total: 0,
                withTitle: 0,
                withAuthor: 0,
                withStats: 0,
                withImages: 0,
                avgLikes: 0,
                avgCollects: 0,
                avgComments: 0
            };
        }
        
        const stats = {
            total: data.length,
            withTitle: data.filter(item => item.title).length,
            withAuthor: data.filter(item => item.author).length,
            withStats: data.filter(item => item.likes !== null || item.collects !== null || item.comments !== null).length,
            withImages: data.filter(item => item.imageUrl).length
        };
        
        // 计算平均值
        const validLikes = data.filter(item => typeof item.likes === 'number');
        const validCollects = data.filter(item => typeof item.collects === 'number');
        const validComments = data.filter(item => typeof item.comments === 'number');
        
        stats.avgLikes = validLikes.length > 0 ? 
            Math.round(validLikes.reduce((sum, item) => sum + item.likes, 0) / validLikes.length) : 0;
        stats.avgCollects = validCollects.length > 0 ? 
            Math.round(validCollects.reduce((sum, item) => sum + item.collects, 0) / validCollects.length) : 0;
        stats.avgComments = validComments.length > 0 ? 
            Math.round(validComments.reduce((sum, item) => sum + item.comments, 0) / validComments.length) : 0;
        
        return stats;
    }
}

// 初始化后台服务
const backgroundService = new BackgroundService();

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BackgroundService,
        ExportHandler,
        StorageManager,
        DataProcessor
    };
}