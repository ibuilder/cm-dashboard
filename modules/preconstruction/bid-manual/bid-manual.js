/**
 * Bid Manual Module
 * Common utilities and functions for the bid manual module
 */

const bidManualModule = (function() {
    // Cache DOM elements
    let elements = {};
    
    // Bid manual statuses and their display properties
    const STATUS_TYPES = {
        'draft': {
            label: 'Draft',
            badge: 'bg-secondary',
            icon: 'bi-file-earmark'
        },
        'in_progress': {
            label: 'In Progress',
            badge: 'bg-primary',
            icon: 'bi-arrow-right-circle'
        },
        'under_review': {
            label: 'Under Review',
            badge: 'bg-info',
            icon: 'bi-eye'
        },
        'approved': {
            label: 'Approved',
            badge: 'bg-success',
            icon: 'bi-check2-circle'
        },
        'published': {
            label: 'Published',
            badge: 'bg-warning text-dark',
            icon: 'bi-globe'
        },
        'archived': {
            label: 'Archived',
            badge: 'bg-dark',
            icon: 'bi-archive'
        }
    };
    
    // Allowed status transitions based on user role
    const STATUS_TRANSITIONS = {
        'draft': ['in_progress'],
        'in_progress': ['under_review', 'draft'],
        'under_review': ['approved', 'in_progress'],
        'approved': ['published', 'under_review'],
        'published': ['archived'],
        'archived': ['published']
    };
    
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
     * Check if a status transition is allowed
     * @param {string} currentStatus - The current status
     * @param {string} newStatus - The new status
     * @returns {boolean} Whether the transition is allowed
     */
    function isStatusTransitionAllowed(currentStatus, newStatus) {
        if (!currentStatus || !newStatus) return false;
        
        // If staying in the same status, always allow
        if (currentStatus === newStatus) return true;
        
        // Check if the transition is allowed
        return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
    }
    
    /**
     * Generate a new bid manual number
     * @param {number} projectId - The project ID
     * @returns {Promise<string>} The new bid manual number
     */
    async function generateBidManualNumber(projectId) {
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
            
            // Count existing bid manuals for this project
            const { count, error: countError } = await supabase
                .from('bid_manuals')
                .select('id', { count: 'exact' })
                .eq('project_id', projectId);
            
            if (countError) throw countError;
            
            // Format: PROJ-BM-001
            const paddedCount = (count + 1).toString().padStart(3, '0');
            return `${projectCode}-BM-${paddedCount}`;
        } catch (error) {
            console.error('Error generating bid manual number:', error);
            // Return a fallback number
            return `BM-${Date.now()}`;
        }
    }
    
    /**
     * Create a bid manual activity log entry
     * @param {number} bidManualId - The bid manual ID
     * @param {string} action - The action type (create, update, status_change, etc.)
     * @param {string} description - The activity description
     * @returns {Promise<boolean>} Success status
     */
    async function logActivity(bidManualId, action, description) {
        try {
            if (!bidManualId || !action || !description) {
                throw new Error('Missing required parameters');
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            const { data, error } = await supabase
                .from('activity_log')
                .insert({
                    module_name: 'bid_manuals',
                    record_id: bidManualId,
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
     * Validate bid manual data
     * @param {Object} data - The bid manual data to validate
     * @returns {Object} Validation result with success status and errors
     */
    function validateBidManual(data) {
        const errors = {};
        
        // Required fields
        if (!data.title || data.title.trim() === '') {
            errors.title = 'Title is required';
        }
        
        if (!data.issue_date) {
            errors.issue_date = 'Issue date is required';
        }
        
        if (!data.bid_date) {
            errors.bid_date = 'Bid date is required';
        }
        
        // Status validation
        if (data.status === 'published' && !data.publish_date) {
            errors.publish_date = 'Publish date is required when status is Published';
        }
        
        return {
            success: Object.keys(errors).length === 0,
            errors: errors
        };
    }
    
    /**
     * Get a bid manual by ID
     * @param {number} id - The bid manual ID
     * @param {string} select - Optional select query for additional relations
     * @returns {Promise<Object>} The result with success status and data
     */
    async function getBidManualById(id, select = '*') {
        try {
            if (!id) {
                throw new Error('Bid manual ID is required');
            }
            
            const { data, error } = await supabase
                .from('bid_manuals')
                .select(select)
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error getting bid manual:', error);
            return {
                success: false,
                error: error.message || 'Failed to get bid manual'
            };
        }
    }
    
    /**
     * Create a new bid manual
     * @param {Object} data - The bid manual data
     * @returns {Promise<Object>} The result with success status and created data
     */
    async function createBidManual(data) {
        try {
            // Validate data
            const validation = validateBidManual(data);
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
            
            // If no bid manual number provided, generate one
            if (!data.bid_manual_number) {
                data.bid_manual_number = await generateBidManualNumber(projectId);
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Prepare bid manual data
            const bidManualData = {
                ...data,
                project_id: projectId,
                created_by: user.id,
                created_at: new Date().toISOString()
            };
            
            // Insert into database
            const { data: created, error } = await supabase
                .from('bid_manuals')
                .insert(bidManualData)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log activity
            await logActivity(
                created.id,
                'create',
                `Bid Manual #${created.bid_manual_number} created`
            );
            
            return {
                success: true,
                data: created
            };
        } catch (error) {
            console.error('Error creating bid manual:', error);
            return {
                success: false,
                error: error.message || 'Failed to create bid manual'
            };
        }
    }
    
    /**
     * Update an existing bid manual
     * @param {number} id - The bid manual ID
     * @param {Object} data - The bid manual data to update
     * @returns {Promise<Object>} The result with success status
     */
    async function updateBidManual(id, data) {
        try {
            if (!id) {
                throw new Error('Bid manual ID is required');
            }
            
            // Validate data
            const validation = validateBidManual(data);
            if (!validation.success) {
                return {
                    success: false,
                    errors: validation.errors
                };
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Get current bid manual data for comparison
            const { data: currentData, error: fetchError } = await supabase
                .from('bid_manuals')
                .select('*')
                .eq('id', id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // Check for status change
            const statusChanged = currentData.status !== data.status;
            
            // If status is changing, ensure it's a valid transition
            if (statusChanged && !isStatusTransitionAllowed(currentData.status, data.status)) {
                return {
                    success: false,
                    error: `Status transition from ${formatStatus(currentData.status)} to ${formatStatus(data.status)} is not allowed`
                };
            }
            
            // Set publish date when publishing
            if (statusChanged && data.status === 'published' && !data.publish_date) {
                data.publish_date = new Date().toISOString();
            }
            
            // Update in database
            const { data: updated, error } = await supabase
                .from('bid_manuals')
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
                    `Bid Manual #${updated.bid_manual_number} updated`
                );
            }
            
            return {
                success: true,
                data: updated
            };
        } catch (error) {
            console.error('Error updating bid manual:', error);
            return {
                success: false,
                error: error.message || 'Failed to update bid manual'
            };
        }
    }
    
    /**
     * Delete a bid manual
     * @param {number} id - The bid manual ID
     * @returns {Promise<Object>} The result with success status
     */
    async function deleteBidManual(id) {
        try {
            if (!id) {
                throw new Error('Bid manual ID is required');
            }
            
            // Get bid manual data first for logging
            const { data: bidManual, error: fetchError } = await supabase
                .from('bid_manuals')
                .select('bid_manual_number')
                .eq('id', id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // Delete bid manual
            const { error } = await supabase
                .from('bid_manuals')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Log the deletion (note: this will be in the activity log but the record is gone)
            const projectId = localStorage.getItem('cm_current_project_id');
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            await supabase
                .from('activity_log')
                .insert({
                    module_name: 'bid_manuals',
                    record_id: null, // The record is gone
                    action: 'delete',
                    description: `Bid Manual #${bidManual.bid_manual_number} deleted`,
                    user_id: user.id,
                    project_id: projectId
                });
            
            return {
                success: true
            };
        } catch (error) {
            console.error('Error deleting bid manual:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete bid manual'
            };
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
        isStatusTransitionAllowed,
        generateBidManualNumber,
        logActivity,
        validateBidManual,
        getBidManualById,
        createBidManual,
        updateBidManual,
        deleteBidManual,
        getStatusBadgeHtml,
        processRichText,
        STATUS_TYPES,
        STATUS_TRANSITIONS
    };
})();

// Initialize module when DOM is ready
document.addEventListener('DOMContentLoaded', bidManualModule.init);