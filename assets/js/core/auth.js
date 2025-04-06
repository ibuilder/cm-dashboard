const authService = {
    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Fetch user details and role
            await this.getUserDetails();
            
            return { success: true, data };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async register(email, password, firstName, lastName, companyId) {
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password
            });
            
            if (authError) throw authError;
            
            // Create user profile with default 'viewer' role
            const { data: userData, error: userError } = await supabase
                .from('users')
                .insert({
                    auth_id: authData.user.id,
                    email,
                    first_name: firstName,
                    last_name: lastName,
                    company_id: companyId,
                    role: 'viewer',  // Default role
                    status: 'pending'  // Requires admin approval
                })
                .select();
                
            if (userError) throw userError;
            
            return { success: true, data: userData };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            // Clear local storage session data
            localStorage.removeItem('cm_user_role');
            localStorage.removeItem('cm_user_data');
            
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/pages/auth/reset-password.html',
            });
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async updatePassword(newPassword) {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Update password error:', error);
            return { success: false, error: error.message };
        }
    },
    
    async getUserDetails() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error) throw error;
            if (!user) return null;
            
            // Get user details from the users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select(`
                    *,
                    companies:company_id (
                        id,
                        name,
                        logo_url
                    )
                `)
                .eq('auth_id', user.id)
                .single();
                
            if (userError) throw userError;
            
            // Store user role for permission checks
            localStorage.setItem('cm_user_role', userData.role);
            localStorage.setItem('cm_user_data', JSON.stringify(userData));
            
            return userData;
        } catch (error) {
            console.error('Get user details error:', error);
            return null;
        }
    },
    
    getUserRole() {
        return localStorage.getItem('cm_user_role') || 'restricted';
    },
    
    getUserData() {
        const userData = localStorage.getItem('cm_user_data');
        return userData ? JSON.parse(userData) : null;
    },
    
    isAuthenticated() {
        return !!this.getUserData();
    },
    
    hasPermission(requiredRole) {
        const userRole = this.getUserRole();
        const roles = ['restricted', 'viewer', 'contributor', 'editor', 'administrator'];
        
        const userRoleIndex = roles.indexOf(userRole);
        const requiredRoleIndex = roles.indexOf(requiredRole);
        
        return userRoleIndex >= requiredRoleIndex;
    },
    
    canCreate() {
        const role = this.getUserRole();
        return ['contributor', 'editor', 'administrator'].includes(role);
    },
    
    canUpdate() {
        const role = this.getUserRole();
        return ['editor', 'administrator'].includes(role);
    },
    
    canDelete() {
        return this.getUserRole() === 'administrator';
    },
    
    // Check if user can delete their own record
    canDeleteOwn(createdById) {
        const userData = this.getUserData();
        return userData && userData.id === createdById;
    }
};

// Export for use in other files
window.authService = authService;
export default authService;