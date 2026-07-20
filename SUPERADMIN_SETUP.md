# Superadmin Dashboard Setup Guide

## Overview

The POS application now includes a complete **Superadmin Dashboard** for managing multiple independent POS instances (SaaS model). A superadmin can create, manage, and monitor all POS instances from a single control panel.

## Default Superadmin Account

When you run the database seeders, a default superadmin account is created:

```
Email: superadmin@example.com
Password: superadmin123
```

**⚠️ IMPORTANT**: Change this password immediately in production!

## Accessing the Superadmin Dashboard

1. Navigate to your application login page
2. Login with the superadmin credentials
3. You will be automatically redirected to `/superadmin` after successful login
4. The superadmin dashboard will display

## Features

### 1. **Dashboard Statistics**
View at a glance:
- Total number of POS instances
- Number of active POS instances
- Active subscriptions count
- Subscriptions expiring within 30 days
- Expired subscriptions count

### 2. **POS Instance Management**

#### List All POS Instances
- View all created POS instances in a table
- Search by POS name or slug
- See subscription status with color-coded chips:
  - **Green (Active)**: Subscription active with remaining days
  - **Orange (Expiring Soon)**: Expiring within 30 days
  - **Red (Expired)**: Subscription has expired

#### Create New POS Instance
Click "Create POS" button to:
1. Enter POS name (required)
2. Enter address (optional)
3. Enter phone number (optional)
4. Enter admin name (required)
5. Enter admin email (required, must be unique)
6. Set admin password (required, minimum 8 characters)

The system will:
- Create the organization/POS instance
- Auto-generate a unique slug from the POS name
- Create an admin user with the specified credentials
- Assign the 'admin' role to the user
- Automatically set subscription to expire 1 year from now
- Return the credentials for sharing with the POS admin

#### Extend Subscription
For any POS instance:
1. Click "Extend" button in the actions column
2. Select number of years (1-10)
3. Click "Extend" to apply

This adds the specified years to the current subscription expiration date.

#### Reset Admin Password
For any POS instance:
1. Click "Reset" button in the actions column
2. Enter the new password (minimum 8 characters)
3. Click "Reset" to update

The admin can then login with the new password.

## Database Structure

### Organizations Table
```sql
CREATE TABLE organizations (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(255) UNIQUE,
    address TEXT,
    phone VARCHAR(20),
    logo_path VARCHAR(255),
    admin_user_id BIGINT (Foreign Key to users),
    subscription_expires_at DATETIME,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Multi-Tenancy
All tables have an `organization_id` field for data isolation:
- users, categories, units, warehouses, products
- product_stocks, stock_movements, suppliers, customers
- cash_accounts, purchases, purchase_items, purchase_landed_costs
- sales, sale_items, payments, expense_categories, expenses
- employees, employee_advances, payroll_runs, payroll_items
- period_closings, period_closing_snapshots, ledger_entries

Each POS instance's data is completely isolated and cannot be accessed by users from other POS instances.

## API Endpoints

All endpoints require `auth:sanctum` middleware and `role:superadmin`:

### Organizations
- `GET /api/v1/superadmin/organizations` - List all POS instances
  - Query params: `page`, `per_page`, `search` (by name or slug), `active` (filter by active status)
  
- `POST /api/v1/superadmin/organizations` - Create new POS
  - Request body:
    ```json
    {
      "name": "POS Name",
      "address": "Address",
      "phone": "Phone",
      "admin_name": "Admin Name",
      "admin_email": "admin@example.com",
      "admin_password": "password123",
      "logo_path": null
    }
    ```
  
- `GET /api/v1/superadmin/organizations/{id}` - Get POS details
  
- `PUT /api/v1/superadmin/organizations/{id}` - Update POS details
  - Can update: name, address, phone, logo_path, is_active
  
- `PATCH /api/v1/superadmin/organizations/{id}/toggle` - Toggle POS active status

### Subscriptions
- `POST /api/v1/superadmin/organizations/{id}/extend-subscription` - Extend subscription
  - Request body:
    ```json
    {
      "years": 1
    }
    ```
  
- `POST /api/v1/superadmin/organizations/{id}/reset-password` - Reset admin password
  - Request body:
    ```json
    {
      "new_password": "newpassword123"
    }
    ```

### Statistics
- `GET /api/v1/superadmin/stats/subscriptions` - Get subscription statistics

## Frontend Components

### SuperAdminDashboard
- Location: `resources/js/features/superadmin/SuperAdminDashboard.tsx`
- Main dashboard component with all features listed above
- Uses Material-UI components for professional appearance
- Real-time updates after each operation

### API Client
- Location: `resources/js/features/superadmin/api.ts`
- Axios instance configured for superadmin endpoints
- Methods for all CRUD operations and subscription management

## Role & Permission Management

### Superadmin Role
- Has all permissions (superadmin has access to everything)
- Cannot be used by regular POS users
- Separate login and dashboard from regular POS admin

### POS Admin Role
- Created automatically when a new POS instance is created
- Has full permissions within their own organization
- Cannot access other organizations' data
- Cannot access superadmin dashboard

### Other Roles (Manager, Cashier)
- Can only access data from their own organization
- Permissions controlled by role-based access control
- Cannot create or manage POS instances

## Tenant Isolation

### How It Works
1. **Global Scope**: TenantScope automatically filters all queries by `organization_id`
2. **Superadmin Exemption**: Superadmin users bypass tenant filtering
3. **Regular Users**: Non-superadmin users can only see their organization's data
4. **API Middleware**: EnsureTenantAccess verifies users have organization_id

### Adding to Models
To apply tenant isolation to a model, use the `BelongsToTenant` trait:

```php
use App\Models\Traits\BelongsToTenant;

