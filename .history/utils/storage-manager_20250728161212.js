/**
 * 存储管理工具类
 * 提供统一的数据存储和管理接口
 */
class StorageManagerUtils {
    constructor() {
        // 存储键名常量
        this.KEYS = {
            SETTINGS: 'xhs_plugin_settings',
            DATA: 'xhs_plugin_data',
            STATS: 'xhs_plugin_stats',
            HISTORY: 'xhs_plugin_history',
            CACHE: 'xhs_plugin_cache',
            STATE: 'xhs_plugin_state'
        };
        
        // 默认设置
        this.DEFAULT_SETTINGS = {
            scroll: {
                speed: 5,
                interval: 3000,
                maxScrolls: 100,
                smartStop: true,
                randomDelay: true,
                smoothScroll: true
            },
            collection: {
                autoStart: false,
                duplicateFilter: true,
                maxItems: 1000,
                saveInterval: 10,
                includeImages: true,
                includeStats: true
            },
            export: {
                format: 'csv',
                filename: 'xhs_data',
                includeTimestamp: true,
                fields: ['title', 'author', 'likes', 'collects', 'comments', 'url']
            },
            ui: {
                theme: 'light',
                language: 'zh-CN',
                notifications: true,
                autoClose: false
            }
        };
        
        // 缓存
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
        
        this.init();
    }
    
    /**
     * 初始化存储管理器
     */
    async init() {
        try {
            // 检查存储API可用性
            if (!this.isStorageAvailable()) {
                throw new Error('存储API不可用');
            }
            
            // 初始化默认设置
            await this.initializeDefaults();
            
            // 清理过期数据
            await this.cleanupExpiredData();
            
            console.log('存储管理器初始化完成');
        } catch (error) {
            console.error('存储管理器初始化失败:', error);
            throw error;
        }
    }
    
    /**
     * 检查存储API是否可用
     * @returns {boolean} 是否可用
     */
    isStorageAvailable() {
        return typeof chrome !== 'undefined' && 
               chrome.storage && 
               chrome.storage.local;
    }
    
