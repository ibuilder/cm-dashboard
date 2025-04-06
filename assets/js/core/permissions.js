const permissionsManager = {
    // Role definitions
    roles: {
        administrator: {
            level: 4,
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true,
            canManageUsers: true,
            canManageSettings: true
        },
        editor: {
            level: 3,
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: false,
            canManageUsers: false,
            canManageSettings: false
        },
        contributor: {
            level: 2,
            canCreate: true,
            canRead: true,
            canUpdate: false,
            canDelete: false,
            canManageUsers: false,
            canManageSettings: false
        },
        viewer: {
            level: 1,
            canCreate: false,
            canRead: true,
            canUpdate: false,
            canDelete: false,
            canManageUsers: false,
            canManageSettings: false
        },
        restricted: {
            level: 0,
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
            canManageUsers: false,
            canManageSettings: false
        }
    },
    
    // Get current user's role
    getUserRole() {
        return authService.getUserRole() || 'restricted';
    },
    
    // Check if user has a specific role or higher
    hasRole(requiredRole) {
        const userRole = this.getUserRole();
        const userRoleLevel = this.roles[userRole]?.level || 0;
        const requiredRoleLevel = this.roles[requiredRole]?.level || 0;
        
        return userRoleLevel >= requiredRoleLevel;
    },
    
    // Check if user can perform specific actions
    canCreate() {
        const userRole = this.getUserRole();
        return this.roles[userRole]?.canCreate || false;
    },
    
    canRead() {
        const userRole = this.getUserRole();
        return this.roles[userRole]?.canRead || false;
    },
    
    canUpdate() {
        const userRole = this.getUserRole();
        return this.roles[userRole]?.canUpdate || false;
    },
    
    canDelete() {
        const userRole = this.getUserRole();
        return this.roles[userRole]?.canDelete || false;
    },
    
    // Check if user can delete their own record
    canDeleteOwn(createdById) {
        // Administrator can delete any record
        if (this.hasRole('administrator')) return true;
        
        // Others can only delete their own records
        const userData = authService.getUserData();
        return userData && userData.id === createdById;
    },
    
    canManageUsers() {
        const userRole = this.getUserRole();
        return this.roles[userRole]?.canManageUsers || false;
    },
    
    canManageSettings() {
        const userRole = this.getUserRole();
        return this.roles[userRole]?.canManageSettings || false;
    },
    
    // Apply permissions to UI elements
    applyPermissions() {
        // Hide create buttons for users without create permission
        if (!this.canCreate()) {
            document.querySelectorAll('.permission-create').forEach(el => {
                el.classList.add('d-none');
            });
        }
        
        // Hide update buttons for users without update permission
        if (!this.canUpdate()) {
            document.querySelectorAll('.permission-update').forEach(el => {
                el.classList.add('d-none');
            });
        }
        
        // Hide delete buttons for users without delete permission
        if (!this.canDelete()) {
            document.querySelectorAll('.permission-delete').forEach(el => {
                el.classList.add('d-none');
            });
        }
        
        // Hide user management for users without permission
        if (!this.canManageUsers()) {
            document.querySelectorAll('.permission-manage-users').forEach(el => {
                el.classList.add('d-none');
            });
        }
        
        // Hide settings for users without permission
        if (!this.canManageSettings()) {
            document.querySelectorAll('.permission-manage-settings').forEach(el => {
                el.classList.add('d-none');
            });
        }
        
        // Process owner-specific delete buttons
        document.querySelectorAll('[data-creator-id]').forEach(el => {
            const creatorId = el.getAttribute('data-creator-id');
            
            if (!this.canDeleteOwn(creatorId)) {
                if (el.classList.contains('permission-delete-own')) {
                    el.classList.add('d-none');
                }
            }
        });
    }
};

// Apply permissions when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    permissionsManager.applyPermissions();
});

// Export for use in other files
window.permissionsManager = permissionsManager;
export default permissionsManager;