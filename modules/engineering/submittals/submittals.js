/**
 * Submittals Module
 * Common utilities and functions for the submittals module
 */

const submittalsModule = (function() {
    // Cache DOM elements
    let elements = {};
    
    // Submittal statuses and their display properties
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
        'in_review': {
            label: 'In Review',
            badge: 'bg-info',
            icon: 'bi-eye'
        },
        'reviewed': {
            label: 'Reviewed',
            badge: 'bg-warning text-dark',
            icon: 'bi-check2'
        },
        'approved': {
            label: 'Approved',
            badge: 'bg-success',
            icon: 'bi-check2-circle'
        },
        'rejected': {
            label: 'Rejected',
            badge: 'bg-danger',
            icon: 'bi-x-circle'
        },
        'resubmit': {
            label: 'Resubmit Required',
            badge: 'bg-warning text-dark',
            icon: 'bi-arrow-repeat'
        }
    };
    
    // Allowed status transitions based on user role
    const STATUS_TRANSITIONS = {
        'draft': ['submitted'],
        'submitted': ['in_review', 'rejected'],
        'in_review': ['reviewed', 'approved', 'rejected', 'resubmit'],
        'reviewed': ['approved', 'rejected', 'resubmit'],
        'approved': [],
        'rejected': ['draft'],
        'resubmit': ['draft']
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
     * Calculate days remaining until due date or days overdue
     * @param {string} dueDateString - The due date string
     * @param {string} status - The submittal status
     * @returns {Object} Object with days remaining/overdue and status
     */
    function calculateDaysRemaining(dueDateString, status) {
        if (!dueDateString) return { days: null, isOverdue: false };
        
        const dueDate = new Date(dueDateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Check if overdue (negative days and not in a closed status)
        const closedStatuses = ['approved', 'rejected'];
        const isOverdue = diffDays < 0 && !closedStatuses.includes(status);
        
        return {
            days: Math.abs(diffDays),
            isOverdue: isOverdue
        };
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
     * Generate a new submittal number
     * @param {number} projectId - The project ID
     * @returns {Promise<string>} The new submittal number
     */
    async function generateSubmittalNumber(projectId) {
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
            
            // Count existing submittals for this project
            const { count, error: countError } = await supabase
                .from('submittals')
                .select('id', { count: 'exact' })
                .eq('project_id', projectId);
            
            if (countError) throw countError;
            
            // Format: PROJ-SUB-001
            const paddedCount = (count + 1).toString().padStart(3, '0');
            return `${projectCode}-SUB-${paddedCount}`;
        } catch (error) {
            console.error('Error generating submittal number:', error);
            // Return a fallback number
            return `SUB-${Date.now()}`;
        }
    }
    
    /**
     * Load all companies for a project
     * @param {number} projectId - The project ID
     * @returns {Promise<Array>} Array of companies
     */
    async function loadProjectCompanies(projectId) {
        try {
            if (!projectId) {
                throw new Error('Project ID is required');
            }
            
            const { data, error } = await supabase
                .from('project_companies')
                .select(`
                    company_id,
                    companies (
                        id,
                        name,
                        role
                    )
                `)
                .eq('project_id', projectId);
            
            if (error) throw error;
            
            // Transform data to a simpler format
            return data.map(item => ({
                id: item.companies.id,
                name: item.companies.name,
                role: item.companies.role
            }));
        } catch (error) {
            console.error('Error loading project companies:', error);
            return [];
        }
    }
    
    /**
     * Create a submittal activity log entry
     * @param {number} submittalId - The submittal ID
     * @param {string} action - The action type (create, update, status_change, etc.)
     * @param {string} description - The activity description
     * @returns {Promise<boolean>} Success status
     */
    async function logActivity(submittalId, action, description) {
        try {
            if (!submittalId || !action || !description) {
                throw new Error('Missing required parameters');
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            const { data, error } = await supabase
                .from('activity_log')
                .insert({
                    module_name: 'submittals',
                    record_id: submittalId,
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
     * Validate submittal data
     * @param {Object} data - The submittal data to validate
     * @returns {Object} Validation result with success status and errors
     */
    function validateSubmittal(data) {
        const errors = {};
        
        // Required fields
        if (!data.title || data.title.trim() === '') {
            errors.title = 'Title is required';
        }
        
        if (!data.from_company_id) {
            errors.from_company_id = 'From company is required';
        }
        
        if (!data.to_company_id) {
            errors.to_company_id = 'To company is required';
        }
        
        if (!data.due_date) {
            errors.due_date = 'Due date is required';
        }
        
        // Status validation
        if (data.status === 'submitted' && !data.date_submitted) {
            errors.date_submitted = 'Submission date is required when status is Submitted';
        }
        
        // Review validations
        const reviewStatuses = ['reviewed', 'approved', 'rejected'];
        if (reviewStatuses.includes(data.status)) {
            if (!data.reviewed_by) {
                errors.reviewed_by = 'Reviewer is required for this status';
            }
            
            if (!data.review_date) {
                errors.review_date = 'Review date is required for this status';
            }
        }
        
        return {
            success: Object.keys(errors).length === 0,
            errors: errors
        };
    }
    
    /**
     * Create a new submittal
     * @param {Object} data - The submittal data
     * @returns {Promise<Object>} The result with success status and created data
     */
    async function createSubmittal(data) {
        try {
            // Validate data
            const validation = validateSubmittal(data);
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
            
            // If no submittal number provided, generate one
            if (!data.submittal_number) {
                data.submittal_number = await generateSubmittalNumber(projectId);
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Prepare submittal data
            const submittalData = {
                ...data,
                project_id: projectId,
                created_by: user.id,
                date_created: new Date().toISOString()
            };
            
            // Insert into database
            const { data: created, error } = await supabase
                .from('submittals')
                .insert(submittalData)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log activity
            await logActivity(
                created.id,
                'create',
                `Submittal #${created.submittal_number} created`
            );
            
            return {
                success: true,
                data: created
            };
        } catch (error) {
            console.error('Error creating submittal:', error);
            return {
                success: false,
                error: error.message || 'Failed to create submittal'
            };
        }
    }
    
    /**
     * Update an existing submittal
     * @param {number} id - The submittal ID
     * @param {Object} data - The submittal data to update
     * @returns {Promise<Object>} The result with success status
     */
    async function updateSubmittal(id, data) {
        try {
            if (!id) {
                throw new Error('Submittal ID is required');
            }
            
            // Validate data
            const validation = validateSubmittal(data);
            if (!validation.success) {
                return {
                    success: false,
                    errors: validation.errors
                };
            }
            
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            
            // Get current submittal data for comparison
            const { data: currentData, error: fetchError } = await supabase
                .from('submittals')
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
            
            // Update in database
            const { data: updated, error } = await supabase
                .from('submittals')
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
                    `Submittal #${updated.submittal_number} updated`
                );
            }
            
            return {
                success: true,
                data: updated
            };
        } catch (error) {
            console.error('Error updating submittal:', error);
            return {
                success: false,
                error: error.message || 'Failed to update submittal'
            };
        }
    }
    
    /**
     * Delete a submittal
     * @param {number} id - The submittal ID
     * @returns {Promise<Object>} The result with success status
     */
    async function deleteSubmittal(id) {
        try {
            if (!id) {
                throw new Error('Submittal ID is required');
            }
            
            // Get submittal data first for logging
            const { data: submittal, error: fetchError } = await supabase
                .from('submittals')
                .select('submittal_number')
                .eq('id', id)
                .single();
            
            if (fetchError) throw fetchError;
            
            // Delete submittal
            const { error } = await supabase
                .from('submittals')
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
                    module_name: 'submittals',
                    record_id: null, // The record is gone
                    action: 'delete',
                    description: `Submittal #${submittal.submittal_number} deleted`,
                    user_id: user.id,
                    project_id: projectId
                });
            
            return {
                success: true
            };
        } catch (error) {
            console.error('Error deleting submittal:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete submittal'
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
        calculateDaysRemaining,
        isStatusTransitionAllowed,
        generateSubmittalNumber,
        loadProjectCompanies,
        logActivity,
        validateSubmittal,
        createSubmittal,
        updateSubmittal,
        deleteSubmittal,
        getStatusBadgeHtml,
        processRichText,
        STATUS_TYPES,
        STATUS_TRANSITIONS
    };
})();

// Initialize module when DOM is ready
document.addEventListener('DOMContentLoaded', submittalsModule.init);