    /**
     * 初始化默认数据
     */
    async initializeDefaults() {
        try {
            // 检查是否已有设置
            const existingSettings = await this.get(this.KEYS.SETTINGS);
            if (!existingSettings) {
                await this.set(this.KEYS.SETTINGS, this.DEFAULT_SETTINGS);
                console.log('已初始化默认设置');
            }
            
            // 初始化空数据数组
            const existingData = await this.get(this.KEYS.DATA);
            if (!existingData) {
                await this.set(this.KEYS.DATA, []);
            }
            
            // 初始化统计信息
            const existingStats = await this.get(this.KEYS.STATS);
            if (!existingStats) {
                await this.set(this.KEYS.STATS, {
                    totalCollected: 0,
                    totalSessions: 0,
                    lastCollectionTime: null,
                    averageItemsPerSession: 0,
                    totalRuntime: 0
                });
            }
            
        } catch (error) {
            console.error('初始化默认数据失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取数据
     * @param {string} key 键名
     * @param {*} defaultValue 默认值
     * @returns {Promise<*>} 数据
     */
    async get(key, defaultValue = null) {
        try {
            // 检查缓存
            if (this.cache.has(key)) {
                const cached = this.cache.get(key);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.data;
                } else {
                    this.cache.delete(key);
                }
            }
            
            // 从存储获取
            const result = await chrome.storage.local.get(key);
            const data = result[key] !== undefined ? result[key] : defaultValue;
            
            // 更新缓存
            this.cache.set(key, {
                data: data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error(`获取数据失败 (${key}):`, error);
            return defaultValue;
        }
    }
    
    /**
     * 设置数据
     * @param {string} key 键名
     * @param {*} value 值
     * @returns {Promise<boolean>} 是否成功
     */
    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
            
            // 更新缓存
            this.cache.set(key, {
                data: value,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            console.error(`设置数据失败 (${key}):`, error);
            return false;
        }
    }
    
    /**
     * 删除数据
     * @param {string} key 键名
     * @returns {Promise<boolean>} 是否成功
     */
    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
            this.cache.delete(key);
            return true;
        } catch (error) {
            console.error(`删除数据失败 (${key}):`, error);
            return false;
        }
    }
    
    /**
     * 清空所有数据
     * @returns {Promise<boolean>} 是否成功
     */
    async clear() {
        try {
            await chrome.storage.local.clear();
            this.cache.clear();
            
            // 重新初始化默认数据
            await this.initializeDefaults();
            
            return true;
        } catch (error) {
            console.error('清空数据失败:', error);
            return false;
        }
    }
    
    /**
     * 获取存储使用情况
     * @returns {Promise<Object>} 存储信息
     */
    async getStorageInfo() {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB默认配额
            
            return {
                bytesInUse,
                quota,
                percentUsed: (bytesInUse / quota * 100).toFixed(2),
                available: quota - bytesInUse
            };
        } catch (error) {
            console.error('获取存储信息失败:', error);
            return null;
        }
    }
    
    /**
     * 获取设置
     * @param {string} section 设置分区
     * @returns {Promise<Object>} 设置对象
     */
    async getSettings(section = null) {
        const settings = await this.get(this.KEYS.SETTINGS, this.DEFAULT_SETTINGS);
        return section ? settings[section] : settings;
    }
    
    /**
     * 更新设置
     * @param {string} section 设置分区
     * @param {Object} newSettings 新设置
     * @returns {Promise<boolean>} 是否成功
     */
    async updateSettings(section, newSettings) {
        try {
            const currentSettings = await this.getSettings();
            
            if (section) {
                currentSettings[section] = {
                    ...currentSettings[section],
                    ...newSettings
                };
            } else {
                Object.assign(currentSettings, newSettings);
            }
            
            return await this.set(this.KEYS.SETTINGS, currentSettings);
        } catch (error) {
            console.error('更新设置失败:', error);
            return false;
        }
    }
    
    /**
     * 重置设置
     * @param {string} section 设置分区（可选）
     * @returns {Promise<boolean>} 是否成功
     */
    async resetSettings(section = null) {
        try {
            if (section) {
                const currentSettings = await this.getSettings();
                currentSettings[section] = this.DEFAULT_SETTINGS[section];
                return await this.set(this.KEYS.SETTINGS, currentSettings);
            } else {
                return await this.set(this.KEYS.SETTINGS, this.DEFAULT_SETTINGS);
            }
        } catch (error) {
            console.error('重置设置失败:', error);
            return false;
        }
    }
    
    /**
     * 获取数据
     * @param {Object} options 查询选项
     * @returns {Promise<Array>} 数据数组
     */
    async getData(options = {}) {
        try {
            const data = await this.get(this.KEYS.DATA, []);
            
            // 应用过滤器
            let filteredData = data;
            
            if (options.dateFrom || options.dateTo) {
                filteredData = this.filterByDate(filteredData, options.dateFrom, options.dateTo);
            }
            
            if (options.author) {
                filteredData = filteredData.filter(item => 
                    item.author && item.author.includes(options.author)
                );
            }
            
            if (options.minLikes !== undefined) {
                filteredData = filteredData.filter(item => 
                    item.likes >= options.minLikes
                );
            }
            
            // 应用排序
            if (options.sortBy) {
                filteredData = this.sortData(filteredData, options.sortBy, options.sortOrder);
            }
            
            // 应用分页
            if (options.limit || options.offset) {
                const offset = options.offset || 0;
                const limit = options.limit || filteredData.length;
                filteredData = filteredData.slice(offset, offset + limit);
            }
            
            return filteredData;
        } catch (error) {
            console.error('获取数据失败:', error);
            return [];
        }
    }
    
    /**
     * 添加数据
     * @param {Array|Object} newData 新数据
     * @returns {Promise<boolean>} 是否成功
     */
    async addData(newData) {
        try {
            const currentData = await this.get(this.KEYS.DATA, []);
            const dataArray = Array.isArray(newData) ? newData : [newData];
            
            // 添加时间戳
            const timestampedData = dataArray.map(item => ({
                ...item,
                collectedAt: item.collectedAt || Date.now()
            }));
            
            // 合并数据
            const updatedData = [...currentData, ...timestampedData];
            
            // 检查存储限制
            const settings = await this.getSettings('collection');
            if (settings.maxItems && updatedData.length > settings.maxItems) {
                // 保留最新的数据
                updatedData.splice(0, updatedData.length - settings.maxItems);
            }
            
            const success = await this.set(this.KEYS.DATA, updatedData);
            
            if (success) {
                // 更新统计信息
                await this.updateStats({
                    totalCollected: updatedData.length,
                    lastCollectionTime: Date.now()
                });
            }
            
            return success;
        } catch (error) {
            console.error('添加数据失败:', error);
            return false;
        }
    }
    
    /**
     * 更新数据项
     * @param {string} id 数据ID
     * @param {Object} updates 更新内容
     * @returns {Promise<boolean>} 是否成功
     */
    async updateDataItem(id, updates) {
        try {
            const data = await this.get(this.KEYS.DATA, []);
            const index = data.findIndex(item => item.id === id);
            
            if (index === -1) {
                console.warn(`未找到ID为 ${id} 的数据项`);
                return false;
            }
            
            data[index] = { ...data[index], ...updates };
            return await this.set(this.KEYS.DATA, data);
        } catch (error) {
            console.error('更新数据项失败:', error);
            return false;
        }
    }
    
    /**
     * 删除数据项
     * @param {string|Array} ids 数据ID或ID数组
     * @returns {Promise<boolean>} 是否成功
     */
    async removeDataItems(ids) {
        try {
            const data = await this.get(this.KEYS.DATA, []);
            const idsArray = Array.isArray(ids) ? ids : [ids];
            
            const filteredData = data.filter(item => !idsArray.includes(item.id));
            
            const success = await this.set(this.KEYS.DATA, filteredData);
            
            if (success) {
                await this.updateStats({
                    totalCollected: filteredData.length
                });
            }
            
            return success;
        } catch (error) {
            console.error('删除数据项失败:', error);
            return false;
        }
    }
    
    /**
     * 清空数据
     * @returns {Promise<boolean>} 是否成功
     */
    async clearData() {
        try {
            const success = await this.set(this.KEYS.DATA, []);
            
            if (success) {
                await this.updateStats({
                    totalCollected: 0
                });
            }
            
            return success;
        } catch (error) {
            console.error('清空数据失败:', error);
            return false;
        }
    }
    
    /**
     * 获取统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getStats() {
        return await this.get(this.KEYS.STATS, {
            totalCollected: 0,
            totalSessions: 0,
            lastCollectionTime: null,
            averageItemsPerSession: 0,
            totalRuntime: 0
        });
    }
    
    /**
     * 更新统计信息
     * @param {Object} updates 更新内容
     * @returns {Promise<boolean>} 是否成功
     */
    async updateStats(updates) {
        try {
            const currentStats = await this.getStats();
            const updatedStats = { ...currentStats, ...updates };
            
            // 计算平均值
            if (updatedStats.totalSessions > 0) {
                updatedStats.averageItemsPerSession = 
                    Math.round(updatedStats.totalCollected / updatedStats.totalSessions);
            }
            
            return await this.set(this.KEYS.STATS, updatedStats);
        } catch (error) {
            console.error('更新统计信息失败:', error);
            return false;
        }
    }
    
    /**
     * 保存会话历史
     * @param {Object} sessionData 会话数据
     * @returns {Promise<boolean>} 是否成功
     */
    async saveSessionHistory(sessionData) {
        try {
            const history = await this.get(this.KEYS.HISTORY, []);
            
            const session = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                ...sessionData
            };
            
            history.unshift(session);
            
            // 保留最近50个会话
            if (history.length > 50) {
                history.splice(50);
            }
            
            return await this.set(this.KEYS.HISTORY, history);
        } catch (error) {
            console.error('保存会话历史失败:', error);
            return false;
        }
    }
    
