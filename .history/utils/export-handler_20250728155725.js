/**
 * 数据导出处理工具类
 * 支持CSV、JSON、Excel等格式的数据导出
 */
class ExportHandlerUtils {
    constructor() {
        this.dateFormatter = new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Shanghai'
        });
        
        // 导出字段配置
        this.exportFields = {
            序号: (item, index) => index + 1,
            标题: (item) => item.title || '',
            作者: (item) => item.author || '',
            点赞数: (item) => item.likes || 0,
            收藏数: (item) => item.collects || 0,
            评论数: (item) => item.comments || 0,
            图片链接: (item) => item.imageUrl || '',
            笔记链接: (item) => item.url || '',
            采集时间: (item) => this.formatTimestamp(item.timestamp)
        };
    }
    
    /**
     * 导出为CSV格式
     * @param {Array} data 要导出的数据
     * @param {Object} options 导出选项
     * @returns {Promise<Object>} 导出结果
     */
    async exportToCSV(data, options = {}) {
        try {
            if (!data || data.length === 0) {
                throw new Error('没有数据可导出');
            }
            
            const csvContent = this.convertToCSV(data, options);
            const filename = this.generateFilename('csv', options);
            const blob = new Blob([csvContent], { 
                type: 'text/csv;charset=utf-8' 
            });
            
            return {
                blob,
                filename,
                content: csvContent,
                size: blob.size,
                count: data.length
            };
        } catch (error) {
            throw new Error(`CSV导出失败: ${error.message}`);
        }
    }
    
    /**
     * 导出为JSON格式
     * @param {Array} data 要导出的数据
     * @param {Object} options 导出选项
     * @returns {Promise<Object>} 导出结果
     */
    async exportToJSON(data, options = {}) {
        try {
            if (!data || data.length === 0) {
                throw new Error('没有数据可导出');
            }
            
            const jsonData = {
                metadata: {
                    exportTime: new Date().toISOString(),
                    totalCount: data.length,
                    version: '1.0',
                    source: 'XHS Data Collector',
                    ...options.metadata
                },
                data: this.processDataForExport(data, options)
            };
            
            const jsonContent = JSON.stringify(jsonData, null, options.pretty ? 2 : 0);
            const filename = this.generateFilename('json', options);
            const blob = new Blob([jsonContent], { 
                type: 'application/json;charset=utf-8' 
            });
            
            return {
                blob,
                filename,
                content: jsonContent,
                size: blob.size,
                count: data.length
            };
        } catch (error) {
            throw new Error(`JSON导出失败: ${error.message}`);
        }
    }
    
    /**
     * 导出为Excel格式（实际为CSV，但使用.xlsx扩展名）
     * @param {Array} data 要导出的数据
     * @param {Object} options 导出选项
     * @returns {Promise<Object>} 导出结果
     */
    async exportToExcel(data, options = {}) {
        try {
            if (!data || data.length === 0) {
                throw new Error('没有数据可导出');
            }
            
            // 为Excel优化CSV格式
            const excelOptions = {
                ...options,
                encoding: 'utf-8-bom', // 添加BOM以确保Excel正确识别UTF-8
                delimiter: ','
            };
            
            const csvContent = this.convertToCSV(data, excelOptions);
            const filename = this.generateFilename('xlsx', options);
            
            // 添加BOM
            const bom = '\uFEFF';
            const contentWithBom = bom + csvContent;
            
            const blob = new Blob([contentWithBom], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8' 
            });
            
            return {
                blob,
                filename,
                content: contentWithBom,
                size: blob.size,
                count: data.length
            };
        } catch (error) {
            throw new Error(`Excel导出失败: ${error.message}`);
        }
    }
    
    /**
     * 转换数据为CSV格式
     * @param {Array} data 数据数组
     * @param {Object} options 转换选项
     * @returns {string} CSV内容
     */
    convertToCSV(data, options = {}) {
        const delimiter = options.delimiter || ',';
        const fields = options.fields || this.exportFields;
        
        // 生成表头
        const headers = Object.keys(fields);
        const headerRow = headers.map(header => this.escapeCsvValue(header, delimiter)).join(delimiter);
        
        // 生成数据行
        const dataRows = data.map((item, index) => {
            return headers.map(header => {
                const fieldProcessor = fields[header];
                let value = '';
                
                if (typeof fieldProcessor === 'function') {
                    value = fieldProcessor(item, index);
                } else if (typeof fieldProcessor === 'string') {
                    value = item[fieldProcessor] || '';
                }
                
                return this.escapeCsvValue(value, delimiter);
            }).join(delimiter);
        });
        
        // 组合所有行
        return [headerRow, ...dataRows].join('\n');
    }
    
    /**
     * 处理数据用于导出
     * @param {Array} data 原始数据
     * @param {Object} options 处理选项
     * @returns {Array} 处理后的数据
     */
    processDataForExport(data, options = {}) {
        let processedData = [...data];
        
        // 数据过滤
        if (options.filter) {
            processedData = processedData.filter(options.filter);
        }
        
        // 字段选择
        if (options.selectedFields && options.selectedFields.length > 0) {
            processedData = processedData.map(item => {
                const filtered = {};
                options.selectedFields.forEach(field => {
                    if (item.hasOwnProperty(field)) {
                        filtered[field] = item[field];
                    }
                });
                return filtered;
            });
        }
        
        // 数据排序
        if (options.sortBy) {
            processedData.sort((a, b) => {
                const aVal = a[options.sortBy];
                const bVal = b[options.sortBy];
                
                if (options.sortOrder === 'desc') {
                    return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
                } else {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                }
            });
        }
        
        // 数据限制
        if (options.limit && options.limit > 0) {
            processedData = processedData.slice(0, options.limit);
        }
        
        return processedData;
    }
    
    /**
     * 转义CSV值
     * @param {any} value 要转义的值
     * @param {string} delimiter 分隔符
     * @returns {string} 转义后的值
     */
    escapeCsvValue(value, delimiter = ',') {
        if (value === null || value === undefined) {
            return '';
        }
        
        let stringValue = String(value);
        
        // 如果包含分隔符、引号、换行符或回车符，需要用引号包围
        const needsQuoting = stringValue.includes(delimiter) || 
                           stringValue.includes('"') || 
                           stringValue.includes('\n') || 
                           stringValue.includes('\r');
        
        if (needsQuoting) {
            // 转义内部的引号
            stringValue = stringValue.replace(/"/g, '""');
            // 用引号包围
            stringValue = `"${stringValue}"`;
        }
        
        return stringValue;
    }
    
    /**
     * 格式化时间戳
     * @param {number} timestamp 时间戳
     * @returns {string} 格式化后的时间
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            return this.dateFormatter.format(date);
        } catch (error) {
            console.warn('时间格式化失败:', timestamp, error);
            return '';
        }
    }
    
    /**
     * 生成文件名
     * @param {string} extension 文件扩展名
     * @param {Object} options 选项
     * @returns {string} 生成的文件名
     */
    generateFilename(extension, options = {}) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
        
        let filename = options.filename || `小红书数据_${dateStr}`;
        
        // 确保文件名安全
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        return `${filename}.${extension}`;
    }
    
    /**
     * 触发文件下载
     * @param {Blob} blob 文件数据
     * @param {string} filename 文件名
     * @returns {Promise<void>}
     */
    async downloadFile(blob, filename) {
        try {
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            
            // 创建临时下载链接
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            // 添加到页面并触发点击
            document.body.appendChild(link);
            link.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            throw new Error(`文件下载失败: ${error.message}`);
        }
    }
    
    /**
     * 获取数据统计信息
     * @param {Array} data 数据数组
     * @returns {Object} 统计信息
     */
    getDataStatistics(data) {
        if (!data || data.length === 0) {
            return {
                total: 0,
                withTitle: 0,
                withAuthor: 0,
                withStats: 0,
                withImages: 0,
                avgLikes: 0,
                avgCollects: 0,
                avgComments: 0,
                dateRange: null
            };
        }
        
        const stats = {
            total: data.length,
            withTitle: data.filter(item => item.title && item.title.trim()).length,
            withAuthor: data.filter(item => item.author && item.author.trim()).length,
            withStats: data.filter(item => 
                item.likes !== null || item.collects !== null || item.comments !== null
            ).length,
            withImages: data.filter(item => item.imageUrl && item.imageUrl.trim()).length
        };
        
        // 计算平均值
        const validLikes = data.filter(item => typeof item.likes === 'number' && item.likes >= 0);
        const validCollects = data.filter(item => typeof item.collects === 'number' && item.collects >= 0);
        const validComments = data.filter(item => typeof item.comments === 'number' && item.comments >= 0);
        
        stats.avgLikes = validLikes.length > 0 ? 
            Math.round(validLikes.reduce((sum, item) => sum + item.likes, 0) / validLikes.length) : 0;
        stats.avgCollects = validCollects.length > 0 ? 
            Math.round(validCollects.reduce((sum, item) => sum + item.collects, 0) / validCollects.length) : 0;
        stats.avgComments = validComments.length > 0 ? 
            Math.round(validComments.reduce((sum, item) => sum + item.comments, 0) / validComments.length) : 0;
        
        // 计算时间范围
        const timestamps = data.filter(item => item.timestamp).map(item => item.timestamp);
        if (timestamps.length > 0) {
            const minTime = Math.min(...timestamps);
            const maxTime = Math.max(...timestamps);
            stats.dateRange = {
                start: this.formatTimestamp(minTime),
                end: this.formatTimestamp(maxTime)
            };
        }
        
        return stats;
    }
    
    /**
     * 验证导出数据
     * @param {Array} data 要验证的数据
     * @returns {Object} 验证结果
     */
    validateExportData(data) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        if (!Array.isArray(data)) {
            result.isValid = false;
            result.errors.push('数据必须是数组格式');
            return result;
        }
        
        if (data.length === 0) {
            result.isValid = false;
            result.errors.push('数据数组为空');
            return result;
        }
        
        // 检查数据完整性
        let invalidCount = 0;
        let missingUrlCount = 0;
        let missingContentCount = 0;
        
        data.forEach((item, index) => {
            if (!item || typeof item !== 'object') {
                invalidCount++;
                return;
            }
            
            if (!item.url) {
                missingUrlCount++;
            }
            
            if (!item.title && !item.author && !item.imageUrl) {
                missingContentCount++;
            }
        });
        
        if (invalidCount > 0) {
            result.warnings.push(`发现 ${invalidCount} 个无效数据项`);
        }
        
        if (missingUrlCount > 0) {
            result.warnings.push(`${missingUrlCount} 个数据项缺少URL`);
        }
        
        if (missingContentCount > 0) {
            result.warnings.push(`${missingContentCount} 个数据项缺少内容信息`);
        }
        
        return result;
    }
    
    /**
     * 分批导出大量数据
     * @param {Array} data 大数据集
     * @param {Object} options 导出选项
     * @returns {Promise<Array>} 导出结果数组
     */
    async batchExport(data, options = {}) {
        const batchSize = options.batchSize || 1000;
        const format = options.format || 'csv';
        const results = [];
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const batchOptions = {
                ...options,
                filename: `${options.filename || '小红书数据'}_batch_${Math.floor(i / batchSize) + 1}`
            };
            
            let result;
            switch (format) {
                case 'csv':
                    result = await this.exportToCSV(batch, batchOptions);
                    break;
                case 'json':
                    result = await this.exportToJSON(batch, batchOptions);
                    break;
                case 'excel':
                    result = await this.exportToExcel(batch, batchOptions);
                    break;
                default:
                    throw new Error(`不支持的导出格式: ${format}`);
            }
            
            results.push(result);
        }
        
        return results;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportHandlerUtils;
} else if (typeof window !== 'undefined') {
    window.ExportHandlerUtils = ExportHandlerUtils;
}