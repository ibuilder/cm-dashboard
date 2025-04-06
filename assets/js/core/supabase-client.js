// Import Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Initialize Supabase client
const initSupabase = () => {
    const supabaseUrl = window.SUPABASE_URL;
    const supabaseKey = window.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials not found');
        return null;
    }
    
    return createClient(supabaseUrl, supabaseKey);
};

const supabase = initSupabase();

// Generic CRUD operations
const supabaseAPI = {
    // Create a new record
    async create(table, data) {
        try {
            // Add created_by and created_at if not provided
            if (!data.created_by) {
                const user = await this.getCurrentUser();
                if (user) {
                    data.created_by = user.id;
                }
            }
            
            if (!data.created_at) {
                data.created_at = new Date();
            }
            
            // Add project_id if not provided
            if (!data.project_id) {
                const projectId = localStorage.getItem('cm_current_project_id');
                if (projectId) {
                    data.project_id = projectId;
                }
            }
            
            const { data: record, error } = await supabase
                .from(table)
                .insert(data)
                .select();
                
            if (error) throw error;
            
            // Log activity
            await this.logActivity(table, record[0].id, 'created');
            
            return { success: true, data: record };
        } catch (error) {
            console.error('Error creating record:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Read records with optional filters
    async read(table, options = {}) {
        try {
            let query = supabase.from(table).select(options.columns || '*');
            
            // Add project filter automatically
            const projectId = localStorage.getItem('cm_current_project_id');
            if (projectId && !options.ignoreProjectFilter) {
                query = query.eq('project_id', projectId);
            }
            
            // Apply filters if provided
            if (options.filters) {
                for (const [key, value] of Object.entries(options.filters)) {
                    if (key === 'search' && value) {
                        // Handle search across multiple columns
                        if (options.searchColumns && options.searchColumns.length > 0) {
                            let orConditions = [];
                            
                            options.searchColumns.forEach(column => {
                                orConditions.push(`${column}.ilike.%${value}%`);
                            });
                            
                            query = query.or(orConditions.join(','));
                        }
                    } else if (key === 'date_from' && value) {
                        // Handle date range
                        query = query.gte(options.dateField || 'created_at', value);
                    } else if (key === 'date_to' && value) {
                        // Add one day to include the end date
                        const toDate = new Date(value);
                        toDate.setDate(toDate.getDate() + 1);
                        query = query.lt(options.dateField || 'created_at', toDate.toISOString());
                    } else {
                        query = query.eq(key, value);
                    }
                }
            }
            
            // Apply ordering
            if (options.orderBy) {
                query = query.order(options.orderBy, { 
                    ascending: options.ascending !== false 
                });
            }
            
            // Get count if needed
            let count = null;
            if (!options.skipCount) {
                const countQuery = supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                
                // Apply the same filters as the main query
                let countQueryWithFilters = countQuery;
                
                if (projectId && !options.ignoreProjectFilter) {
                    countQueryWithFilters = countQueryWithFilters.eq('project_id', projectId);
                }
                
                if (options.filters) {
                    for (const [key, value] of Object.entries(options.filters)) {
                        if (key === 'search' && value) {
                            // Handle search across multiple columns
                            if (options.searchColumns && options.searchColumns.length > 0) {
                                let orConditions = [];
                                
                                options.searchColumns.forEach(column => {
                                    orConditions.push(`${column}.ilike.%${value}%`);
                                });
                                
                                countQueryWithFilters = countQueryWithFilters.or(orConditions.join(','));
                            }
                        } else if (key === 'date_from' && value) {
                            countQueryWithFilters = countQueryWithFilters.gte(options.dateField || 'created_at', value);
                        } else if (key === 'date_to' && value) {
                            const toDate = new Date(value);
                            toDate.setDate(toDate.getDate() + 1);
                            countQueryWithFilters = countQueryWithFilters.lt(options.dateField || 'created_at', toDate.toISOString());
                        } else {
                            countQueryWithFilters = countQueryWithFilters.eq(key, value);
                        }
                    }
                }
                
                const { count: recordCount, error: countError } = await countQueryWithFilters;
                
                if (countError) throw countError;
                count = recordCount;
            }
            
            // Apply pagination
            if (options.page && options.pageSize) {
                const start = (options.page - 1) * options.pageSize;
                query = query.range(start, start + options.pageSize - 1);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return { success: true, data, count };
        } catch (error) {
            console.error('Error reading records:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Get a single record by ID
    async getById(table, id, columns = '*') {
        try {
            const { data, error } = await supabase
                .from(table)
                .select(columns)
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error getting record:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Update a record
    async update(table, id, data) {
        try {
            // Add updated_by and updated_at
            const user = await this.getCurrentUser();
            if (user) {
                data.updated_by = user.id;
            }
            
            data.updated_at = new Date();
            
            const { data: record, error } = await supabase
                .from(table)
                .update(data)
                .eq('id', id)
                .select();
                
            if (error) throw error;
            
            // Log activity
            await this.logActivity(table, id, 'updated');
            
            return { success: true, data: record };
        } catch (error) {
            console.error('Error updating record:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Delete a record
    async delete(table, id) {
        try {
            // Check permissions before deleting
            const { data: record, error: fetchError } = await supabase
                .from(table)
                .select('created_by')
                .eq('id', id)
                .single();
                
            if (fetchError) throw fetchError;
            
            // Check if user can delete this record
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');
            
            // Only administrator or record owner can delete
            if (user.role !== 'administrator' && record.created_by !== user.id) {
                throw new Error('You do not have permission to delete this record');
            }
            
            // Delete comments first
            await supabase
                .from('comments')
                .delete()
                .eq('module_table', table)
                .eq('record_id', id);
            
            // Then delete the record
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            // Log activity
            await this.logActivity(table, id, 'deleted');
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting record:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Add a comment to a record
    async addComment(moduleTable, recordId, comment) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');
            
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    module_table: moduleTable,
                    record_id: recordId,
                    user_id: user.id,
                    comment_text: comment,
                    created_at: new Date()
                })
                .select();
                
            if (error) throw error;
            
            // Log activity
            await this.logActivity(moduleTable, recordId, 'commented');
            
            return { success: true, data };
        } catch (error) {
            console.error('Error adding comment:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Get comments for a record
    async getComments(moduleTable, recordId) {
        try {
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    *,
                    users:user_id (
                        id,
                        first_name,
                        last_name,
                        email
                    )
                `)
                .eq('module_table', moduleTable)
                .eq('record_id', recordId)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error getting comments:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Log activity
    async logActivity(moduleTable, recordId, action) {
        try {
            const user = await this.getCurrentUser();
            if (!user) return;
            
            const projectId = localStorage.getItem('cm_current_project_id');
            if (!projectId) return;
            
            await supabase
                .from('activity_log')
                .insert({
                    user_id: user.id,
                    project_id: projectId,
                    module: moduleTable,
                    record_id: recordId,
                    action: action,
                    created_at: new Date()
                });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    },
    
    // Get current user
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            
            if (user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_id', user.id)
                    .single();
                
                return userData;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }
};

// Export for use in other files
window.supabaseAPI = supabaseAPI;
export default supabaseAPI;