    /**
     * 获取会话历史
     * @param {number} limit 限制数量
     * @returns {Promise<Array>} 会话历史
     */
    async getSessionHistory(limit = 10) {
        const history = await this.get(this.KEYS.HISTORY, []);
        return history.slice(0, limit);
    }
    
    /**
     * 按日期过滤数据
     * @param {Array} data 数据数组
     * @param {number} dateFrom 开始日期
     * @param {number} dateTo 结束日期
     * @returns {Array} 过滤后的数据
     */
    filterByDate(data, dateFrom, dateTo) {
        return data.filter(item => {
            const itemDate = item.collectedAt || item.timestamp || 0;
            
            if (dateFrom && itemDate < dateFrom) return false;
            if (dateTo && itemDate > dateTo) return false;
            
            return true;
        });
    }
    
    /**
     * 排序数据
     * @param {Array} data 数据数组
     * @param {string} sortBy 排序字段
     * @param {string} sortOrder 排序顺序
     * @returns {Array} 排序后的数据
     */
    sortData(data, sortBy, sortOrder = 'desc') {
        return data.sort((a, b) => {
            let valueA = a[sortBy];
            let valueB = b[sortBy];
            
            // 处理数字类型
            if (typeof valueA === 'string' && !isNaN(valueA)) {
                valueA = parseFloat(valueA);
            }
            if (typeof valueB === 'string' && !isNaN(valueB)) {
                valueB = parseFloat(valueB);
            }
            
            // 处理字符串类型
            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
            }
            if (typeof valueB === 'string') {
                valueB = valueB.toLowerCase();
            }
            
            let comparison = 0;
            if (valueA > valueB) {
                comparison = 1;
            } else if (valueA < valueB) {
                comparison = -1;
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
        });
    }
    
