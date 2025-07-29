class PopupController {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.dataCount = 0;
        this.timer = null;
        
        this.initElements();
        this.bindEvents();
        this.loadSettings();
        this.updateUI();
        this.checkCurrentTab();
    }
    
    initElements() {
        // 状态元素
        this.statusEl = document.getElementById('status');
        this.countEl = document.getElementById('count');
        this.runtimeEl = document.getElementById('runtime');
        
        // 控制按钮
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        
        // 导出按钮
        this.exportCsvBtn = document.getElementById('exportCsv');
        this.exportJsonBtn = document.getElementById('exportJson');
        this.exportExcelBtn = document.getElementById('exportExcel');
        this.clearDataBtn = document.getElementById('clearData');
        
        // 数据预览
        this.dataPreview = document.getElementById('dataPreview');
        
        // 设置面板
        this.settingsPanel = document.getElementById('settingsPanel');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.cancelSettingsBtn = document.getElementById('cancelSettings');
    }
    
    bindEvents() {
        // 控制按钮事件
        this.startBtn.addEventListener('click', () => this.startCollection());
        this.pauseBtn.addEventListener('click', () => this.pauseCollection());
        this.stopBtn.addEventListener('click', () => this.stopCollection());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        
        // 导出按钮事件
        this.exportCsvBtn.addEventListener('click', () => this.exportData('csv'));
        this.exportJsonBtn.addEventListener('click', () => this.exportData('json'));
        this.exportExcelBtn.addEventListener('click', () => this.exportData('excel'));
        this.clearDataBtn.addEventListener('click', () => this.clearData());
        
        // 设置面板事件
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.cancelSettingsBtn.addEventListener('click', () => this.hideSettings());
        
        // 监听来自content script的消息（仅在扩展环境中）
        if (this.isExtensionEnvironment()) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
            });
        }
    }
    
    isExtensionEnvironment() {
        return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage;
    }
    
    async checkCurrentTab() {
        if (!this.isExtensionEnvironment()) {
            this.showWarning('当前为测试环境，部分功能可能无法正常使用');
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('xiaohongshu.com')) {
                this.showError('请在小红书页面使用此插件');
                return;
            }
            
            // 检查是否为搜索页面
            if (!tab.url.includes('/search')) {
                this.showWarning('建议在搜索结果页面使用此插件');
            }
            
            // 获取当前状态
            this.requestStatus();
        } catch (error) {
            console.error('检查当前标签页失败:', error);
        }
    }
    

    
    async requestStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
                if (response) {
                    this.updateStatus(response);
                }
            });
        } catch (error) {
            console.error('获取状态失败:', error);
        }
    }
    
    async startCollection() {
        if (!this.isExtensionEnvironment()) {
            this.showWarning('当前为测试环境，部分功能可能无法正常使用');
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('xiaohongshu.com')) {
                this.showError('请在小红书页面使用此插件');
                return;
            }
            
            const settings = await this.getSettings();
            console.log('发送开始采集消息，设置:', settings);
            
            chrome.tabs.sendMessage(tab.id, {
                action: 'startCollection',
                settings: settings
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('消息发送失败:', chrome.runtime.lastError);
                    this.showError('无法连接到页面，请刷新页面后重试');
                    return;
                }
                
                console.log('收到响应:', response);
                
                if (response && response.success) {
                    this.isRunning = true;
                    this.isPaused = false;
                    this.startTime = Date.now();
                    this.startTimer();
                    this.updateUI();
                    this.showSuccess('采集已开始');
                } else {
                    const errorMsg = response ? response.error : '启动采集失败';
                    this.showError(errorMsg);
                }
            });
        } catch (error) {
            console.error('启动采集失败:', error);
            this.showError('启动采集失败: ' + error.message);
        }
    }
    
    async pauseCollection() {
        if (!this.isExtensionEnvironment()) {
            this.showWarning('当前为测试环境，部分功能可能无法正常使用');
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (this.isPaused) {
                // 恢复采集
                chrome.tabs.sendMessage(tab.id, { action: 'resumeCollection' });
                this.isPaused = false;
                this.startTimer();
            } else {
                // 暂停采集
                chrome.tabs.sendMessage(tab.id, { action: 'pauseCollection' });
                this.isPaused = true;
                this.stopTimer();
            }
            
            this.updateUI();
        } catch (error) {
            console.error('暂停/恢复采集失败:', error);
        }
    }
    
    async stopCollection() {
        if (!this.isExtensionEnvironment()) {
            this.showWarning('当前为测试环境，部分功能可能无法正常使用');
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            chrome.tabs.sendMessage(tab.id, { action: 'stopCollection' });
            
            this.isRunning = false;
            this.isPaused = false;
            this.stopTimer();
            this.updateUI();
        } catch (error) {
            console.error('停止采集失败:', error);
        }
    }
    
    async exportData(format) {
        if (!this.isExtensionEnvironment()) {
            this.showWarning('当前为测试环境，部分功能可能无法正常使用');
            return;
        }
        
        try {
            const data = await chrome.storage.local.get(['collectedData']);
            const collectedData = data.collectedData || [];
            
            console.log(`准备导出 ${collectedData.length} 条数据:`, collectedData.slice(0, 2));
            
            // 验证数据格式
            if (!Array.isArray(collectedData)) {
                this.showError('数据格式错误：不是数组');
                return;
            }
            
            if (collectedData.length === 0) {
                this.showError('没有可导出的数据');
                return;
            }
            
            console.log(`开始导出${format.toUpperCase()}格式，数据量:`, collectedData.length);
            
            // 发送导出请求到background script
            chrome.runtime.sendMessage({
                action: 'exportData',
                format: format,
                data: collectedData
            }, (response) => {
                // 检查runtime错误
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    this.showError(`导出失败: ${chrome.runtime.lastError.message}`);
                    return;
                }
                
                console.log('导出响应:', response);
                
                if (response && response.success) {
                    console.log('导出成功:', response);
                    this.showSuccess(`成功导出 ${collectedData.length} 条数据`);
                } else {
                    const errorMsg = response && response.error ? response.error : '未知错误';
                    console.error('导出失败:', errorMsg);
                    this.showError(`导出失败: ${errorMsg}`);
                }
            });
        } catch (error) {
            console.error('导出数据异常:', error);
            this.showError(`导出失败: ${error.message}`);
        }
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'statusUpdate':
                this.updateStatus(message.data);
                break;
            case 'dataUpdate':
                this.updateDataPreview(message.data);
                break;
            case 'collectionComplete':
                this.onCollectionComplete();
                break;
            case 'error':
                this.showError(message.message);
                break;
        }
    }
    
    updateStatus(status) {
        this.isRunning = status.isRunning;
        this.isPaused = status.isPaused;
        this.dataCount = status.dataCount;
        
        if (status.startTime) {
            this.startTime = status.startTime;
            if (this.isRunning && !this.isPaused) {
                this.startTimer();
            }
        }
        
        this.updateUI();
    }
    
    updateDataPreview(newData) {
        if (!newData || newData.length === 0) return;
        
        this.dataCount = newData.length;
        this.countEl.textContent = `${this.dataCount} 条数据`;
        
        // 更新预览区域
        const previewHtml = newData.slice(-3).reverse().map(item => `
            <div class="data-item">
                <div class="data-title">${item.title || '无标题'}</div>
                <div class="data-meta">
                    作者: ${item.author || '未知'} | 
                    点赞: ${item.likes || 0} | 
                    时间: ${new Date(item.timestamp).toLocaleTimeString()}
                </div>
            </div>
        `).join('');
        
        this.dataPreview.innerHTML = previewHtml || '<div class="no-data">暂无数据</div>';
        
        // 启用导出按钮
        this.exportCsvBtn.disabled = false;
        this.exportJsonBtn.disabled = false;
        this.exportExcelBtn.disabled = false;
    }
    
    onCollectionComplete() {
        this.isRunning = false;
        this.isPaused = false;
        this.stopTimer();
        this.updateUI();
        this.showSuccess('数据采集完成');
    }
    
    updateUI() {
        // 更新状态显示
        if (this.isRunning) {
            if (this.isPaused) {
                this.statusEl.textContent = '已暂停';
                this.statusEl.className = 'status-value paused';
                this.pauseBtn.textContent = '继续';
            } else {
                this.statusEl.textContent = '运行中';
                this.statusEl.className = 'status-value running';
                this.pauseBtn.textContent = '暂停';
            }
        } else {
            this.statusEl.textContent = '待启动';
            this.statusEl.className = 'status-value stopped';
        }
        
        // 更新按钮状态
        this.startBtn.disabled = this.isRunning;
        this.pauseBtn.disabled = !this.isRunning;
        this.stopBtn.disabled = !this.isRunning;
        
        // 更新数据计数
        this.countEl.textContent = `${this.dataCount} 条数据`;
    }
    
    startTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timer = setInterval(() => {
            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                const hours = Math.floor(elapsed / 3600000);
                const minutes = Math.floor((elapsed % 3600000) / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                this.runtimeEl.textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    
    showSettings() {
        this.settingsPanel.classList.remove('hidden');
    }
    
    hideSettings() {
        this.settingsPanel.classList.add('hidden');
    }
    
    async loadSettings() {
        try {
            const settings = await this.getSettings();
            
            document.getElementById('scrollSpeed').value = settings.scrollSpeed;
            document.getElementById('scrollInterval').value = settings.scrollInterval;
            document.getElementById('maxScrolls').value = settings.maxScrolls;
            document.getElementById('smartStop').checked = settings.smartStop;
            document.getElementById('collectTitle').checked = settings.collectTitle;
            document.getElementById('collectAuthor').checked = settings.collectAuthor;
            document.getElementById('collectStats').checked = settings.collectStats;
            document.getElementById('collectImages').checked = settings.collectImages;
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }
    
    async saveSettings() {
        try {
            const settings = {
                scrollSpeed: parseInt(document.getElementById('scrollSpeed').value),
                scrollInterval: parseInt(document.getElementById('scrollInterval').value),
                maxScrolls: parseInt(document.getElementById('maxScrolls').value),
                smartStop: document.getElementById('smartStop').checked,
                collectTitle: document.getElementById('collectTitle').checked,
                collectAuthor: document.getElementById('collectAuthor').checked,
                collectStats: document.getElementById('collectStats').checked,
                collectImages: document.getElementById('collectImages').checked
            };
            
            if (this.isExtensionEnvironment()) {
                await chrome.storage.sync.set({ settings });
            }
            
            this.hideSettings();
            this.showSuccess('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showError('保存设置失败');
        }
    }
    
    async getSettings() {
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
        
        try {
            if (this.isExtensionEnvironment()) {
                const result = await chrome.storage.sync.get(['settings']);
                return result.settings || defaultSettings;
            } else {
                return defaultSettings;
            }
        } catch (error) {
            console.error('获取设置失败:', error);
            return defaultSettings;
        }
    }
    
    async clearData() {
        try {
            // 确认对话框
            if (!confirm('确定要清除所有采集的数据吗？此操作不可撤销。')) {
                return;
            }
            
            if (this.isExtensionEnvironment()) {
                // 清除chrome.storage中的数据
                await chrome.storage.local.remove(['collectedData']);
                
                // 通知content script清除数据
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.url.includes('xiaohongshu.com')) {
                    chrome.tabs.sendMessage(tab.id, { action: 'clearData' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Content script未响应，这是正常的');
                        }
                    });
                }
            }
            
            // 清除模拟数据
            if (typeof window.mockCollectedData !== 'undefined') {
                window.mockCollectedData = [];
            }
            
            // 重置UI状态
            this.dataCount = 0;
            this.updateDataPreview([]);
            this.updateUI();
            
            this.showSuccess('数据已清除');
        } catch (error) {
            console.error('清除数据失败:', error);
            this.showError('清除数据失败');
        }
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showWarning(message) {
        this.showNotification(message, 'warning');
    }
    
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        // 根据类型设置背景色
        switch (type) {
            case 'error':
                notification.style.background = '#dc3545';
                break;
            case 'success':
                notification.style.background = '#28a745';
                break;
            case 'warning':
                notification.style.background = '#ffc107';
                notification.style.color = '#333';
                break;
            default:
                notification.style.background = '#17a2b8';
        }
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 初始化popup控制器
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);