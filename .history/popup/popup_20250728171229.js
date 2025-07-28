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
            // 测试环境，显示模拟状态
            this.showWarning('当前为测试环境，部分功能可能无法正常使用');
            this.simulateTestData();
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
    
    simulateTestData() {
        // 在测试环境中模拟一些数据
        const testData = [
            {
                url: 'https://www.xiaohongshu.com/explore/test1',
                title: '测试笔记1',
                author: '测试用户1',
                likes: 100,
                timestamp: Date.now() - 3600000
            },
            {
                url: 'https://www.xiaohongshu.com/explore/test2',
                title: '测试笔记2',
                author: '测试用户2',
                likes: 200,
                timestamp: Date.now() - 1800000
            }
        ];
        
        this.updateDataPreview(testData);
        this.dataCount = testData.length;
        this.updateUI();
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
            // 测试环境模拟采集
            this.showSuccess('测试环境：模拟开始采集');
            this.isRunning = true;
            this.isPaused = false;
            this.startTime = Date.now();
            this.startTimer();
            this.updateUI();
            return;
        }
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const settings = await this.getSettings();
            
            chrome.tabs.sendMessage(tab.id, {
                action: 'startCollection',
                settings: settings
            }, (response) => {
                if (response && response.success) {
                    this.isRunning = true;
                    this.isPaused = false;
                    this.startTime = Date.now();
                    this.startTimer();
                    this.updateUI();
                } else {
                    this.showError('启动采集失败');
                }
            });
        } catch (error) {
            console.error('启动采集失败:', error);
            this.showError('启动采集失败');
        }
    }
    
    async pauseCollection() {
        if (!this.isExtensionEnvironment()) {
            // 测试环境模拟暂停/恢复
            if (this.isPaused) {
                this.showSuccess('测试环境：模拟恢复采集');
                this.isPaused = false;
                this.startTimer();
            } else {
                this.showSuccess('测试环境：模拟暂停采集');
                this.isPaused = true;
                this.stopTimer();
            }
            this.updateUI();
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
            // 测试环境模拟停止
            this.showSuccess('测试环境：模拟停止采集');
            this.isRunning = false;
            this.isPaused = false;
            this.stopTimer();
            this.updateUI();
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
            // 测试环境模拟导出
            this.showSuccess(`测试环境：模拟导出${format.toUpperCase()}格式数据`);
            return;
        }
        
        try {
            const data = await chrome.storage.local.get(['collectedData']);
            const collectedData = data.collectedData || [];
            
            if (collectedData.length === 0) {
                this.showError('没有可导出的数据');
                return;
            }
            
            // 发送导出请求到background script
            chrome.runtime.sendMessage({
                action: 'exportData',
                format: format,
                data: collectedData
            }, (response) => {
                if (response && response.success) {
                    this.showSuccess(`成功导出 ${collectedData.length} 条数据`);
                } else {
                    this.showError('导出失败');
                }
            });
        } catch (error) {
            console.error('导出数据失败:', error);
            this.showError('导出失败');
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
            } else {
                // 测试环境使用localStorage
                localStorage.setItem('xhs-plugin-settings', JSON.stringify(settings));
            }
            
            this.hideSettings();
            this.showSuccess('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showError('保存设置失败');
        }
    }
    
    async getSettings() {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            return result.settings || {
                scrollSpeed: 5,
                scrollInterval: 3,
                maxScrolls: 100,
                smartStop: true,
                collectTitle: true,
                collectAuthor: true,
                collectStats: true,
                collectImages: true
            };
        } catch (error) {
            console.error('获取设置失败:', error);
            return {};
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