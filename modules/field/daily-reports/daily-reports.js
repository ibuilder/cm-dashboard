/**
 * Daily Reports Module
 * Common utilities and functions for the daily reports module
 */

const dailyReportsModule = (function() {
    // Cache DOM elements
    let elements = {};
    
    // Daily report statuses and their display properties
    const STATUS_TYPES = {
        'draft': {
            label: 'Draft',
            badge: 'bg-secondary',
            icon: 'bi-file-earmark'
        },
        'submitted': {
            label: 'Submitted',
            badge: 'bg-primary',
            icon: 'bi-arrow-up-circle'
        },
        'reviewed': {
            label: 'Reviewed',
            badge: 'bg-success',
            icon: 'bi-check2-circle'
        },
        'rejected': {
            label: 'Rejected',
            badge: 'bg-danger',
            icon: 'bi-x-circle'
        }
    };
    
    // Weather condition options
    const WEATHER_CONDITIONS = [
        { value: 'sunny', label: 'Sunny', icon: 'bi-sun' },
        { value: 'partly_cloudy', label: 'Partly Cloudy', icon: 'bi-cloud-sun' },
        { value: 'cloudy', label: 'Cloudy', icon: 'bi-cloud' },
        { value: 'rainy', label: 'Rainy', icon: 'bi-cloud-rain' },
        { value: 'stormy', label: 'Stormy', icon: 'bi-cloud-lightning-rain' },
        { value: 'snowy', label: 'Snowy', icon: 'bi-snow' },
        { value: 'foggy', label: 'Foggy', icon: 'bi-cloud-fog' },
        { value: 'windy', label: 'Windy', icon: 'bi-wind' }
    ];
    
    /**
     * Initialize the module
     */
    function init() {
        // This could be used in the future if needed
    }
    
    /**
     * Format a status for display
     * @param {string} status - The raw status value
     * @returns {string} The formatted status label
     */
    function formatStatus(status) {
        return STATUS_TYPES[status]?.label || 
            (status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : '');
    }
    
    /**
     * Get the CSS class for a status badge
     * @param {string} status - The raw status value
     * @returns {string} The CSS class for the badge
     */
    function getStatusBadgeClass(status) {
        return STATUS_TYPES[status]?.badge || 'bg-light text-dark';
    }
    
    /**
     * Get the Bootstrap icon class for a status
     * @param {string} status - The raw status value
     * @returns {string} The Bootstrap icon class
     */
    function getStatusIcon(status) {
        return STATUS_TYPES[status]?.icon || 'bi-question-circle';
    }
    
    /**
     * Format a date string for display
     * @param {string} dateString - The date string to format
     * @param {boolean} includeTime - Whether to include time in the formatted date
     * @returns {string} The formatted date string
     */
    function formatDate(dateString, includeTime = false) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        
        if (includeTime) {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        return date.toLocaleDateString();
    }
    
    /**
     * Generate a new daily report number
     * @param {number} projectId - The project ID
     * @returns {Promise<string>} The new daily report number
     */
    async function generateDailyReportNumber(projectId) {
        try {
            if (!projectId) {
                throw new Error('Project ID is required');
            }
            
            // Get project code
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('project_code')
                .eq('id', projectId)
                .single();
            
            if (projectError) throw projectError;
            
            const projectCode = project.project_code || 'PROJ';
            
            // Get current date
            const today = new Date();
            const dateString = today.toISOString().split('T')[0].replace(/-/g, '');
            
            // Count existing daily reports for this project on this date
            const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
            const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
            
            const { count, error: countError } = await supabase
                .from('daily_reports')
                .select('id', { count: 'exact' })
                .eq('project_id', projectId)
                .gte('report_date', startOfDay)
                .lte('report_date', endOfDay);
            
            if (countError) throw countError;
            
            // Format: PROJ-DR-20230405-01
            const paddedCount = (count + 1).toString().padStart(2, '0');
            return `${projectCode}-DR-${dateString}-${paddedCount}`;
        } catch (error) {
            console.error('Error generating daily report number:', error);
            // Return a fallback number
            const dateString = new Date().toISOString().split('T')[0].replace(/-/g, '');
            return `DR-${dateString}-${Date.now().toString().slice(-4)}`;
        }
    }
    
    /**
     * Get HTML for a weather condition icon and label
     * @param {string} condition - The weather condition value
     * @returns {string} HTML for the weather condition
     */
    function getWeatherHtml(condition) {
        const weatherInfo = WEATHER_CONDITIONS.find(w => w.value === condition) || 
            { label: condition, icon: 'bi-question-circle' };
        
        return `<span><i class="bi ${weatherInfo.icon} me-1"></i>${weatherInfo.label}</span>`;
    }
    
    /**
     * Format temperature for display
     * @param {number} temp - The temperature value
     * @param {string} unit - The temperature unit (C or F)
     * @returns {string} Formatted temperature string
     */
    function formatTemperature(temp, unit = 'F') {
        if (temp === null || temp === undefined) return '';
        return `${temp}°${unit}`;
    }
    
    /**
     * Validate daily report data
     * @param {Object} data - The daily report data to validate
     * @returns {Object} Validation result with success status and errors
     */
    function validateDailyReport(data) {
        const errors = {};
        
        // Required fields
        if (!data.report_date) {
            errors.report_date = 'Report date is required';
        }
        
        if (!data.author_id) {
            errors.author_id = 'Author is required';
        }
        
        // Weather validation - if any weather field is provided, require the others
        const hasWeatherInfo = data.weather_condition || data.temperature || data.precipitation;
        if (hasWeatherInfo) {
            if (!data.weather_condition) {
                errors.weather_condition = 'Weather condition is required if providing weather information';
            }
            
            if (data.temperature === null || data.temperature === undefined) {
                errors.temperature = 'Temperature is required if providing weather information';
            }
        }
        
        // Work performed validation
        if (!data.work_performed || data.work_performed.trim() === '') {
            errors.work_performed = 'Work performed is required';
        }
        
        return {
            success: Object.keys(errors).length === 0,
            errors: errors
        };
    }
    
    /**
     * Create a new daily report
     * @param {Object} data - The daily report data
     * @returns {Promise<Object>} The result with success status and created data
     */
    async function createDailyReport(data) {
        try {
            // Validate data
            const validation = validateDailyReport(data);
            if (!validation.success) {
                return {
                    success: false,
                    errors: validation.errors
                };
            }
            
            // Ensure current project is set
            const projectId = localStorage.getItem('cm_current_project_id');
            if (!projectId) {
                throw new Error('No project selected');
            }
            
            // If no report number provided, generate one
            if (!data.report_number) {
                data.report_number = await generateDailyReportNumber(projectId);
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Prepare daily report data
            const reportData = {
                ...data,
                project_id: projectId,
                created_by: user.id,
                created_at: new Date().toISOString(),
                status: data.status || 'draft'
            };
            
            // Insert into database
            const { data: created, error } = await supabase
                .from('daily_reports')
                .insert(reportData)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log activity
            await logActivity(
                created.id,
                'create',
                `Daily Report #${created.report_number} created`
            );
            
            return {
                success: true,
                data: created
            };
        } catch (error) {
            console.error('Error creating daily report:', error);
            return {
                success: false,
                error: error.message || 'Failed to create daily report'
            };
        }
    }
    
    /**
     * Update an existing daily report
     * @param {number} id - The daily report ID
     * @param {Object} data - The daily report data to update
     * @returns {Promise<Object>} The result with success status
     */
    async function updateDailyReport(id, data) {
        try {
            if (!id) {
                throw new Error('Daily report ID is required');
            }
            
            // Validate data
            const validation = validateDailyReport(data);
            if (!validation.success) {
                return {
                    success: false,
                    errors: validation.errors
                };
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Get current daily report data for comparison
            const { data: currentData, error: fetchError } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('id', id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // Check for status change
            const statusChanged = currentData.status !== data.status;
            
            // Update in database
            const { data: updated, error } = await supabase
                .from('daily_reports')
                .update({
                    ...data,
                    updated_by: user.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log activity
            if (statusChanged) {
                await logActivity(
                    id,
                    'status_change',
                    `Status changed from ${formatStatus(currentData.status)} to ${formatStatus(data.status)}`
                );
            } else {
                await logActivity(
                    id,
                    'update',
                    `Daily Report #${updated.report_number} updated`
                );
            }
            
            return {
                success: true,
                data: updated
            };
        } catch (error) {
            console.error('Error updating daily report:', error);
            return {
                success: false,
                error: error.message || 'Failed to update daily report'
            };
        }
    }
    
    /**
     * Delete a daily report
     * @param {number} id - The daily report ID
     * @returns {Promise<Object>} The result with success status
     */
    async function deleteDailyReport(id) {
        try {
            if (!id) {
                throw new Error('Daily report ID is required');
            }
            
            // Get daily report data first for logging
            const { data: report, error: fetchError } = await supabase
                .from('daily_reports')
                .select('report_number')
                .eq('id', id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // Delete daily report
            const { error } = await supabase
                .from('daily_reports')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Log the deletion
            const projectId = localStorage.getItem('cm_current_project_id');
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            await supabase
                .from('activity_log')
                .insert({
                    module_name: 'daily_reports',
                    record_id: null, // The record is gone
                    action: 'delete',
                    description: `Daily Report #${report.report_number} deleted`,
                    user_id: user.id,
                    project_id: projectId
                });
            
            return {
                success: true
            };
        } catch (error) {
            console.error('Error deleting daily report:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete daily report'
            };
        }
    }
    
    /**
     * Create a daily report activity log entry
     * @param {number} reportId - The daily report ID
     * @param {string} action - The action type (create, update, status_change, etc.)
     * @param {string} description - The activity description
     * @returns {Promise<boolean>} Success status
     */
    async function logActivity(reportId, action, description) {
        try {
            if (!reportId || !action || !description) {
                throw new Error('Missing required parameters');
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            const { data, error } = await supabase
                .from('activity_log')
                .insert({
                    module_name: 'daily_reports',
                    record_id: reportId,
                    action: action,
                    description: description,
                    user_id: user.id,
                    project_id: localStorage.getItem('cm_current_project_id')
                });
            
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error logging activity:', error);
            return false;
        }
    }
    
    /**
     * Get HTML for a status badge
     * @param {string} status - The status value
     * @returns {string} HTML for the status badge
     */
    function getStatusBadgeHtml(status) {
        const badgeClass = getStatusBadgeClass(status);
        const icon = getStatusIcon(status);
        const label = formatStatus(status);
        
        return `<span class="badge ${badgeClass}"><i class="bi ${icon} me-1"></i>${label}</span>`;
    }
    
    /**
     * Process and format a rich text field for display or storage
     * @param {string} text - The text to process
     * @param {boolean} forStorage - Whether this is for storing (true) or display (false)
     * @returns {string} The processed text
     */
    function processRichText(text, forStorage = false) {
        if (!text) return '';
        
        if (forStorage) {
            // Sanitize for storage - strip any potentially harmful tags
            return DOMPurify.sanitize(text, {
                ALLOWED_TAGS: [
                    'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span'
                ],
                ALLOWED_ATTR: ['href', 'target', 'style', 'class']
            });
        } else {
            // Process for display - convert plain text line breaks to <br> if needed
            if (!text.includes('<')) {
                // This appears to be plain text, so convert line breaks
                return text.replace(/\n/g, '<br>');
            }
            // Already has HTML, just make sure it's safe
            return DOMPurify.sanitize(text);
        }
    }
    
    // Public API
    return {
        init,
        formatStatus,
        getStatusBadgeClass,
        getStatusIcon,
        formatDate,
        generateDailyReportNumber,
        getWeatherHtml,
        formatTemperature,
        validateDailyReport,
        createDailyReport,
        updateDailyReport,
        deleteDailyReport,
        logActivity,
        getStatusBadgeHtml,
        processRichText,
        STATUS_TYPES,
        WEATHER_CONDITIONS
    };
})();

// Initialize module when DOM is ready
document.addEventListener('DOMContentLoaded', dailyReportsModule.init);