    /**
     * 清理过期数据
     */
    async cleanupExpiredData() {
        try {
            // 清理过期缓存
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > this.cacheTimeout) {
                    this.cache.delete(key);
                }
            }
            
            // 清理过期会话历史（保留最近30天）
            const history = await this.get(this.KEYS.HISTORY, []);
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            const filteredHistory = history.filter(session => 
                session.timestamp > thirtyDaysAgo
            );
            
            if (filteredHistory.length !== history.length) {
                await this.set(this.KEYS.HISTORY, filteredHistory);
                console.log(`清理了 ${history.length - filteredHistory.length} 个过期会话`);
            }
            
        } catch (error) {
            console.error('清理过期数据失败:', error);
        }
    }
    
    /**
     * 导出所有数据
     * @returns {Promise<Object>} 导出的数据
     */
    async exportAllData() {
        try {
            const data = await this.get(this.KEYS.DATA, []);
            const settings = await this.get(this.KEYS.SETTINGS);
            const stats = await this.get(this.KEYS.STATS);
            const history = await this.get(this.KEYS.HISTORY, []);
            
            return {
                data,
                settings,
                stats,
                history,
                exportTime: Date.now(),
                version: '1.0.0'
            };
        } catch (error) {
            console.error('导出数据失败:', error);
            return null;
        }
    }
    
    /**
     * 导入数据
     * @param {Object} importData 导入的数据
     * @param {Object} options 导入选项
     * @returns {Promise<boolean>} 是否成功
     */
    async importData(importData, options = {}) {
        try {
            const { mergeData = false, overwriteSettings = false } = options;
            
            // 导入数据
            if (importData.data) {
                if (mergeData) {
                    const currentData = await this.get(this.KEYS.DATA, []);
                    const mergedData = [...currentData, ...importData.data];
                    await this.set(this.KEYS.DATA, mergedData);
                } else {
                    await this.set(this.KEYS.DATA, importData.data);
                }
            }
            
            // 导入设置
            if (importData.settings && overwriteSettings) {
                await this.set(this.KEYS.SETTINGS, importData.settings);
            }
            
            // 导入统计信息
            if (importData.stats) {
                await this.set(this.KEYS.STATS, importData.stats);
            }
            
            // 导入历史记录
            if (importData.history) {
                if (mergeData) {
                    const currentHistory = await this.get(this.KEYS.HISTORY, []);
                    const mergedHistory = [...currentHistory, ...importData.history];
                    await this.set(this.KEYS.HISTORY, mergedHistory);
                } else {
                    await this.set(this.KEYS.HISTORY, importData.history);
                }
            }
            
            console.log('数据导入成功');
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            return false;
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManagerUtils;
} else if (typeof window !== 'undefined') {
    window.StorageManagerUtils = StorageManagerUtils;
}