class Product extends Model
{
    use BelongsToTenant;
    
    // ... rest of model
}
```

## Testing the Setup

### 1. Initial Setup
```bash
php artisan migrate --force
php artisan db:seed
```

### 2. Login as Superadmin
- Use email: `superadmin@example.com`
- Use password: `superadmin123`
- Should redirect to `/superadmin`

### 3. Create a Test POS
- Click "Create POS"
- Fill in test data
- Click "Create"
- Verify success notification appears
- Verify POS appears in the list

### 4. Test Subscription Extension
- Click "Extend" for the test POS
- Select 2 years
- Click "Extend"
- Verify subscription date is updated

### 5. Test Password Reset
- Click "Reset" for the test POS
- Enter new password
- Click "Reset"
- Verify success notification

### 6. Test POS Admin Login
- Try logging in with the POS admin credentials
- Should redirect to regular dashboard (not superadmin)
- Should only see data from their organization

## Deployment Notes

### GitHub Actions
The CI/CD workflow automatically builds and deploys when you push to `claude/pos-web-app-c6tkv9`.

### Hostinger Deployment
1. Migrations run automatically during deployment
2. Seeds run automatically during first deployment
3. Superadmin user created in SuperAdminUserSeeder
4. No additional setup required

### Post-Deployment
1. Login with default superadmin credentials
2. Change password immediately
3. Create first POS instance
4. Test complete flow

## Security Considerations

1. **Default Credentials**: Change `superadmin@example.com` password immediately
2. **HTTPS Only**: Ensure all traffic is HTTPS in production
3. **CSRF Protection**: All API calls include CSRF tokens via Sanctum
4. **Tenant Isolation**: Enforced at model and middleware level
5. **Role-Based Access**: Superadmin routes require explicit role check

## Troubleshooting

### Superadmin Dashboard Not Loading
- Verify user has 'superadmin' role
- Check that `roles` table has 'superadmin' role created
- Verify user is assigned the 'superadmin' role via `model_has_roles` table

### Cannot Create POS Instance
- Verify superadmin has permissions
- Check that admin email is not already used
- Verify all required fields are filled

### Tenant Isolation Not Working
- Ensure `organization_id` is set on users
- Verify BelongsToTenant trait is applied to models
- Check that TenantScope is properly registered

### POS Admin Cannot Login
- Verify the POS admin email exists
- Verify the password is correct
- Check that the organization exists and is active

## Database Commands

### Create Superadmin User Manually
```bash
php artisan tinker

$user = User::create([
    'name' => 'Super Admin',
    'email' => 'superadmin@yourdomain.com',
    'password' => bcrypt('your-secure-password'),
    'locale' => 'en',
    'is_active' => true,
]);
$user->assignRole('superadmin');
```

### Reset Superadmin Password
```bash
php artisan tinker

$user = User::where('email', 'superadmin@example.com')->first();
$user->password = bcrypt('new-password');
$user->save();
```

### View All Organizations
```bash
php artisan tinker

Organization::with('adminUser')->get();
```
